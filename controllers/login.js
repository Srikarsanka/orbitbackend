const bcrypt = require("bcryptjs");
const path = require("path");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");
require("dotenv").config();

function formFromBase64(base64) {
  const data = base64.split(",")[1];
  const buffer = Buffer.from(data, "base64");
  const form = new FormData();
  form.append("file", buffer, {
    filename: "face.jpg",
    contentType: "image/jpeg",
  });
  return form;
}

const login = async (req, res) => {
  console.log("🔥 LOGIN API CALLED");

  try {
    const { email, password, role, photoBase64 } = req.body;

    if (!email || !password || !photoBase64 || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Check role match (OLD behavior)
    if (role !== user.role) {
      return res.status(400).json({ message: "Role mismatch!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    // Face recognition via FASTAPI (REPLACEMENT FOR spawn python)
    const form = formFromBase64(photoBase64);

    const pyRes = await fetch("http://localhost:8000/encode", {
      method: "POST",
      body: form,
    });

    const pyOut = await pyRes.json();
    console.log("🔥 FASTAPI OUTPUT:", pyOut);

    if (!pyOut || pyOut.error) {
      return res.status(400).json({ message: "Face not detected" });
    }

    const embedding = pyOut.embedding;
    const stored = user.faceEmbedding;

    const distance = Math.sqrt(
      embedding.reduce(
        (sum, v, i) => sum + (v - stored[i]) * (v - stored[i]),
        0
      )
    );

    if (distance > 0.55) {
      return res.status(400).json({ message: "Face does not match!" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ⭐ KEEP OLD COOKIE NAME & ACCESSIBILITY
    res.cookie("orbit_user", token, {
      httpOnly: false, // OLD behavior
      secure: false,
      sameSite: "Lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // ⭐ RETURN EXACT OLD RESPONSE OBJECT
    return res.status(200).json({
      message: "Login successful!",
      user: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        photo: user.profilePhoto,
      },
    });
  } catch (err) {
    console.log("🔥 LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { login };
