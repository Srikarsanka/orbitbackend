const express = require("express");
const router = express.Router();
const {
  sendAnnouncement,
  getRecentAnnouncements,
} = require("../controllers/annoucementscont");

router.post("/send", sendAnnouncement);
router.post("/recent", getRecentAnnouncements); // ⬅ ADD THIS LINE

module.exports = router;
