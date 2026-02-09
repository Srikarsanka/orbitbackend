const Class = require("../models/createclass");

const getclasses = async (req, res) => {
  try {
    const { studentEmail } = req.body;

    if (!studentEmail) {
      return res.status(400).json({
        message: "Student Email is Required",
      });
    }

    // 🔍 Find classes where student exists
    const classes = await Class.find({
      "students.studentEmail": studentEmail,
    });

    if (!classes || classes.length === 0) {
      return res.status(404).json({
        message: "No classes found for this student",
      });
    }

    // 🎯 Send clean response
    const payload = classes.map((cls) => ({
      _id: cls._id,
      className: cls.className,
      subject: cls.subject,
      description: cls.description,
      classCode: cls.classCode,

      facultyName: cls.facultyName,
      facultyEmail: cls.facultyEmail,
      facultyPhoto: cls.facultyPhoto,

      students: cls.students,
      createdAt: cls.createdAt,
    }));

    return res.status(200).json({
      message: "Classes Found",
      payload,
    });
  } catch (err) {
    console.error("GET CLASSES ERROR:", err);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

module.exports = getclasses;
