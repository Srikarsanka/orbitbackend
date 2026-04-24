const AttendanceInterval = require('../models/AttendanceInterval');
const SessionAttendance = require('../models/SessionAttendance');
const ClassSession = require('../models/ClassSession');
const Class = require('../models/createclass');
const User = require('../models/user');
const { decryptEmbedding } = require('../utils/embeddingCrypto');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

/**
 * Attendance Service
 * Core business logic for attendance tracking and calculations
 */

/**
 * Verify face and record attendance interval
 * @param {Object} data - Attendance capture data
 * @returns {Promise<Object>} - Verification result and saved interval
 */
async function verifyAndRecordAttendance(data) {
  const {
    sessionId,
    participantEmail,
    participantName,
    intervalNumber,
    photoBase64
  } = data;

  let matchResult = false;
  let faceDetected = false;
  let confidence = 0;
  let error = null;

  try {
    // 1. Get User and Stored Embedding
    const user = await User.findOne({ email: participantEmail });
    if (!user) {
      throw new Error(`User not found: ${participantEmail}`);
    }

    if (!user.faceEmbedding) {
      throw new Error('No face embedding found for user');
    }

    // Decrypt stored embedding
    let storedEmbedding;
    if (typeof user.faceEmbedding === 'string') {
      storedEmbedding = decryptEmbedding(user.faceEmbedding);
    } else if (Array.isArray(user.faceEmbedding)) {
      storedEmbedding = user.faceEmbedding;
    } else {
      throw new Error('Invalid stored embedding format');
    }

    // 2. Call Python API for new embedding
    if (!photoBase64) {
      throw new Error('No photo data provided');
    }

    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const form = new FormData();
    form.append("file", buffer, {
      filename: "verify.jpg",
      contentType: "image/jpeg",
    });

    const pyRes = await fetch("http://localhost:8000/encode", {
      method: "POST",
      body: form,
    });

    const pyOut = await pyRes.json();

    if (!pyOut || pyOut.error || !pyOut.embedding) {
      faceDetected = false;
      error = pyOut.error || 'No face detected';
    } else {
      faceDetected = true;
      const newEmbedding = pyOut.embedding;

      // 3. Compare Embeddings
      if (newEmbedding.length !== storedEmbedding.length) {
        throw new Error(`Embedding length mismatch: ${newEmbedding.length} vs ${storedEmbedding.length}`);
      }

      const distance = Math.sqrt(
        newEmbedding.reduce(
          (sum, v, i) => sum + (v - storedEmbedding[i]) * (v - storedEmbedding[i]),
          0
        )
      );

      // Threshold same as video verification (0.85)
      // Lower distance = better match
      const THRESHOLD = 0.85; 
      matchResult = distance <= THRESHOLD;
      
      // Convert distance to confidence (approximate)
      // distance 0 -> confidence 1
      // distance 1.0 -> confidence 0
      confidence = Math.max(0, 1 - distance);
    }

  } catch (err) {
    console.error('Attendance Verification Error:', err.message);
    error = err.message;
    // If error is technical, we might want to record it but not fail the request entirely?
    // For now, we'll record the interval as failed
  }

  // 4. Record Interval
  return recordAttendanceInterval({
    sessionId,
    participantEmail,
    participantName,
    intervalNumber,
    faceDetected,
    matchResult,
    confidence,
    error
  });
} 

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
    
    // Filter out faculty members - only count students
    // Handle both old records (no participantRole field) and new records
    const studentRecords = attendanceRecords.filter(a => 
      !a.participantRole || a.participantRole === null || a.participantRole === 'student'
    );
    
    // Calculate statistics (only for students)
    const totalParticipants = studentRecords.length;
    const presentCount = studentRecords.filter(a => a.status === 'present').length;
    const absentCount = studentRecords.filter(a => a.status === 'absent').length;
    const partialCount = studentRecords.filter(a => a.status === 'partial').length;
    
    const averageAttendance = totalParticipants > 0
      ? studentRecords.reduce((sum, a) => sum + a.attendancePercentage, 0) / totalParticipants
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
      participants: studentRecords // Return only student records
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

