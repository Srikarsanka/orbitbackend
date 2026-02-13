const mongoose = require('mongoose');

const scheduledClassSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  facultyId: { type: String, required: true }, // Using String to match other models if ObjectId not strictly used
  className: { type: String, required: true },
  classCode: { type: String, required: true },
  scheduledTime: { type: Date, required: true },
  duration: { type: Number, default: 60 }, // minutes
  status: { 
    type: String, 
    enum: ['scheduled', 'live', 'completed', 'cancelled'], 
    default: 'scheduled' 
  },
  reminderSent: { type: Boolean, default: false },
  meetingLink: { type: String } // Optional, for direct join links
}, { timestamps: true });

module.exports = mongoose.models.ScheduledClass || mongoose.model('ScheduledClass', scheduledClassSchema);
