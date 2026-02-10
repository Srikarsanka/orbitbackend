const express = require('express');
const router = express.Router();
const attendanceService = require('../services/attendanceService');
const ClassSession = require('../models/ClassSession');

/**
 * POST /api/attendance/capture
 * Record an attendance interval capture
 * Body: { sessionId, participantEmail, participantName, intervalNumber, faceDetected, matchResult, confidence, error }
 */
router.post('/capture', async (req, res) => {
  try {
    const {
      sessionId,
      participantEmail,
      participantName,
      intervalNumber,
      faceDetected,
      matchResult,
      confidence,
      error
    } = req.body;
    
    // Validation
    if (!sessionId || !participantEmail || !participantName || intervalNumber === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Record interval
    const interval = await attendanceService.recordAttendanceInterval({
      sessionId,
      participantEmail,
      participantName,
      intervalNumber,
      faceDetected: faceDetected || false,
      matchResult: matchResult || false,
      confidence: confidence || 0,
      error
    });
    
    res.json({
      success: true,
      interval,
      message: 'Attendance recorded successfully'
    });
    
  } catch (err) {
    console.error('Error capturing attendance:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/attendance/session/:sessionId
 * Get attendance summary for entire session
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const summary = await attendanceService.getSessionAttendanceSummary(sessionId);
    
    res.json({
      success: true,
      summary
    });
    
  } catch (err) {
    console.error('Error getting session attendance:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/attendance/participant/:sessionId/:participantEmail
 * Get attendance details for specific participant
 */
router.get('/participant/:sessionId/:participantEmail', async (req, res) => {
  try {
    const { sessionId, participantEmail } = req.params;
    
    const attendance = await attendanceService.getParticipantAttendance(
      sessionId,
      decodeURIComponent(participantEmail)
    );
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found'
      });
    }
    
    res.json({
      success: true,
      attendance
    });
    
  } catch (err) {
    console.error('Error getting participant attendance:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * POST /api/attendance/start-tracking
 * Start attendance tracking for a session
 * Body: { sessionId }
 */
router.post('/start-tracking', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Update attendance config
    session.attendanceConfig.startTime = new Date();
    
    // Calculate expected total intervals
    if (session.scheduledEndTime) {
      const totalIntervals = attendanceService.calculateExpectedIntervals(
        session.attendanceConfig.startTime,
        session.scheduledEndTime,
        session.attendanceConfig.captureInterval
      );
      session.attendanceConfig.totalIntervals = totalIntervals;
    }
    
    await session.save();
    
    res.json({
      success: true,
      message: 'Attendance tracking started',
      config: session.attendanceConfig
    });
    
  } catch (err) {
    console.error('Error starting attendance tracking:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * POST /api/attendance/stop-tracking
 * Stop attendance tracking for a session
 * Body: { sessionId }
 */
router.post('/stop-tracking', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Update attendance config
    session.attendanceConfig.endTime = new Date();
    await session.save();
    
    res.json({
      success: true,
      message: 'Attendance tracking stopped',
      config: session.attendanceConfig
    });
    
  } catch (err) {
    console.error('Error stopping attendance tracking:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * PUT /api/attendance/config/:sessionId
 * Update attendance configuration for a session
 * Body: { captureInterval, threshold }
 */
router.put('/config/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { captureInterval, threshold } = req.body;
    
    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Update config
    if (captureInterval !== undefined) {
      if (captureInterval < 45 || captureInterval > 60) {
        return res.status(400).json({
          success: false,
          error: 'Capture interval must be between 45 and 60 seconds'
        });
      }
      session.attendanceConfig.captureInterval = captureInterval;
    }
    
    if (threshold !== undefined) {
      if (threshold < 0 || threshold > 100) {
        return res.status(400).json({
          success: false,
          error: 'Threshold must be between 0 and 100'
        });
      }
      session.attendanceConfig.threshold = threshold;
    }
    
    await session.save();
    
    res.json({
      success: true,
      message: 'Attendance configuration updated',
      config: session.attendanceConfig
    });
    
  } catch (err) {
    console.error('Error updating attendance config:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/attendance/analytics/:sessionId
 * Get detailed analytics for faculty dashboard
 */
router.get('/analytics/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const summary = await attendanceService.getSessionAttendanceSummary(sessionId);
    
    // Additional analytics calculations
    const analytics = {
      ...summary,
      charts: {
        attendanceDistribution: {
          present: summary.presentCount,
          absent: summary.absentCount,
          partial: summary.partialCount
        },
        participantDetails: summary.participants.map(p => ({
          name: p.participantName,
          email: p.participantEmail,
          percentage: p.attendancePercentage,
          status: p.status,
          matchedIntervals: p.matchedIntervals,
          totalIntervals: p.totalIntervals
        }))
      }
    };
    
    res.json({
      success: true,
      analytics
    });
    
  } catch (err) {
    console.error('Error getting attendance analytics:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
