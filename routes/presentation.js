const express = require('express');
const router = express.Router();
const ClassSession = require('../models/ClassSession');
const auth = require('../middleware/auth');

// Start Presentation
router.post('/:sessionId/presentation/start', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type } = req.body; // 'WHITEBOARD' or 'COMPILER'
    const userEmail = req.user.email;
    const userRole = req.user.role;

    // Validate role - only faculty can start presentation
    if (userRole !== 'faculty') {
      return res.status(403).json({
        success: false,
        error: 'Only faculty can start presentations'
      });
    }

    // Validate type
    if (!type || !['WHITEBOARD', 'COMPILER'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid presentation type. Must be WHITEBOARD or COMPILER'
      });
    }

    // Find session
    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Verify faculty owns this session
    if (session.facultyEmail !== userEmail) {
      return res.status(403).json({
        success: false,
        error: 'You are not the faculty for this session'
      });
    }

    // Check if session is live
    if (session.status !== 'LIVE') {
      return res.status(400).json({
        success: false,
        error: 'Session must be LIVE to start presentation'
      });
    }

    // Check if presentation already active
    if (session.presentationMode.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Presentation already active',
        currentType: session.presentationMode.type
      });
    }

    // Start presentation
    session.presentationMode = {
      isActive: true,
      type: type,
      startedAt: new Date(),
      endedAt: null
    };

    await session.save();

    res.json({
      success: true,
      message: `${type} presentation started`,
      presentationMode: session.presentationMode
    });

  } catch (error) {
    console.error('Start presentation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start presentation'
    });
  }
});

// Stop Presentation
router.post('/:sessionId/presentation/stop', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userEmail = req.user.email;
    const userRole = req.user.role;

    // Validate role
    if (userRole !== 'faculty') {
      return res.status(403).json({
        success: false,
        error: 'Only faculty can stop presentations'
      });
    }

    // Find session
    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Verify faculty owns this session
    if (session.facultyEmail !== userEmail) {
      return res.status(403).json({
        success: false,
        error: 'You are not the faculty for this session'
      });
    }

    // Check if presentation is active
    if (!session.presentationMode.isActive) {
      return res.status(400).json({
        success: false,
        error: 'No active presentation to stop'
      });
    }

    // Stop presentation
    session.presentationMode.isActive = false;
    session.presentationMode.endedAt = new Date();

    await session.save();

    res.json({
      success: true,
      message: 'Presentation stopped',
      presentationMode: session.presentationMode
    });

  } catch (error) {
    console.error('Stop presentation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop presentation'
    });
  }
});

// Get Presentation Status
router.get('/:sessionId/presentation/status', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      presentationMode: session.presentationMode
    });

  } catch (error) {
    console.error('Get presentation status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get presentation status'
    });
  }
});

module.exports = router;
