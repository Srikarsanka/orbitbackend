const Class = require("../models/createclass");
const Announcement = require("../models/anoucement");
const Materials = require("../models/Materials");

const deleteclass = async (req, res) => {
  try {
    const { classId } = req.params;

    if (!classId) {
      return res.status(400).json({ message: "Class Id is required" });
    }

    const deletedClass = await Class.findByIdAndDelete(classId);
    if (!deletedClass) {
      return res.status(404).json({ message: "Class Not Found" });
    }

    // delete dependent data
    await Promise.all([
      Announcement.deleteMany({ classId }),
      Materials.deleteMany({ classId }),
    ]);

    return res.status(200).json({
      message: "Class Deleted Successfully",
      class: deletedClass,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = deleteclass;
