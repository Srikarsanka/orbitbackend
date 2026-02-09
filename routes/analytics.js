const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics');

// Get overall analytics dashboard data
router.get('/overview', analyticsController.getAnalyticsOverview);

// Get detailed session analytics
router.get('/session/:sessionId', analyticsController.getSessionDetails);

module.exports = router;
