const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');
const Recording = require('../models/Recording');

// Use OS temp dir for temporary upload storage (works on Render)
const os = require('os');
const uploadsDir = path.join(os.tmpdir(), 'orbit-recordings');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config — temp disk storage before Cloudinary upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webm`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
    fileFilter: (req, file, cb) => {
        // Accept video/audio mimetypes, application/octet-stream (browser blob uploads),
        // and files with recording extensions
        const validMime = file.mimetype.startsWith('video/') || 
                         file.mimetype.startsWith('audio/') ||
                         file.mimetype === 'application/octet-stream';
        const validExt = /\.(webm|mp4|mkv|ogg|wav|mp3)$/i.test(file.originalname);
        if (validMime || validExt) {
            cb(null, true);
        } else {
            console.warn(`⚠️ Rejected file: mimetype=${file.mimetype}, name=${file.originalname}`);
            cb(new Error(`File type not allowed: ${file.mimetype} (${file.originalname})`), false);
        }
    }
});

// POST /api/recordings/upload - Upload a recording to Cloudinary
router.post('/upload', (req, res) => {
    // Handle multer upload manually to catch multer errors
    upload.single('recording')(req, res, async (multerErr) => {
        if (multerErr) {
            console.error('Multer upload error:', multerErr.message);
            const msg = multerErr.code === 'LIMIT_FILE_SIZE' 
                ? 'File too large (max 500MB)' 
                : multerErr.message;
            return res.status(400).json({ error: msg, details: multerErr.message });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No recording file uploaded' });
            }

            const { sessionId, classId, facultyEmail, facultyName, title, duration } = req.body;

            if (!sessionId || !facultyEmail) {
                // Clean up temp file
                try { fs.unlinkSync(req.file.path); } catch(e) {}
                return res.status(400).json({ error: 'sessionId and facultyEmail are required' });
            }

            if (!classId) {
                console.warn('⚠️ Recording upload missing classId, proceeding anyway...');
            }

            console.log(`🎬 Uploading recording to Cloudinary (${(req.file.size / 1024 / 1024).toFixed(1)}MB)...`);

            // Upload to Cloudinary as video
            const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
                resource_type: 'video',
                folder: 'orbit-recordings',
                public_id: `rec_${sessionId}_${Date.now()}`,
                chunk_size: 6000000, // 6MB chunks for large file upload
                timeout: 600000      // 10 minute timeout for large uploads
            });

            // Delete temp file after successful Cloudinary upload
            try { fs.unlinkSync(req.file.path); } catch(e) {}

            const recording = new Recording({
                sessionId,
                classId: classId || 'unknown',
                facultyEmail,
                facultyName: facultyName || 'Faculty',
                title: title || 'Class Recording',
                filename: req.file.filename,
                fileUrl: cloudinaryResult.secure_url,
                cloudinaryId: cloudinaryResult.public_id,
                duration: Number(duration) || Math.round(cloudinaryResult.duration || 0),
                fileSize: req.file.size,
                mimeType: req.file.mimetype || 'video/webm'
            });

            await recording.save();
            console.log(`🎬 Recording saved to Cloudinary: ${cloudinaryResult.secure_url}`);

            res.json({ success: true, recording });
        } catch (error) {
            // Clean up temp file on error
            if (req.file) {
                try { fs.unlinkSync(req.file.path); } catch(e) {}
            }
            console.error('Recording upload error:', error.message || error);
            console.error('Full error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            res.status(500).json({ 
                error: 'Failed to save recording', 
                details: error.message || 'Unknown error',
                code: error.http_code || error.code || null
            });
        }
    });
});

// GET /api/recordings/class/:classId - List recordings for a class
router.get('/class/:classId', async (req, res) => {
    try {
        const recordings = await Recording.find({ classId: req.params.classId })
            .sort({ createdAt: -1 });
        res.json({ recordings });
    } catch (error) {
        console.error('Error fetching recordings:', error);
        res.status(500).json({ error: 'Failed to fetch recordings' });
    }
});

// DELETE /api/recordings/:id - Delete a recording (faculty only)
router.delete('/:id', async (req, res) => {
    try {
        const recording = await Recording.findById(req.params.id);
        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }

        // Delete from Cloudinary
        if (recording.cloudinaryId) {
            try {
                await cloudinary.uploader.destroy(recording.cloudinaryId, { resource_type: 'video' });
                console.log(`🗑️ Deleted from Cloudinary: ${recording.cloudinaryId}`);
            } catch(e) {
                console.warn('Failed to delete from Cloudinary:', e.message);
            }
        }

        await Recording.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Recording deleted' });
    } catch (error) {
        console.error('Error deleting recording:', error);
        res.status(500).json({ error: 'Failed to delete recording' });
    }
});

// POST /api/recordings/transcribe/:id - Transcribe a recording via Whisper
router.post('/transcribe/:id', async (req, res) => {
    try {
        const recording = await Recording.findById(req.params.id);
        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }

        const targetLang = req.body.lang || 'en';

        // Check cache: if we have a transcript in the requested language, return it
        if (recording.transcript && recording.transcript.length > 0 && recording.transcriptLang === targetLang) {
            console.log(`📋 Returning cached transcript for ${req.params.id} (${targetLang})`);
            return res.json({
                success: true,
                cached: true,
                segments: recording.transcript,
                targetLang: targetLang,
                totalSegments: recording.transcript.length
            });
        }

        // Proxy to Python Whisper service using native https
        const PYTHON_API = process.env.PYTHON_API_URL || 'https://orbit-afavcgereabweje3.eastasia-01.azurewebsites.net';
        console.log(`🎙️ Sending transcription request to Python service for recording ${req.params.id}...`);

        const requestBody = JSON.stringify({
            videoUrl: recording.fileUrl,
            lang: targetLang
        });

        // Use native https module (avoids ESM import issues with node-fetch v3)
        const https = require('https');
        const url = new URL(`${PYTHON_API}/api/transcribe`);
        
        const proxyReq = https.request({
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            },
            timeout: 300000
        }, (proxyRes) => {
            let body = '';
            proxyRes.on('data', chunk => body += chunk);
            proxyRes.on('end', async () => {
                try {
                    const data = JSON.parse(body);

                    if (proxyRes.statusCode !== 200) {
                        console.error('Whisper API error:', data);
                        return res.status(proxyRes.statusCode).json({
                            error: 'Transcription failed',
                            details: data.detail || 'Python service error'
                        });
                    }

                    // Cache the transcript in the database
                    if (data.segments && data.segments.length > 0) {
                        recording.transcript = data.segments;
                        recording.transcriptLang = targetLang;
                        await recording.save();
                        console.log(`💾 Cached transcript for ${req.params.id} (${data.segments.length} segments)`);
                    }

                    res.json(data);
                } catch (parseErr) {
                    console.error('Response parse error:', parseErr.message, body.substring(0, 200));
                    res.status(500).json({ error: 'Invalid response from transcription service' });
                }
            });
        });

        proxyReq.on('error', (err) => {
            console.error('Whisper proxy error:', err.message);
            res.status(502).json({ error: 'Cannot reach transcription service', details: err.message });
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy();
            res.status(504).json({ error: 'Transcription timed out' });
        });

        proxyReq.write(requestBody);
        proxyReq.end();
    } catch (error) {
        console.error('Transcription error:', error.message || error);
        res.status(500).json({ error: 'Transcription failed', details: error.message });
    }
});

// GET /api/recordings/transcript/:id - Get cached transcript
router.get('/transcript/:id', async (req, res) => {
    try {
        const recording = await Recording.findById(req.params.id);
        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }

        if (!recording.transcript || recording.transcript.length === 0) {
            return res.json({ success: true, cached: false, segments: [], message: 'No transcript available' });
        }

        res.json({
            success: true,
            cached: true,
            segments: recording.transcript,
            targetLang: recording.transcriptLang || 'en',
            totalSegments: recording.transcript.length
        });
    } catch (error) {
        console.error('Error fetching transcript:', error);
        res.status(500).json({ error: 'Failed to fetch transcript' });
    }
});

module.exports = router;
