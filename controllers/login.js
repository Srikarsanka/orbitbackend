const bcrypt = require("bcryptjs");
const path = require("path");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { decryptEmbedding } = require("../utils/embeddingCrypto");
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

    const pyRes = await fetch("https://orbitai-baeyetfhcdb2gtfu.eastasia-01.azurewebsites.net/encode", {
      method: "POST",
      body: form,
    });

    const pyOut = await pyRes.json();
    console.log("🔥 FASTAPI OUTPUT:", pyOut);

    if (!pyOut || pyOut.error) {
      return res.status(400).json({ message: "Face not detected" });
    }

    const embedding = pyOut.embedding;
    
    // Handle both old (array) and new (encrypted string) formats
    let stored;
    
    // Check if embedding is encrypted string or old array format
    if (typeof user.faceEmbedding === 'string') {
      // New encrypted format
      try {
        stored = decryptEmbedding(user.faceEmbedding);
        console.log('🔓 Embedding decrypted for comparison');
      } catch (decryptError) {
        console.error('❌ Failed to decrypt embedding:', decryptError);
        return res.status(400).json({ 
          message: "Your account uses an incompatible face format. Please re-register your account.",
          code: "ENCRYPTION_ERROR"
        });
      }
    } else if (Array.isArray(user.faceEmbedding)) {
      // Old unencrypted array format
      console.log('⚠️  Using old unencrypted embedding format (backward compatibility)');
      stored = user.faceEmbedding;
    } else {
      console.error('❌ Invalid embedding format:', typeof user.faceEmbedding);
      return res.status(500).json({ message: "Invalid face data format" });
    }

    // Validate embeddings
    if (!Array.isArray(embedding) || !Array.isArray(stored)) {
      console.error('❌ Invalid embedding format:', { 
        embeddingType: typeof embedding, 
        storedType: typeof stored 
      });
      return res.status(500).json({ message: "Invalid face data" });
    }

    // Check for embedding format compatibility (old vs new system)
    if (embedding.length !== stored.length) {
      console.error('❌ Embedding format mismatch:', { 
        newEmbeddingLength: embedding.length,
        storedEmbeddingLength: stored.length,
        issue: stored.length === 128 ? 'Old face_recognition format detected' : 'Unknown format'
      });
      
      return res.status(400).json({ 
        message: "Your account uses an old face recognition format. Please contact admin to update your profile or re-register your account.",
        code: "EMBEDDING_FORMAT_MISMATCH"
      });
    }

    console.log(`📊 Embedding Info:`, {
      embeddingLength: embedding.length,
      storedLength: stored.length,
      embeddingSample: embedding.slice(0, 3).map(v => v.toFixed(4)),
      storedSample: stored.slice(0, 3).map(v => v.toFixed(4))
    });

    // Calculate Euclidean distance between embeddings
    const distance = Math.sqrt(
      embedding.reduce(
        (sum, v, i) => sum + (v - stored[i]) * (v - stored[i]),
        0
      )
    );

    // Lenient threshold: 0.85 for InsightFace normalized embeddings
    // Handles significant variations: glasses, professional vs webcam, lighting
    // Based on observed distances: 0.78-0.90 for same person with different conditions
    const THRESHOLD = 0.85;

    console.log(`🔍 Face Match Analysis:`, {
      email: user.email,
      distance: distance.toFixed(4),
      threshold: THRESHOLD,
      match: distance <= THRESHOLD ? 'PASS ✅' : 'FAIL ❌',
      percentageMatch: ((1 - distance) * 100).toFixed(2) + '%'
    });

    // Lower distance = better match (0.0 = perfect match)
    if (distance > THRESHOLD) {
      console.log(`❌ Face mismatch: distance ${distance.toFixed(4)} > ${THRESHOLD}`);
      return res.status(400).json({ 
        message: `Face does not match! (Similarity: ${((1 - distance) * 100).toFixed(0)}%)` 
      });
    }

    console.log(`✅ Face match successful: distance ${distance.toFixed(4)} <= ${THRESHOLD}`);

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ⭐ KEEP OLD COOKIE NAME & ACCESSIBILITY
    // ⭐ UPDATED COOKIE FOR CROSS-SITE (Vercel -> Render)
    res.cookie("orbit_user", token, {
      httpOnly: false, 
      secure: true, // Required for SameSite: None
      sameSite: "None", // Required for cross-site
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