/**
 * Get aggregated attendance analytics for a faculty member
 * @param {String} facultyEmail - Faculty email
 * @returns {Promise<Object>} - Aggregated analytics
 */
async function getFacultyAttendanceAnalytics(facultyEmail) {
  try {
    // 1. Find all sessions for this faculty
    const sessions = await ClassSession.find({ facultyEmail });
    
    if (!sessions || sessions.length === 0) {
      return {
        totalSessions: 0,
        totalHours: 0,
        averageAttendance: 0,
        totalStudents: 0,
        sessions: []
      };
    }
    
    // 2. Get summaries for each session (parallel)
    const sessionSummaries = await Promise.all(
        sessions.map(async (session) => {
            try {
                // Determine actual duration based on attendance tracking window
                let durationMinutes = 0;
                if (session.attendanceConfig && session.attendanceConfig.startTime) {
                    const start = new Date(session.attendanceConfig.startTime);
                    // Use explicitly locked endTime if available, otherwise use current time or actualEndTime
                    const end = session.attendanceConfig.endTime ? new Date(session.attendanceConfig.endTime) : 
                                (session.actualEndTime ? new Date(session.actualEndTime) : new Date());
                    durationMinutes = Math.round((end - start) / 60000);
                } else if (session.duration) {
                     durationMinutes = session.duration;
                }
                
                const summary = await getSessionAttendanceSummary(session._id);
                return {
                    ...summary,
                    _id: session._id, // Ensure ID is passed
                    startTime: session.attendanceConfig?.startTime || session.createdAt,
                    className: session.className,
                    classCode: session.classCode,
                    duration: durationMinutes,
                    totalStudents: summary.totalParticipants, // Use attendance records as source of truth for "active" students
                    studentsPresent: summary.presentCount,
                    attendanceRate: summary.averageAttendance
                };
            } catch (e) {
                console.warn(`Error processing session ${session._id}:`, e.message);
                return null;
            }
        })
    );
    
    // Filter out failed sessions
    const validSummaries = sessionSummaries.filter(s => s !== null);
    
    // 3. Aggregate Data
    const totalSessions = validSummaries.length;
    const totalHours = Math.round(validSummaries.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);
    
    // Calculate global average attendance
    const avgAttendance = totalSessions > 0
        ? Math.round(validSummaries.reduce((sum, s) => sum + s.averageAttendance, 0) / totalSessions)
        : 0;
        
    // Calculate total unique students (approximate via sum of session participants for now, or could query DB)
    // For simplicity, we'll sum up "totalParticipants" from sessions, although this counts duplicates across sessions. 
    // A better metric might be "Student Engagements"
    const totalStudentEngagements = validSummaries.reduce((sum, s) => sum + s.totalParticipants, 0);

    return {
        totalSessions,
        totalHours,
        averageAttendance: avgAttendance,
        totalStudents: totalStudentEngagements, // Labelled as Student Engagements in UI context potentially
        sessions: validSummaries
    };

  } catch (err) {
    console.error('Error getting faculty analytics:', err);
    throw err;
  }
}

/**
 * Get detailed class-level analytics with per-student attendance breakdown
 * @param {String} classId - Class ID
 * @returns {Promise<Object>} - Class analytics with student attendance details
 */
