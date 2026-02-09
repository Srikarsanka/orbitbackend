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
    // Encrypted face embedding (stored as encrypted string for security)
    faceEmbedding: { type: String, required: true },
    // Optional: Hash for quick duplicate detection
    faceEmbeddingHash: { type: String },
    
    // Single-device login tracking
    activeSession: {
      deviceId: String,
      loginTime: Date,
      lastActivity: Date,
      ipAddress: String,
      userAgent: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
