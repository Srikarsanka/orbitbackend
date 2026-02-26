const User = require("../models/user");
const bcrypt = require("bcryptjs");
const cloudinary = require("../config/cloudinary");
const { encryptEmbedding, hashEmbedding } = require("../utils/embeddingCrypto");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");

exports.signup = async (req, res) => {
  try {
    const { fullName, email, dob, contact, role, password, photoBase64 } =
      req.body;

    // Validate photo
    if (!photoBase64) {
      return res.status(400).json({
        message: "Please upload or capture a photo",
      });
    }

    // Check if email exists
    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ message: "Email already exists" });

    // Upload image to Cloudinary
    const upload = await cloudinary.uploader.upload(photoBase64, {
      folder: "orbit_profiles",
    });
    const profilePhoto = upload.secure_url;

    // Convert base64 → form-data for FastAPI
    const data = photoBase64.split(",")[1];
    const buffer = Buffer.from(data, "base64");

    const form = new FormData();
    form.append("file", buffer, {
      filename: "photo.jpg",
      contentType: "image/jpeg",
    });

    // SEND TO PYTHON FASTAPI
    const pyRes = await fetch("https://orbit-afavcgereabweje3.eastasia-01.azurewebsites.net/encode", {
      method: "POST",
      body: form,
    });

    const pyOut = await pyRes.json();
    console.log("🔥 FASTAPI SIGNUP OUTPUT:", pyOut);

    // Validate embedding
    if (!pyOut || pyOut.error) {
      return res.status(400).json({
        message: "No face detected — try another photo",
      });
    }

    const embedding = pyOut.embedding;

    // Encrypt embedding for secure storage
    const encryptedEmbedding = encryptEmbedding(embedding);
    const embeddingHash = hashEmbedding(embedding);

    console.log('🔐 Embedding encrypted for secure storage');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // CREATE USER
    await User.create({
      fullName,
      email,
      dob,
      contact,
      role,
      password: hashedPassword,
      profilePhoto,
      faceEmbedding: encryptedEmbedding,
      faceEmbeddingHash: embeddingHash,
    });

    return res.json({
      success: true,
      message: "Signup successful",
    });
  } catch (err) {
    console.log("Signup error:", err);
    return res.status(500).json({
      message: "Signup failed",
    });
  }
};

