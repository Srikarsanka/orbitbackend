const mongoose = require('mongoose');

/**
 * SessionAttendance Model
 * Stores final attendance summary per participant per session
 */
const sessionAttendanceSchema = new mongoose.Schema({
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
  participantRole: {
    type: String,
    enum: ['student', 'faculty'],
    default: 'student'
  },
  
  // Attendance statistics
  totalIntervals: {
    type: Number,
    required: true,
    default: 0
  },
  matchedIntervals: {
    type: Number,
    required: true,
    default: 0
  },
  attendancePercentage: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Status based on threshold
  status: {
    type: String,
    enum: ['present', 'absent', 'partial'],
    required: true
  },
  
  // Timing information
  firstDetection: {
    type: Date
  },
  lastDetection: {
    type: Date
  },
  
  // Session configuration at time of attendance
  captureInterval: {
    type: Number, // seconds
    default: 60
  },
  threshold: {
    type: Number, // percentage
    default: 70
  },
  
  // Additional metadata
  totalActiveTime: {
    type: Number // seconds participant was in session
  },
  notes: {
    type: String // Optional notes (e.g., technical issues)
  }
  
}, { timestamps: true });

// Compound index for efficient queries
sessionAttendanceSchema.index({ sessionId: 1, participantEmail: 1 }, { unique: true });
sessionAttendanceSchema.index({ sessionId: 1, status: 1 });

// Method to calculate and update attendance
sessionAttendanceSchema.methods.calculateAttendance = function() {
  if (this.totalIntervals > 0) {
    this.attendancePercentage = (this.matchedIntervals / this.totalIntervals) * 100;
    
    // Determine status based on threshold
    if (this.attendancePercentage >= this.threshold) {
      this.status = 'present';
    } else if (this.attendancePercentage > 0) {
      this.status = 'partial';
    } else {
      this.status = 'absent';
    }
  } else {
    this.attendancePercentage = 0;
    this.status = 'absent';
  }
};

module.exports = mongoose.models.SessionAttendance || mongoose.model('SessionAttendance', sessionAttendanceSchema);
