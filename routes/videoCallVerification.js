const express = require('express');
const router = express.Router();
const { verifyVideoCallJoin } = require('../controllers/videoCallVerification');

// POST /api/video-call/verify-join
router.post('/verify-join', verifyVideoCallJoin);

module.exports = router;
