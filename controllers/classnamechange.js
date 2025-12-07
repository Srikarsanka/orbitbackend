const Class = require("../models/createclass");

const updateclassname = async (req, res) => {
  try {
    const { classid } = req.params;
    const { className, subject } = req.body;

    // Validate inputs
    if (!classid || !className || !subject) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find class
    const classDoc = await Class.findById(classid);
    if (!classDoc) {
      return res.status(404).json({ message: "Class Not Found" });
    }

    // Update name
    classDoc.className = className;
    classDoc.subject = subject;
    await classDoc.save();

    return res.status(200).json({ message: "Class Name Updated Successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
};

module.exports = updateclassname;
