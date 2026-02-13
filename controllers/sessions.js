const ClassSession = require('../models/ClassSession');
const ClassRoom = require('../models/createclass');
const Whiteboard = require('../models/WhiteboardState');
const ScheduledClass = require('../models/ScheduledClass');
const User = require('../models/user');
const Message = require('../models/Message');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const { loadTemplate, formatDate, formatTime, formatISO } = require('../utils/emailService');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Email Helper (Local) - kept for backward compatibility if used elsewhere
const sendEmail = async (to, subject, html) => {
  try {
    if(!to || to.length === 0) return;
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
    console.log(`📧 Sent: ${subject}`);
  } catch (e) {
    console.error('Email error:', e);
  }
};

// Agora credentials from environment
const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

// ===============================================
// Generate Agora RTC Token
// ===============================================
function generateAgoraToken(channelName, uid, role = 'student') {
  if (!APP_ID) {
    throw new Error('Agora App ID not configured');
  }

  // If no certificate, assume App ID only mode (insecure but common for dev)
  if (!APP_CERTIFICATE) {
    console.warn('âš ï¸ Agora App Certificate missing. Using App ID only mode (token = null).');
    return null;
  }

  const userRole = role === 'faculty' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expirationTimeInSeconds = 3600; // 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    userRole,
    privilegeExpiredTs
  );

  return token;
}

