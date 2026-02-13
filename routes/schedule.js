const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

// Schedule a new class
router.post('/schedule', scheduleController.scheduleClass);

// Get scheduled classes for a faculty (or all if not filtered, but controller handles facultyId param)
// Adjusting controller to use param or query. Controller uses req.params.facultyId
router.get('/scheduled/:facultyId', scheduleController.getScheduledClasses);

// Cancel a class
router.put('/cancel/:scheduleId', scheduleController.cancelClass);

// Get schedules by class (for students)
router.get('/class/:classId', scheduleController.getSchedulesByClass);

module.exports = router;
