const AttendanceInterval = require('../models/AttendanceInterval');
const SessionAttendance = require('../models/SessionAttendance');
const ClassSession = require('../models/ClassSession');

/**
 * Attendance Service
 * Core business logic for attendance tracking and calculations
 */

/**
 * Record an attendance interval capture
 * @param {Object} data - Attendance capture data
 * @returns {Promise<Object>} - Saved interval record
 */
async function recordAttendanceInterval(data) {
  const {
    sessionId,
    participantEmail,
    participantName,
    intervalNumber,
    faceDetected,
    matchResult,
    confidence,
    error
  } = data;
  
  try {
    // Create interval record
    const interval = new AttendanceInterval({
      sessionId,
      participantEmail,
      participantName,
      intervalNumber,
      timestamp: new Date(),
      faceDetected,
      matchResult,
      confidence,
      error
    });
    
    await interval.save();
    
    // Update session attendance summary
    await updateSessionAttendance(sessionId, participantEmail, participantName);
    
    return interval;
  } catch (err) {
    console.error('Error recording attendance interval:', err);
    throw err;
  }
}

/**
 * Update session attendance summary for a participant
 * @param {String} sessionId - Session ID
 * @param {String} participantEmail - Participant email
 * @param {String} participantName - Participant name
 */
async function updateSessionAttendance(sessionId, participantEmail, participantName) {
  try {
    // Get session config
    const session = await ClassSession.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Get all intervals for this participant
    const intervals = await AttendanceInterval.find({
      sessionId,
      participantEmail
    }).sort({ intervalNumber: 1 });
    
    const totalIntervals = intervals.length;
    const matchedIntervals = intervals.filter(i => i.matchResult === true).length;
    
    // Find first and last detection
    const detections = intervals.filter(i => i.faceDetected);
    const firstDetection = detections.length > 0 ? detections[0].timestamp : null;
    const lastDetection = detections.length > 0 ? detections[detections.length - 1].timestamp : null;
    
    // Find or create session attendance record
    let attendance = await SessionAttendance.findOne({
      sessionId,
      participantEmail
    });
    
    if (!attendance) {
      attendance = new SessionAttendance({
        sessionId,
        participantEmail,
        participantName,
        captureInterval: session.attendanceConfig.captureInterval,
        threshold: session.attendanceConfig.threshold
      });
    }
    
    // Update statistics
    attendance.totalIntervals = totalIntervals;
    attendance.matchedIntervals = matchedIntervals;
    attendance.firstDetection = firstDetection;
    attendance.lastDetection = lastDetection;
    
    // Calculate attendance percentage and status
    attendance.calculateAttendance();
    
    await attendance.save();
    
    return attendance;
  } catch (err) {
    console.error('Error updating session attendance:', err);
    throw err;
  }
}

/**
 * Get attendance summary for entire session
 * @param {String} sessionId - Session ID
 * @returns {Promise<Object>} - Session attendance summary
 */
async function getSessionAttendanceSummary(sessionId) {
  try {
    const session = await ClassSession.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    const attendanceRecords = await SessionAttendance.find({ sessionId });
    
    // Calculate statistics
    const totalParticipants = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(a => a.status === 'present').length;
    const absentCount = attendanceRecords.filter(a => a.status === 'absent').length;
    const partialCount = attendanceRecords.filter(a => a.status === 'partial').length;
    
    const averageAttendance = totalParticipants > 0
      ? attendanceRecords.reduce((sum, a) => sum + a.attendancePercentage, 0) / totalParticipants
      : 0;
    
    return {
      sessionId,
      sessionTitle: session.sessionTitle,
      totalParticipants,
      presentCount,
      absentCount,
      partialCount,
      averageAttendance: Math.round(averageAttendance * 100) / 100,
      attendanceConfig: session.attendanceConfig,
      participants: attendanceRecords
    };
  } catch (err) {
    console.error('Error getting session attendance summary:', err);
    throw err;
  }
}

/**
 * Get attendance details for a specific participant
 * @param {String} sessionId - Session ID
 * @param {String} participantEmail - Participant email
 * @returns {Promise<Object>} - Participant attendance details
 */
async function getParticipantAttendance(sessionId, participantEmail) {
  try {
    const attendance = await SessionAttendance.findOne({
      sessionId,
      participantEmail
    });
    
    if (!attendance) {
      return null;
    }
    
    // Get all intervals
    const intervals = await AttendanceInterval.find({
      sessionId,
      participantEmail
    }).sort({ intervalNumber: 1 });
    
    return {
      ...attendance.toObject(),
      intervals
    };
  } catch (err) {
    console.error('Error getting participant attendance:', err);
    throw err;
  }
}

/**
 * Calculate expected total intervals for a session
 * @param {Date} startTime - Session start time
 * @param {Date} endTime - Session end time
 * @param {Number} captureInterval - Capture interval in seconds
 * @returns {Number} - Expected total intervals
 */
function calculateExpectedIntervals(startTime, endTime, captureInterval) {
  const durationSeconds = (endTime - startTime) / 1000;
  return Math.floor(durationSeconds / captureInterval);
}

module.exports = {
  recordAttendanceInterval,
  updateSessionAttendance,
  getSessionAttendanceSummary,
  getParticipantAttendance,
  calculateExpectedIntervals
};
