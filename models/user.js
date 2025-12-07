// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    dob: { type: Date, required: true },
    contact: { type: String, required: true },
    role: { type: String, enum: ["student", "faculty"], required: true },
    password: { type: String, required: true },
    profilePhoto: { type: String, required: true },
    // Instead of storing full Base64 photo, we store the face embedding array
    faceEmbedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