// ===============================================
// 0. Create/Start Session (Faculty)
// ===============================================
exports.createSession = async (req, res) => {
  try {
    const { classId, facultyEmail, facultyName, sessionTitle, duration } = req.body;

    // Check for existing LIVE session for this class
    const existingSession = await ClassSession.findOne({ 
      classId, 
      status: 'LIVE',
      scheduledEndTime: { $gt: new Date() } // Not expired
    });

    if (existingSession) {
      return res.json({
        sessionId: existingSession._id,
        isNew: false,
        message: 'Resuming existing active session'
      });
    }

    // Check for recently ENDED session (within last 10 minutes) and restart it
    const recentlyEndedSession = await ClassSession.findOne({
      classId,
      status: 'ENDED',
      actualEndTime: { $gt: new Date(Date.now() - 10 * 60000) } // Ended within last 10 minutes
    }).sort({ actualEndTime: -1 }); // Get most recent

    if (recentlyEndedSession) {
      // Restart the existing session instead of creating a new one
      recentlyEndedSession.status = 'LIVE';
      recentlyEndedSession.actualStartTime = new Date();
      recentlyEndedSession.actualEndTime = null;
      recentlyEndedSession.scheduledEndTime = new Date(Date.now() + (duration || 60) * 60000);
      recentlyEndedSession.participants = []; // Clear old participants
      recentlyEndedSession.facultyUid = null; // Will be set on validation
      
      await recentlyEndedSession.save();
      
      console.log(`ðŸ”„ Restarted session ${recentlyEndedSession._id} for class ${classId}`);
      
      return res.json({
        sessionId: recentlyEndedSession._id,
        isNew: false,
        message: 'Restarted previous session'
      });
    }

    // Create new session only if no recent session exists
    const newSession = new ClassSession({
      classId,
      classCode: req.body.classCode, // Ensure classCode is passed or looked up
      sessionTitle: sessionTitle || 'Live Class',
      scheduledStartTime: new Date(),
      scheduledEndTime: new Date(Date.now() + (duration || 60) * 60000), // Default 60 mins
      duration: duration || 60,
      status: 'LIVE',
      facultyEmail,
      facultyName,
      participants: [],
      actualStartTime: new Date()
    });

    await newSession.save();

    // [NEW] Hook: Check for Scheduled Class and Update Status
    const now = new Date();
    const windowStart = new Date(now.getTime() - 20 * 60000);
    const windowEnd = new Date(now.getTime() + 20 * 60000);

    const scheduledClass = await ScheduledClass.findOne({
        classId,
        status: 'scheduled',
        scheduledTime: { $gte: windowStart, $lte: windowEnd }
    });

    if (scheduledClass) {
        scheduledClass.status = 'live';
        await scheduledClass.save();
        console.log(`✅ Linked to Scheduled Class: ${scheduledClass._id}`);

        // Send "Class Started" Email
        const classDetails = await ClassRoom.findById(classId);
        if (classDetails && classDetails.students.length > 0) {
            
            const startTime = new Date();
            const emailVariables = {
                ORBIT_LOGO_URL: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
                BANNER_URL: 'https://img.freepik.com/free-vector/webinar-concept-illustration_114360-4764.jpg', // Professional Live Class Banner
                FACULTY_NAME: facultyName,
                CLASS_NAME: classDetails.className,
                DATE: formatDate(startTime),
                TIME: formatTime(startTime),
                START_ISO: formatISO(startTime),
                END_ISO: formatISO(new Date(startTime.getTime() + 60*60000)), // Default 1 hour
                JOIN_LINK: `https://orbit-zqsz.vercel.app/`, 
                STUDENT_NAME: 'Student'
            };

            const emailPromises = classDetails.students.map(student => {
                 const personalVariables = { ...emailVariables, STUDENT_NAME: student.studentName };
                 const html = loadTemplate('classStarted', personalVariables);

                 return transporter.sendMail({
                    from: `"Orbit Class Scheduler" <${process.env.EMAIL_USER}>`,
                    to: student.studentEmail,
                    subject: `Class Started – ${classDetails.className} 🚀`,
                    html: html
                });
            });

            Promise.all(emailPromises).catch(err => console.error('Error sending start emails:', err));
        }
    }

    return res.json({
      sessionId: newSession._id,
      isNew: true,
      message: 'New session started'
    });

  } catch (error) {
    console.error('Create session error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ===============================================
// 0.5. Get Active Session (Student)
// ===============================================
exports.getActiveSession = async (req, res) => {
  try {
    const { classId } = req.params;

    const session = await ClassSession.findOne({ 
      classId, 
      status: 'LIVE',
      scheduledEndTime: { $gt: new Date() }
    });

    if (!session) {
      console.log(`âŒ No active session found for class: ${classId}`);
      return res.json({ active: false });
    }

    console.log(`âœ… Active session found: ${session._id}, Status: ${session.status}`);
    return res.json({ 
      active: true, 
      sessionId: session._id,
      sessionTitle: session.sessionTitle
    });

  } catch (error) {
    console.error('Get active session error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ===============================================
// 1. Validate Session (Before Joining)
// ===============================================
exports.validateSession = async (req, res) => {
  const { sessionId } = req.params; // Get sessionId from URL params
  const { email, role, deviceId } = req.body; // Get other data from request body
  console.log(`\n========================================`);
  console.log(`ðŸ“¥ VALIDATE SESSION REQUEST`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Email: ${email}`);
  console.log(`Role: ${role}`);
  console.log(`Email: ${email}`);
  console.log(`Role: ${role}`);
  console.log(`========================================`);

  const APP_ID = process.env.AGORA_APP_ID;
  const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

  console.log(`🔍 [ValidateSession] Checking Agora Config...`);
  console.log(`🆔 App ID: ${APP_ID ? '✅ Loaded' : '❌ MISSING'} ${APP_ID ? '(' + APP_ID.substring(0, 5) + '...)' : ''}`);
  console.log(`🔑 App Cert: ${APP_CERTIFICATE ? '✅ Loaded' : '❌ MISSING'}`);

  if (!APP_ID || !APP_CERTIFICATE) {
      console.error("❌ CRTICAL: Agora App ID or Certificate is missing in environment variables!");
      return res.status(500).json({ 
          isValid: false, 
          error: "Server configuration error: Agora credentials missing" 
      });
  }
  
  try {
    // DEV BYPASS: Allow 'test' session for local verification
    if (sessionId === 'test') {
        const uid = Math.floor(Math.random() * 100000);
        return res.json({
            isValid: true,
            token: null, // Null token triggers AppID-only mode (insecure but works for test)
            screenToken: null,
            screenUid: Number(uid) + 1000000,
            sessionId: 'test',
            channelName: 'test_channel',
            uid: uid,
            appId: APP_ID,
            remainingTime: 3600
        });
    }

    // Validate ObjectId to prevent CastError
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
         return res.status(400).json({ 
             isValid: false, 
             reason: 'Invalid Session ID format' 
         });
    }

    console.log(`[Validation] Checking Session: ${sessionId}, Email: ${email}`);
    // Find session
    const session = await ClassSession.findById(sessionId);
    if (!session) {
      console.log('[Validation] Session not found');
      return res.status(404).json({ 
        isValid: false, 
        reason: 'Session not found' 
      });
    }

    console.log(`[Validation] Session Status: ${session.status}, Expires: ${session.scheduledEndTime}`);

    // Check if session is LIVE or being restarted by faculty
    if (session.status !== 'LIVE') {
      if (role === 'faculty' && (session.status === 'SCHEDULED' || session.status === 'ENDED')) {
         // Allow Faculty to enter to start/restart the class
         console.log(`[Validation] Allowed Faculty to ${session.status === 'ENDED' ? 'RESTART' : 'START'} session`);
      } else if (role === 'student' && session.status === 'ENDED') {
         // Student trying to join ended session - check if there's an active session for this class
         console.log(`[Validation] Student trying to join ENDED session. Checking for active session...`);
         
         const activeSession = await ClassSession.findOne({
           classId: session.classId,
           status: 'LIVE',
           scheduledEndTime: { $gt: new Date() }
         });
         
         if (activeSession) {
           // Redirect student to the active session
           console.log(`[Validation] âœ… Found active session ${activeSession._id}, redirecting student`);
           return res.json({
             isValid: false,
             redirect: true,
             newSessionId: activeSession._id.toString(),
             reason: 'Redirecting to active session'
           });
         } else {
           console.log(`[Validation] Failed: Session is ENDED and no active session found`);
           return res.status(403).json({ 
             isValid: false, 
             reason: 'Session has ended' 
           });
         }
      } else {
          console.log(`[Validation] Failed: Status is ${session.status}`);
          return res.status(403).json({ 
            isValid: false, 
            reason: `Session is ${session.status.toLowerCase()}` 
          });
      }
    }

    // Check time window - REMOVED strictly to allow faculty to extend
    // const now = new Date();
    // if (now > session.scheduledEndTime) { ... }

    // Verify user enrollment (for students)
    if (role === 'student') {
      const classData = await ClassRoom.findById(session.classId);
      const isEnrolled = classData.students.some(s => s.studentEmail === email);
      
      if (!isEnrolled) {
        return res.status(403).json({ 
          isValid: false, 
          reason: 'You are not enrolled in this class' 
        });
      }
    }

    // Verify single-device (check activeSession)
    /*
    const user = await User.findOne({ email });
    if (user && user.activeSession) {
      if (user.activeSession.deviceId !== deviceId) {
        return res.status(403).json({ 
          isValid: false, 
          reason: 'You are logged in on another device' 
        });
      }
    }
    */
    const user = await User.findOne({ email }); // Keep user fetch for later usage

    // Generate Agora token
    const uid = Math.floor(Math.random() * 100000);
    const token = generateAgoraToken(sessionId, uid, role);

    // **AUTO-SET FACULTY UID AND START SESSION**
    if (role === 'faculty') {
      // If session was ENDED, reset it for a fresh start
      if (session.status === 'ENDED') {
        session.participants = []; // Clear old participants
        session.actualEndTime = null; // Clear end time
        console.log(`ðŸ”„ Restarting ENDED session...`);
      }
      
      // END any other LIVE sessions for this class (prevent multiple LIVE sessions)
      try {
        const otherLiveSessions = await ClassSession.updateMany(
          { 
            classId: session.classId, 
            _id: { $ne: session._id }, // Not this session
            status: 'LIVE' 
          },
          { 
            $set: { 
              status: 'ENDED', 
              actualEndTime: new Date() 
            } 
          }
        );
        if (otherLiveSessions.modifiedCount > 0) {
          console.log(`ðŸ›‘ Ended ${otherLiveSessions.modifiedCount} other LIVE session(s) for this class`);
        }
      } catch(e) {
        console.error('âš ï¸ Failed to end other sessions:', e);
      }
      
      session.facultyUid = uid;
      session.status = 'LIVE';
      session.actualStartTime = new Date();
      
      try {
        await session.save(); // Save faculty UID immediately
        console.log(`ðŸš€ Faculty validated. UID: ${uid}, Status: LIVE`);
        console.log(`âœ… Faculty UID saved to database: ${session.facultyUid}`);
        
        // Verify it was saved by re-fetching
        const verifySession = await ClassSession.findById(sessionId);
        console.log(`ðŸ” Verification - Faculty UID in DB: ${verifySession.facultyUid}`);
      } catch (saveError) {
        console.error(`âŒ FAILED to save faculty UID:`, saveError);
        throw saveError;
      }
    }

    // Add participant if not already present
    const existingParticipant = session.participants.find(p => p.email === email);
    if (!existingParticipant) {
      session.participants.push({
        email,
        name: user ? user.fullName : 'User',
        role,
        joinedAt: new Date(),
        rejoinCount: 0,
        rejoinSessions: [],
        uid: uid // STORE UID
      });
      await session.save();
    } else {
      // Update existing participant's UID if changed
      existingParticipant.uid = uid;
      await session.save();
    }

    const now = new Date(); // Define 'now' here
    
    // Generate Screen Share Token for Faculty
    let screenToken = null;
    let screenUid = null;
    if(role === 'faculty') {
        screenUid = Number(uid) + 1000000;
        screenToken = generateAgoraToken(sessionId, screenUid, role);
        console.log(`ðŸ–¥ï¸ Generated Screen Token for UID: ${screenUid}`);
    }

    const validationResponse = {
      isValid: true,
      token,
      screenToken, // Return screen token
      screenUid,
      sessionId,
      channelName: sessionId,
      uid,
      appId: APP_ID,
      remainingTime: session.scheduledEndTime - now
    };
    
    console.log(`âœ… Validation successful for ${role}: ${email}`);
    console.log(`   APP_ID: ${APP_ID ? APP_ID : 'MISSING!'}`);
    console.log(`   UID: ${uid}`);
    console.log(`   Token: ${token ? 'Generated' : 'NULL'}`);
    
    return res.json(validationResponse);

  } catch (error) {
    console.error('Validate session error:', error);
    return res.status(500).json({ 
      isValid: false, 
      error: error.message || 'Server error',
      reason: error.message || 'Server error'
    });
  }
};

// ===============================================
// 2. Rejoin Session (After Network Failure)
// ===============================================
exports.rejoinSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email, deviceId } = req.body;

    // Find session
    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ 
        canRejoin: false, 
        error: 'Session not found' 
      });
    }

    // Check if session is still LIVE
    if (session.status !== 'LIVE') {
      return res.status(403).json({ 
        canRejoin: false, 
        error: 'Session has ended' 
      });
    }

    // Check time window - REMOVED strict check
    const now = new Date();
    // if (now > session.scheduledEndTime) { ... }

    // Validate same device
    /*
    const user = await User.findOne({ email });
    if (!user || !user.activeSession || user.activeSession.deviceId !== deviceId) {
      return res.status(403).json({ 
        canRejoin: false, 
        error: 'Different device detected' 
      });
    }
    */

    // Check if user was in session before
    const participant = session.participants.find(p => p.email === email);
    if (!participant) {
      return res.status(403).json({ 
        canRejoin: false, 
        error: 'Not a participant' 
      });
    }

    // Generate new token
    const uid = Math.floor(Math.random() * 100000);
    const token = generateAgoraToken(sessionId, uid, participant.role);

    // Update rejoin tracking
    participant.lastRejoinAt = new Date();
    participant.rejoinCount = (participant.rejoinCount || 0) + 1;
    participant.rejoinSessions.push({
      rejoinedAt: new Date()
    });
    participant.uid = uid; // Update UID on rejoin
    await session.save();

    return res.json({
      canRejoin: true,
      token,
      sessionId,
      channelName: sessionId,
      uid,
      appId: APP_ID,
      remainingTime: session.scheduledEndTime - now
    });

  } catch (error) {
    console.error('Rejoin error:', error);
    return res.status(500).json({ 
      canRejoin: false, 
      error: 'Server error' 
    });
  }
};

// ===============================================
// 3. Get Session Status
// ===============================================
exports.getSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch Class details to get facultyEmail and className
    let facultyEmail = session.facultyEmail; // Try session first
    let className = session.sessionTitle || 'Live Class';
    let classCode = session.classCode || '';
    let facultyName = session.facultyName || '';
    
    if (session.classId) {
      try {
        // const Class = require('../models/createclass'); // REMOVED
        const classDoc = await ClassRoom.findById(session.classId);
        if (classDoc) {
          facultyEmail = classDoc.facultyEmail; // Use class facultyEmail (more reliable)
          className = classDoc.className || className;
          classCode = classDoc.classCode || classCode;
          facultyName = classDoc.facultyName || facultyName;
          console.log(`âœ… Fetched from Class: facultyEmail=${facultyEmail}, className=${className}, classCode=${classCode}, facultyName=${facultyName}`);
        }
      } catch (err) {
        console.warn('âš ï¸ Failed to fetch class details:', err.message);
      }
    }

    const responseData = {
      status: session.status,
      scheduledStartTime: session.scheduledStartTime,
      scheduledEndTime: session.scheduledEndTime,
      actualStartTime: session.actualStartTime,
      actualEndTime: session.actualEndTime,
      participantCount: session.participants.length,
      facultyEmail: facultyEmail,
      className: className,
      classCode: classCode,
      facultyName: facultyName,
      facultyUid: session.facultyUid, // Return stored faculty UID
      presentationMode: session.presentationMode || { isActive: false, type: null },
      participants: session.participants.map(p => ({
        email: p.email,
        uid: p.uid,
        role: p.role,
        name: p.name
      }))
    };
    
    console.log('ðŸ“Š getSessionStatus response:', {
      sessionId,
      facultyEmail: responseData.facultyEmail,
      facultyUid: responseData.facultyUid,
      participantCount: responseData.participants.length
    });
    
    return res.json(responseData);

  } catch (error) {
    console.error('Get status error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ===============================================
// 4. Session Heartbeat (Attendance Tracking)
// ===============================================
exports.sessionHeartbeat = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email, timestamp, role } = req.body;

    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update participant's last activity
    const participant = session.participants.find(p => p.email === email);
    if (participant) {
      participant.lastActivity = new Date(timestamp);
    }

    await session.save();

    return res.json({ ok: true });

  } catch (error) {
    console.error('Heartbeat error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ===============================================
// 5.5. Start Session (Faculty Only)
// ===============================================
exports.startSession = async (req, res) => {
  console.log('ðŸ“¥ START SESSION called:', req.params, req.body);
  try {
    const { sessionId } = req.params;
    const { email, facultyUid } = req.body; // Accept facultyUid

    const session = await ClassSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.facultyEmail !== email) {
      return res.status(403).json({ error: 'Only faculty can start session' });
    }

    session.status = 'LIVE';
    session.actualStartTime = new Date();
    session.facultyUid = facultyUid; // Store NEW faculty UID (overwrites old if exists)
    
    // Clear participants from previous session if restarting
    if(session.participants && session.participants.length > 0) {
      console.log(`ðŸ—‘ï¸ Clearing ${session.participants.length} old participants from previous session`);
      session.participants = [];
    }
    
    await session.save();
    
    console.log(`ðŸš€ Session started. Faculty UID: ${facultyUid}`);

    return res.json({ success: true, message: 'Class is now LIVE', startTime: session.actualStartTime });

  } catch (error) {
    console.error('Start session error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ===============================================
// 5. End Session (Faculty Only)
// ===============================================
exports.endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email, timestamp } = req.body;

    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify faculty
    if (session.facultyEmail !== email) {
      return res.status(403).json({ error: 'Only faculty can end session' });
    }

    // Update session status
    session.status = 'ENDED';
    session.actualEndTime = new Date(timestamp);

    // Calculate attendance for all participants
    let totalAttendancePercent = 0;
    let verifiedCount = 0;

    session.participants.forEach(participant => {
      calculateAttendance(participant, session);
      if (participant.attendanceVerified) {
        verifiedCount++;
      }
      totalAttendancePercent += (participant.attendancePercentage || 0);
    });

    // Fetch Class details for total enrolled count
    try {
        const classDoc = await ClassRoom.findById(session.classId);
        if (classDoc) {
            session.totalEnrolledStudents = (classDoc.students || []).length;
        }
    } catch (e) {
        console.error("Failed to fetch class for stats:", e);
    }

    session.attendanceCount = verifiedCount;
    session.averageAttendancePercentage = session.participants.length > 0 
        ? Math.round(totalAttendancePercent / session.participants.length) 
        : 0;

    await session.save();

    return res.json({ 
      success: true, 
      message: 'Session ended successfully' 
    });

  } catch (error) {
    console.error('End session error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ===============================================
// 6. Leave Session (Student)
// ===============================================
exports.leaveSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email, timestamp } = req.body;

    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update participant's leave time
    const participant = session.participants.find(p => p.email === email);
    if (participant) {
      participant.leftAt = new Date(timestamp);
      
      // If there are rejoin sessions, update the last one
      if (participant.rejoinSessions.length > 0) {
        const lastRejoin = participant.rejoinSessions[participant.rejoinSessions.length - 1];
        if (!lastRejoin.leftAt) {
          lastRejoin.leftAt = new Date(timestamp);
        }
      }
    }

    await session.save();

    return res.json({ success: true });

  } catch (error) {
    console.error('Leave session error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ===============================================
// Helper: Calculate Attendance
// ===============================================
function calculateAttendance(participant, session) {
  let totalActiveTime = 0;

  // Initial join duration
  if (participant.joinedAt && participant.leftAt) {
    totalActiveTime += (participant.leftAt - participant.joinedAt) / 1000; // seconds
  } else if (participant.joinedAt && !participant.leftAt) {
    // Still in session, calculate up to now
    totalActiveTime += (new Date() - participant.joinedAt) / 1000;
  }

  // Add rejoin durations
  if (participant.rejoinSessions && participant.rejoinSessions.length > 0) {
    participant.rejoinSessions.forEach(rejoin => {
      if (rejoin.rejoinedAt && rejoin.leftAt) {
        totalActiveTime += (rejoin.leftAt - rejoin.rejoinedAt) / 1000;
      } else if (rejoin.rejoinedAt && !rejoin.leftAt) {
        // Still in rejoin session
        totalActiveTime += (new Date() - rejoin.rejoinedAt) / 1000;
      }
    });
  }

  const sessionDuration = session.actualEndTime 
    ? (session.actualEndTime - session.actualStartTime) / 1000
    : (new Date() - session.actualStartTime) / 1000;

  const attendancePercentage = (totalActiveTime / sessionDuration) * 100;

  // Mark as present if attendance >= 75%
  participant.attendanceVerified = attendancePercentage >= 75;
  participant.attendancePercentage = Math.round(attendancePercentage);
  participant.totalActiveTime = Math.round(totalActiveTime);
  participant.duration = Math.round(totalActiveTime);

  return participant;
}

// ===============================================
// 7. Get Messages (Chat)
// ===============================================
exports.getMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { since } = req.query;

    const query = { sessionId };
    if (since) {
      query.timestamp = { $gt: new Date(since) };
    }

    const messages = await Message.find(query).sort({ timestamp: 1 });
    return res.json(messages);

  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ===============================================
// 8. Send Message (Chat)
// ===============================================
exports.sendMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    // Map frontend payload (sender, text, email) to model fields (senderName, content, senderEmail)
    const { sender, senderName, email, senderEmail, text, content, isSystemMessage } = req.body;

    const message = new Message({
      sessionId,
      senderName: sender || senderName,
      senderEmail: email || senderEmail || 'anonymous',
      content: text || content,
      isSystemMessage: isSystemMessage || false
    });

    await message.save();
    return res.json(message);

  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};

// ===============================================
// 9. Get Session Analytics
// ===============================================
exports.getSessionAnalytics = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Process participants
    const participants = session.participants.map(p => {
        // Calculate status
        let status = 'Active';
        if (p.leftAt) status = 'Left';
        // Add more logic if needed
        return {
            name: p.name,
            email: p.email,
            joinedAt: p.joinedAt,
            leftAt: p.leftAt,
            status,
            attendancePercentage: p.attendancePercentage || 0
        };
    });

    return res.json({
        sessionId: session._id,
        title: session.sessionTitle,
        startTime: session.actualStartTime,
        endTime: session.actualEndTime,
        status: session.status,
        participants,
        totalParticipants: participants.length,
        activeParticipants: participants.filter(p => p.status === 'Active').length
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ===============================================
// 10. Get Past Sessions (For Dashboard)
// ===============================================
exports.getPastSessions = async (req, res) => {
  try {
    const { classId } = req.params;
    
    if (!classId || classId === 'undefined') {
        return res.status(400).json({ error: 'Invalid Class ID' });
    }

    // Find all sessions for this class (Ended or Live)
    // Use proper ObjectId conversion check if needed, but mongoose casts auto
    const sessions = await ClassSession.find({ classId })
                                     .sort({ actualStartTime: -1 })
                                     .limit(20); // Limit to last 20
    
    return res.json(sessions.map(s => ({
        sessionId: s._id,
        title: s.sessionTitle,
        startTime: s.actualStartTime,
        endTime: s.actualEndTime,
        duration: s.duration || 0,
        status: s.status,
        participantCount: (s.participants || []).length
    })));

  } catch (error) {
    console.error('Get past sessions error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};

// ===============================================
// 11. Get Student Attendance (Across all classes)
// ===============================================
exports.getStudentAttendance = async (req, res) => {
  try {
    const studentEmail = req.user.email;
    
    // Get all classes the student is enrolled in
    const enrolledClasses = await ClassRoom.find({
      'students.studentEmail': studentEmail
    }).select('className classCode subject facultyName');

    // Get all ended sessions where student was a participant
    const allSessions = await ClassSession.find({
      status: 'ENDED',
      'participants.email': studentEmail
    }).sort({ actualStartTime: -1 });

    // Calculate overall stats
    let totalSessions = 0;
    let attendedSessions = 0;

    // Group sessions by class
    const classwiseAttendance = [];

    for (const classInfo of enrolledClasses) {
      const classSessions = allSessions.filter(
        session => session.classId.toString() === classInfo._id.toString()
      );

      if (classSessions.length === 0) {
        // Include class even if no sessions yet
        classwiseAttendance.push({
          classId: classInfo._id,
          className: classInfo.className,
          classCode: classInfo.classCode,
          subject: classInfo.subject || 'N/A',
          facultyName: classInfo.facultyName,
          totalSessions: 0,
          attendedSessions: 0,
          attendanceRate: 0,
          sessions: []
        });
        continue;
      }

      let classAttended = 0;
      const sessionDetails = [];

      for (const session of classSessions) {
        const participant = session.participants.find(
          p => p.email === studentEmail
        );

        if (participant) {
          totalSessions++;
          // Use verified flag OR calculate if missing
          let attended = participant.attendanceVerified || false;
          let timeSpent = participant.totalActiveTime || 0;
          let attendancePercentage = participant.attendancePercentage || 0;
          
          // Fallback calculation if data is missing
          const sessionDuration = session.actualEndTime && session.actualStartTime
            ? (new Date(session.actualEndTime) - new Date(session.actualStartTime)) / 1000
            : (session.duration || 60) * 60;
            
          if (timeSpent === 0 && participant.joinedAt && participant.leftAt) {
             timeSpent = (new Date(participant.leftAt) - new Date(participant.joinedAt)) / 1000;
             attendancePercentage = Math.round((timeSpent / sessionDuration) * 100);
             attended = attendancePercentage >= 75;
          }

          if (attended) {
            attendedSessions++;
            classAttended++;
          }
          
          // Percentage of time spent in session
          const timeSpentPercentage = sessionDuration > 0
            ? Math.round((timeSpent / sessionDuration) * 100)
            : 0;

          sessionDetails.push({
            sessionId: session._id,
            sessionTitle: session.sessionTitle,
            date: session.actualStartTime || session.scheduledStartTime,
            duration: Math.round(sessionDuration / 60), // minutes
            timeSpent: Math.round(timeSpent / 60), // minutes
            timeSpentPercentage: timeSpentPercentage,
            attended: attended,
            attendancePercentage: attendancePercentage
          });
        }
      }

      const classAttendanceRate = classSessions.length > 0
        ? Math.round((classAttended / classSessions.length) * 100)
        : 0;

      classwiseAttendance.push({
        classId: classInfo._id,
        className: classInfo.className,
        classCode: classInfo.classCode,
        subject: classInfo.subject || 'N/A',
        facultyName: classInfo.facultyName,
        totalSessions: classSessions.length,
        attendedSessions: classAttended,
        attendanceRate: classAttendanceRate,
        sessions: sessionDetails
      });
    }

    const overallAttendanceRate = totalSessions > 0
      ? Math.round((attendedSessions / totalSessions) * 100)
      : 0;

    res.json({
      success: true,
      overallStats: {
        totalSessions,
        attendedSessions,
        attendanceRate: overallAttendanceRate
      },
      classwiseAttendance
    });

  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance data',
      error: error.message
    });
  }
};

module.exports = exports;
