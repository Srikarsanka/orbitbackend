const User = require("../models/user");
const bcrypt = require("bcryptjs");
const cloudinary = require("../config/cloudinary");
const { spawn } = require("child_process");
const path = require("path");

exports.signup = async (req, res) => {
  try {
    const { fullName, email, dob, contact, role, password, photoBase64 } =
      req.body;

    if (!photoBase64)
      return res
        .status(400)
        .json({ message: "Please upload or capture a photo" });

    const exist = await User.findOne({ email });
    if (exist) return res.status(409).json({ message: "Email already exists" });

    const upload = await cloudinary.uploader.upload(photoBase64, {
      folder: "orbit_profiles",
    });
    const profilePhoto = upload.secure_url;

    const pyScript = path.join(__dirname, "../face_encode.py");
    const py = spawn("python3", [pyScript]);

    let output = "";

    py.stdin.write(JSON.stringify({ image: photoBase64 }));
    py.stdin.end();

    py.stdout.on("data", (data) => {
      const chunk = data.toString();
      // filter — take only JSON object
      if (chunk.trim().startsWith("{")) {
        output += chunk;
      }
    });

    py.stderr.on("data", (err) => {
      console.log("Python stderr:", err.toString());
    });

    py.on("close", async () => {
      let result;
      try {
        result = JSON.parse(output);
      } catch {
        return res.status(500).json({
          message: "Face recognition failed (unexpected Python output)",
        });
      }

      if (result.error) {
        return res
          .status(400)
          .json({ message: "No face detected — try another photo" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await User.create({
        fullName,
        email,
        dob,
        contact,
        role,
        password: hashedPassword,
        profilePhoto,
        faceEmbedding: result.embedding,
      });

      return res.json({ success: true, message: "Signup successful" });
    });
  } catch (err) {
    console.log("Signup error:", err);
    return res.status(500).json({ message: "Signup failed" });
  }
};
