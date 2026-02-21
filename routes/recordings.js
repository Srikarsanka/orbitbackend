const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Recording = require('../models/Recording');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'recordings');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config for recording uploads
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
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max for recordings
    fileFilter: (req, file, cb) => {
        // Accept video/audio files
        if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video/audio files are allowed'), false);
        }
    }
});

// POST /api/recordings/upload - Upload a recording
router.post('/upload', upload.single('recording'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No recording file uploaded' });
        }

        const { sessionId, classId, facultyEmail, facultyName, title, duration } = req.body;

        if (!sessionId || !classId || !facultyEmail) {
            // Clean up uploaded file if validation fails
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'sessionId, classId, and facultyEmail are required' });
        }

        const recording = new Recording({
            sessionId,
            classId,
            facultyEmail,
            facultyName: facultyName || 'Faculty',
            title: title || 'Class Recording',
            filename: req.file.filename,
            duration: Number(duration) || 0,
            fileSize: req.file.size,
            mimeType: req.file.mimetype || 'video/webm'
        });

        await recording.save();
        console.log(`🎬 Recording saved: ${recording.filename} (${(recording.fileSize / 1024 / 1024).toFixed(1)}MB)`);

        res.json({ success: true, recording });
    } catch (error) {
        console.error('Recording upload error:', error);
        res.status(500).json({ error: 'Failed to save recording' });
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

// GET /api/recordings/file/:filename - Stream a recording file
router.get('/file/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Recording not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        // Support range requests for seeking
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const file = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/webm',
        });
        file.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/webm',
        });
        fs.createReadStream(filePath).pipe(res);
    }
});

// DELETE /api/recordings/:id - Delete a recording (faculty only)
router.delete('/:id', async (req, res) => {
    try {
        const recording = await Recording.findById(req.params.id);
        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }

        // Delete file
        const filePath = path.join(uploadsDir, recording.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await Recording.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Recording deleted' });
    } catch (error) {
        console.error('Error deleting recording:', error);
        res.status(500).json({ error: 'Failed to delete recording' });
    }
});

module.exports = router;
