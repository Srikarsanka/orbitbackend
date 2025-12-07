const OtpModel = require("../../models/otp");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // 1️⃣ Find OTP document from DB
    const otpRecord = await OtpModel.findOne({ email });
    if (!otpRecord) {
      return res.status(404).json({ message: "OTP expired or not found" });
    }

    // 2️⃣ Compare OTP with hashed value
    const isMatched = await bcrypt.compare(otp.toString(), otpRecord.otp);
    if (!isMatched) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    // 3️⃣ Generate reset token (unique string)
    const resetToken = crypto.randomBytes(32).toString("hex");

    // 4️⃣ Save reset token and remove OTP
    // 4️⃣ Save reset token
    otpRecord.resetToken = resetToken;
    await otpRecord.save();

    // 5️⃣ Send reset token to frontend
    return res.status(200).json({
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = verifyOtp;
