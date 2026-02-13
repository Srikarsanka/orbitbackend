const mongoose = require('mongoose');

const classSessionSchema = new mongoose.Schema({
  // Reference to existing class
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  classCode: {
    type: String,
    required: true
  },
  
  // Session details
  sessionTitle: {
    type: String,
    required: true
  },
  
  // Scheduling
  scheduledStartTime: {
    type: Date,
    required: true
  },
  scheduledEndTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // minutes
    required: true
  },
  
  // Actual times
  actualStartTime: {
    type: Date
  },
  actualEndTime: {
    type: Date
  },
  
  // Status
  status: {
    type: String,
    enum: ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'],
    default: 'SCHEDULED'
  },
  
  // Presentation Mode (Teaching Mode)
  presentationMode: {
    isActive: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: ['WHITEBOARD', 'COMPILER', null],
      default: null
    },
    startedAt: {
      type: Date
    },
    endedAt: {
      type: Date
    }
  },
  
  // Attendance Configuration
  attendanceConfig: {
    enabled: {
      type: Boolean,
      default: true // Attendance enabled by default
    },
    captureInterval: {
      type: Number, // seconds
      default: 60,
      min: 45,
      max: 60
    },
    threshold: {
      type: Number, // percentage for present/absent
      default: 70,
      min: 0,
      max: 100
    },
    startTime: {
      type: Date // When attendance tracking started
    },
    endTime: {
      type: Date // When attendance tracking ended
    },
    totalIntervals: {
      type: Number, // Total expected intervals for this session
      default: 0
    }
  },
  
  // Session Statistics
  totalEnrolledStudents: Number,
  attendanceCount: Number,
  averageAttendancePercentage: Number,
  
  // Email tracking
  schedulingEmailSent: {
    type: Boolean,
    default: false
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  
  // Agora credentials (temporary storage)
  agoraChannel: {
    type: String
  },
  
  // Participants tracking
  participants: [{
    email: String,
    name: String,
    role: String, // 'faculty' or 'student'
    uid: Number, // Agora UID
    joinedAt: Date,
    leftAt: Date,
    lastRejoinAt: Date,
    rejoinCount: {
      type: Number,
      default: 0
    },
    rejoinSessions: [{
      rejoinedAt: Date,
      leftAt: Date
    }],
    duration: Number, // total seconds
    attendanceVerified: Boolean,
    attendancePercentage: Number,
    totalActiveTime: Number // seconds
  }],
  
  // Faculty
  facultyEmail: {
    type: String,
    required: true
  },
  facultyName: {
    type: String,
    required: true
  },
  facultyUid: {
    type: Number // Agora UID for faculty
  }
  
}, { timestamps: true });

// Indexes for efficient queries
classSessionSchema.index({ classId: 1, status: 1 });
classSessionSchema.index({ scheduledStartTime: 1, status: 1 });
classSessionSchema.index({ classCode: 1, status: 1 });

module.exports = mongoose.models.ClassSession || mongoose.model('ClassSession', classSessionSchema);
