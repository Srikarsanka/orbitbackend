// ===============================================
// Whiteboard State Model - MongoDB Schema
// Stores whiteboard drawings for persistence
// ===============================================

const mongoose = require('mongoose');

const WhiteboardStateSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    canvasData: {
        type: String, // Base64 encoded canvas image
        default: null
    },
    drawingHistory: [{
        type: {
            type: String,
            enum: ['draw', 'shape', 'clear']
        },
        data: mongoose.Schema.Types.Mixed,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    permissions: {
        allowedStudents: [{
            type: String // Student emails with drawing permission
        }]
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
WhiteboardStateSchema.index({ sessionId: 1, lastUpdated: -1 });

// Auto-cleanup old whiteboard data (optional - after 30 days)
WhiteboardStateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.models.WhiteboardState || mongoose.model('WhiteboardState', WhiteboardStateSchema);
