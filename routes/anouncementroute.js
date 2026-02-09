const express = require("express");
const router = express.Router();
const {
  sendAnnouncement,
  getRecentAnnouncements,
  getStudentAnnouncements,
} = require("../controllers/annoucementscont");

router.post("/send", sendAnnouncement);
router.post("/recent", getRecentAnnouncements);
router.post("/student", getStudentAnnouncements);

module.exports = router;
