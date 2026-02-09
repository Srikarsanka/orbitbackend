const express = require('express');
const router = express.Router();
const sessionsController = require('../controllers/sessions');
const auth = require('../middleware/auth');

console.log('📦 Sessions routes loaded');

// Create/Start session
router.post('/create', sessionsController.createSession);

// Get active session for a class
router.get('/active/:classId', sessionsController.getActiveSession);

// Session validation (before joining)
router.post('/:sessionId/validate', sessionsController.validateSession);

// Rejoin session (after network failure)
router.post('/:sessionId/rejoin', sessionsController.rejoinSession);

// Get session status
router.get('/:sessionId/status', sessionsController.getSessionStatus);

// Session heartbeat (attendance tracking)
router.post('/:sessionId/heartbeat', sessionsController.sessionHeartbeat);

// Start session (faculty only)
router.post('/:sessionId/start', sessionsController.startSession);

// End session (faculty only)
router.post('/:sessionId/end', sessionsController.endSession);

// Leave session (student)
router.post('/:sessionId/leave', sessionsController.leaveSession);

// Chat: Get messages
router.get('/:sessionId/messages', sessionsController.getMessages);

// Chat: Send message
router.post('/:sessionId/messages', sessionsController.sendMessage);

// Session Analytics
router.get('/:sessionId/analytics', sessionsController.getSessionAnalytics);

// Past Sessions (Dashboard)
router.get('/:classId/past_sessions', sessionsController.getPastSessions);

// Student Attendance (All Classes)
router.get('/attendance/student', auth, sessionsController.getStudentAttendance);

module.exports = router;
