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
        if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video/audio files are allowed'), false);
        }
    }
});

// POST /api/recordings/upload - Upload a recording to Cloudinary
router.post('/upload', upload.single('recording'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No recording file uploaded' });
        }

        const { sessionId, classId, facultyEmail, facultyName, title, duration } = req.body;

        if (!sessionId || !classId || !facultyEmail) {
            // Clean up temp file
            try { fs.unlinkSync(req.file.path); } catch(e) {}
            return res.status(400).json({ error: 'sessionId, classId, and facultyEmail are required' });
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
            classId,
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

module.exports = router;
