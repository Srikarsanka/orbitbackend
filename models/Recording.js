const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreateClass', required: true },
    facultyEmail: { type: String, required: true },
    facultyName: { type: String, default: 'Faculty' },
    title: { type: String, default: 'Class Recording' },
    filename: { type: String },
    fileUrl: { type: String, required: true },       // Cloudinary video URL
    cloudinaryId: { type: String },                   // Cloudinary public_id for deletion
    originalLanguage: { type: String, default: 'en' },
    duration: { type: Number, default: 0 }, // seconds
    fileSize: { type: Number, default: 0 }, // bytes
    mimeType: { type: String, default: 'video/webm' },
    createdAt: { type: Date, default: Date.now }
});

recordingSchema.index({ classId: 1, createdAt: -1 });
recordingSchema.index({ sessionId: 1 });

module.exports = mongoose.model('Recording', recordingSchema);
