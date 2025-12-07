const Announcement = require("../models/anoucement");

exports.getAnnouncementsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    if (!classId) {
      return res.status(400).json({ message: "Class ID required" });
    }

    const announcements = await Announcement.find({ classId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({ announcements });
  } catch (error) {
    console.error("Error fetching class announcements:", error);
    return res.status(500).json({ message: "Failed to fetch announcements" });
  }
};
