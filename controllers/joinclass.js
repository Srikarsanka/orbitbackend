const Class = require("../models/createclass");

const joinclass = async (req, res) => {
  try {
    const { classCode, student } = req.body;

    console.log('📝 Join class request:', { classCode, student });

    // Check for required fields (frontend sends studentEmail, not email)
    if (!classCode || !student?.studentEmail) {
      console.log('❌ Missing required data:', { classCode, studentEmail: student?.studentEmail });
      return res.status(400).json({
        success: false,
        message: "Missing required data",
      });
    }

    const classData = await Class.findOne({ classCode });

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    if (!classData.students) {
      classData.students = [];
    }

    // Check if already joined (check both studentEmail and email for compatibility)
    const alreadyJoined = classData.students.some(
      (s) => s.studentEmail === student.studentEmail || s.studentEmail === student.email
    );

    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        message: "You already joined this class",
      });
    }

    // PUSH DATA EXACTLY AS PER SCHEMA
    classData.students.push({
      studentName: student.studentName || student.name, // Support both field names
      studentEmail: student.studentEmail || student.email,
      studentPhoto: student.studentPhoto || student.photo,
    });

    await classData.save();

    return res.status(200).json({
      success: true,
      message: "Class joined successfully",
      className: classData.className,
      subject: classData.subject,
      facultyName: classData.facultyName,
    });
  } catch (err) {
    console.error("JOIN SERVER ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = joinclass;
