const express = require("express");
const router = express.Router();

const { getAnnouncementsByClass } = require("../controllers/classannocements");

// Get announcements only for a particular class
router.get("/:classId", getAnnouncementsByClass);

module.exports = router;
