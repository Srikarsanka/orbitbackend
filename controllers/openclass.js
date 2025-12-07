const Class = require("../models/createclass");

const openclass = async (req, res) => {
  try {
    const { classCode } = req.params;

    if (!classCode) {
      return res.status(400).json({ message: "Class Code Required" });
    }

    const room = await Class.findOne({ classCode }); // FIXED

    if (!room) {
      return res.status(404).json({ message: "Class Not Found" });
    }

    return res.status(200).json({ room });
  } catch (err) {
    console.error("Open class error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = openclass;
