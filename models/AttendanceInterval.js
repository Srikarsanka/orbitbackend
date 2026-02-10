const mongoose = require('mongoose');

/**
 * AttendanceInterval Model
 * Stores individual attendance verification results for each capture interval
 */
const attendanceIntervalSchema = new mongoose.Schema({
  // Session reference
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSession',
    required: true,
    index: true
  },
  
  // Participant reference
  participantEmail: {
    type: String,
    required: true,
    index: true
  },
  participantName: {
    type: String,
    required: true
  },
  
  // Interval tracking
  intervalNumber: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Face verification result (from existing face-recognition API)
  faceDetected: {
    type: Boolean,
    required: true
  },
  matchResult: {
    type: Boolean, // true = present, false = absent
    required: true
  },
  confidence: {
    type: Number, // 0-1 confidence score from face API
    min: 0,
    max: 1
  },
  
  // Error tracking
  error: {
    type: String // Error message if verification failed
  }
  
}, { timestamps: true });

// Compound index for efficient queries
attendanceIntervalSchema.index({ sessionId: 1, participantEmail: 1, intervalNumber: 1 });
attendanceIntervalSchema.index({ sessionId: 1, timestamp: 1 });

module.exports = mongoose.model('AttendanceInterval', attendanceIntervalSchema);
