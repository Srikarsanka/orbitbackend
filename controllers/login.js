const bcrypt = require("bcryptjs");
const { spawn } = require("child_process");
const path = require("path");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
require("dotenv").config();

const login = async (req, res) => {
  console.log("🔥 LOGIN API CALLED");
  try {
    const { email, password, photoBase64, role } = req.body;

    if (!email || !password || !photoBase64 || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    if (role !== user.role) {
      return res.status(400).json({ message: "Role mismatch!" });
    }

    // Run Python face encoder
    const python = spawn("python3", [
      path.join(__dirname, "../face_encode.py"),
    ]);
    let result = "";

    python.stdout.on("data", (data) => (result += data.toString()));
    python.stderr.on("data", (data) =>
      console.log("PYTHON ERROR:", data.toString())
    );

    python.stdin.write(JSON.stringify({ image: photoBase64 }));
    python.stdin.end();

    python.on("close", async () => {
      console.log("RAW PYTHON RESULT =", result);

      // 🧨 NEW SAFETY CHECK
      if (!result || result.trim() === "") {
        return res
          .status(400)
          .json({ message: "Python returned no output (face not detected)" });
      }

      let output;
      try {
        output = JSON.parse(result);
      } catch (e) {
        return res.status(400).json({ message: "Invalid Python JSON output" });
      }

      if (output.error) {
        return res.status(400).json({ message: output.error });
      }

      const embedding = output.embedding;
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

      // ⭐ COOKIE FIX
      res.cookie("orbit_user", token, {
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        message: "Login successful!",
        user: {
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          photo: user.profilePhoto,
        },
      });
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { login };