async function getClassAnalytics(classId) {
  try {
    // 1. Get class information
    const classInfo = await Class.findById(classId);
    if (!classInfo) {
      throw new Error('Class not found');
    }

    // 2. Get all ENDED sessions for this class
    const sessions = await ClassSession.find({
      classId,
      status: 'ENDED'
    }).sort({ actualStartTime: -1 });

    if (!sessions || sessions.length === 0) {
      return {
        success: true,
        classInfo: {
          className: classInfo.className,
          classCode: classInfo.classCode,
          totalSessions: 0,
          averageAttendance: 0
        },
        studentAttendance: []
      };
    }

    // 3. Get all students enrolled in the class
    const students = classInfo.students || [];
    
    console.log('=== CLASS ANALYTICS DEBUG ===');
    console.log('Class ID:', classId);
    console.log('Class Name:', classInfo.className);
    console.log('Total Students:', students.length);
    console.log('Total Sessions:', sessions.length);
    console.log('Sample Student:', students[0]);
    
    // 4. Build student attendance map
    const studentAttendanceMap = new Map();
    
    for (const student of students) {
      studentAttendanceMap.set(student.studentEmail, {
        studentName: student.studentName,
        studentEmail: student.studentEmail,
        totalSessions: sessions.length,
        attendedSessions: 0,
        absentSessions: 0,
        sessionDetails: []
      });
    }

    // 5. Process each session and update student records
    for (const session of sessions) {
      // Get attendance records for this session (students only, faculty excluded)
      // Handle both old records (no participantRole field) and new records
      const attendanceRecords = await SessionAttendance.find({
        sessionId: session._id,
        $or: [
          { participantRole: { $exists: false } }, // Old records without the field
          { participantRole: null }, // Records with null value
          { participantRole: 'student' } // New records explicitly marked as student
        ]
      });

      console.log(`\nSession: ${session.sessionTitle}`);
      console.log('Attendance Records Count:', attendanceRecords.length);
      if (attendanceRecords.length > 0) {
        console.log('Sample Attendance Record:', {
          participantEmail: attendanceRecords[0].participantEmail,
          participantName: attendanceRecords[0].participantName,
          status: attendanceRecords[0].status,
          participantRole: attendanceRecords[0].participantRole
        });
      }

      // Create a map of who attended this session
      const attendedEmails = new Set(
        attendanceRecords
          .filter(a => a.status === 'present')
          .map(a => a.participantEmail)
      );
      
      console.log('Attended Emails:', Array.from(attendedEmails));

      // Update each student's record
      for (const student of students) {
        const studentData = studentAttendanceMap.get(student.studentEmail);
        if (!studentData) continue;

        const attended = attendedEmails.has(student.studentEmail);
        const attendanceRecord = attendanceRecords.find(a => a.participantEmail === student.studentEmail);

        if (attended) {
          studentData.attendedSessions++;
        } else {
          studentData.absentSessions++;
        }

        studentData.sessionDetails.push({
          sessionId: session._id,
          sessionTitle: session.sessionTitle,
          date: session.actualStartTime || session.scheduledStartTime,
          attended: attended,
          attendancePercentage: attendanceRecord ? attendanceRecord.attendancePercentage : 0,
          status: attendanceRecord ? attendanceRecord.status : 'absent'
        });
      }
    }

    // 6. Calculate attendance rates and convert map to array
    const studentAttendance = Array.from(studentAttendanceMap.values()).map(student => ({
      ...student,
      attendanceRate: student.totalSessions > 0
        ? Math.round((student.attendedSessions / student.totalSessions) * 100)
        : 0
    })).sort((a, b) => b.attendanceRate - a.attendanceRate); // Sort by attendance rate descending

    // 7. Calculate class average attendance
    const totalAttendanceRate = studentAttendance.reduce((sum, s) => sum + s.attendanceRate, 0);
    const averageAttendance = studentAttendance.length > 0
      ? Math.round(totalAttendanceRate / studentAttendance.length)
      : 0;

    return {
      success: true,
      classInfo: {
        className: classInfo.className,
        classCode: classInfo.classCode,
        subject: classInfo.subject,
        totalSessions: sessions.length,
        averageAttendance: averageAttendance,
        totalStudents: students.length
      },
      studentAttendance
    };

  } catch (err) {
    console.error('Error getting class analytics:', err);
    throw err;
  }
}

module.exports = {
  verifyAndRecordAttendance,
  recordAttendanceInterval,
  updateSessionAttendance,
  getSessionAttendanceSummary,
  getParticipantAttendance,
  calculateExpectedIntervals,
  getFacultyAttendanceAnalytics,
  getClassAnalytics
};
