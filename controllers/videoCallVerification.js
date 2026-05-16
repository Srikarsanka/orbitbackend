const User = require("../models/user");
const Class = require("../models/createclass");
const ClassSession = require("../models/ClassSession"); // Fixed: Use ClassSession model
const { decryptEmbedding } = require("../utils/embeddingCrypto");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");

/**
 * Verify student face and enrollment before allowing video call join
 * Faculty members bypass this verification
 */
const verifyVideoCallJoin = async (req, res) => {
  console.log("🔐 VIDEO CALL FACE VERIFICATION API CALLED");

  try {
    const { email, classId: providedClassId, sessionId, photoBase64, role } = req.body;

    console.log('📥 Received verification request:', {
      email: email || 'MISSING',
      providedClassId: providedClassId || 'MISSING',
      sessionId: sessionId || 'MISSING',
      photoBase64: photoBase64 ? 'Present' : 'MISSING',
      role: role || 'MISSING'
    });

    // Basic validation
    if (!email || !sessionId || !photoBase64 || !role) {
      console.log('❌ Missing required fields validation failed');
      return res.status(400).json({
        verified: false,
        message: "Missing required fields (email, sessionId, photoBase64, role)",
        reason: "INVALID_REQUEST",
        debug: {
          email: !!email,
          sessionId: !!sessionId,
          photoBase64: !!photoBase64,
          role: !!role
        }
      });
    }

    // Faculty bypass face verification
    if (role === 'faculty') {
      console.log(`✅ Faculty ${email} bypassing face verification`);
      return res.status(200).json({
        verified: true,
        message: "Faculty verification bypassed",
        bypassedRole: "faculty"
      });
    }

    // Fetch classId from session if not provided
    let classId = providedClassId;
    if (!classId) {
      console.log('🔍 ClassId not provided, fetching from session...');
      // sessionId is actually the _id of the ClassSession document
      const session = await ClassSession.findById(sessionId);
      if (!session) {
        console.log(`❌ Session not found: ${sessionId}`);
        return res.status(404).json({
          verified: false,
          message: "Session not found",
          reason: "SESSION_NOT_FOUND"
        });
      }
      classId = session.classId;
      console.log(`✅ Found classId from session: ${classId}`);
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return res.status(404).json({
        verified: false,
        message: "User not found",
        reason: "USER_NOT_FOUND"
      });
    }

    // Check if student is enrolled in the class
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      console.log(`❌ Class not found: ${classId}`);
      return res.status(404).json({
        verified: false,
        message: "Class not found",
        reason: "CLASS_NOT_FOUND"
      });
    }

    // Check enrollment (check both email fields for compatibility)
    const isEnrolled = classDoc.students.some(
      student => student.studentEmail === email || student.email === email
    );

    if (!isEnrolled) {
      console.log(`❌ Student ${email} not enrolled in class ${classId}`);
      return res.status(403).json({
        verified: false,
        message: "You are not enrolled in this class",
        reason: "NOT_ENROLLED"
      });
    }

    console.log(`✅ Student ${email} is enrolled in class`);

    // Face recognition via Python API
    const data = photoBase64.split(",")[1];
    const buffer = Buffer.from(data, "base64");

    const form = new FormData();
    form.append("file", buffer, {
      filename: "verify.jpg",
      contentType: "image/jpeg",
    });

    const pyRes = await fetch(process.env.PYTHON_API_URL || "https://srikar048-orbit-python-ai.hf.space/encode", {
      method: "POST",
      body: form,
    });

    const pyOut = await pyRes.json();
    console.log("🔥 FASTAPI VERIFICATION OUTPUT:", pyOut);

    if (!pyOut || pyOut.error) {
      console.log(`❌ No face detected for ${email}`);
      return res.status(400).json({
        verified: false,
        message: "No face detected. Please ensure good lighting and face the camera",
        reason: "NO_FACE_DETECTED"
      });
    }

    const embedding = pyOut.embedding;

    // Handle both old (array) and new (encrypted string) formats
    let stored;

    if (typeof user.faceEmbedding === 'string') {
      // New encrypted format
      try {
        stored = decryptEmbedding(user.faceEmbedding);
        console.log('🔓 Embedding decrypted for verification');
      } catch (decryptError) {
        console.error('❌ Failed to decrypt embedding:', decryptError);
        return res.status(500).json({
          verified: false,
          message: "Error processing face data. Please re-register your account.",
          reason: "DECRYPTION_ERROR"
        });
      }
    } else if (Array.isArray(user.faceEmbedding)) {
      // Old unencrypted array format
      console.log('⚠️  Using old unencrypted embedding format');
      stored = user.faceEmbedding;
    } else {
      console.error('❌ Invalid embedding format:', typeof user.faceEmbedding);
      return res.status(500).json({
        verified: false,
        message: "Invalid face data format",
        reason: "INVALID_FORMAT"
      });
    }

    // Validate embeddings
    if (!Array.isArray(embedding) || !Array.isArray(stored)) {
      console.error('❌ Invalid embedding arrays');
      return res.status(500).json({
        verified: false,
        message: "Invalid face data",
        reason: "INVALID_EMBEDDING"
      });
    }

    // Check embedding length compatibility
    if (embedding.length !== stored.length) {
      console.error('❌ Embedding length mismatch:', {
        newLength: embedding.length,
        storedLength: stored.length
      });
      return res.status(400).json({
        verified: false,
        message: "Incompatible face format. Please re-register your account.",
        reason: "FORMAT_MISMATCH"
      });
    }

    // Calculate Euclidean distance
    const distance = Math.sqrt(
      embedding.reduce(
        (sum, v, i) => sum + (v - stored[i]) * (v - stored[i]),
        0
      )
    );

    // Same threshold as login (0.85)
    const THRESHOLD = 0.85;

    console.log(`🔍 Video Call Face Verification:`, {
      email: user.email,
      classId,
      sessionId,
      distance: distance.toFixed(4),
      threshold: THRESHOLD,
      match: distance <= THRESHOLD ? 'PASS ✅' : 'FAIL ❌',
      similarity: ((1 - distance) * 100).toFixed(2) + '%'
    });

    if (distance > THRESHOLD) {
      console.log(`❌ Face mismatch for ${email}: distance ${distance.toFixed(4)} > ${THRESHOLD}`);
      return res.status(403).json({
        verified: false,
        message: `Face does not match profile (Similarity: ${((1 - distance) * 100).toFixed(0)}%)`,
        reason: "FACE_MISMATCH",
        distance: distance.toFixed(4),
        similarity: ((1 - distance) * 100).toFixed(0) + '%'
      });
    }

    console.log(`✅ Face verification successful for ${email}`);

    return res.status(200).json({
      verified: true,
      message: "Face verification successful",
      user: {
        fullName: user.fullName,
        email: user.email,
        role: user.role
      },
      distance: distance.toFixed(4),
      similarity: ((1 - distance) * 100).toFixed(0) + '%'
    });

  } catch (err) {
    console.error("🔥 VIDEO CALL VERIFICATION ERROR:", err);
    return res.status(500).json({
      verified: false,
      message: "Server error during verification",
      reason: "SERVER_ERROR"
    });
  }
};

module.exports = { verifyVideoCallJoin };
