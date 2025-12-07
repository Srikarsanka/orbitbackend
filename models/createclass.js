const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
  className: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String },

  // unique random code
  classCode: { type: String, required: true, unique: true },

  // faculty details
  facultyEmail: { type: String, required: true },
  facultyName: { type: String, required: true },
  facultyPhoto: { type: String, required: true },

  // array of students
  students: [
    {
      studentEmail: { type: String, required: true },
      studentName: { type: String },
      studentPhoto: { type: String },
    },
  ],
});

module.exports = mongoose.model("Class", classSchema);
