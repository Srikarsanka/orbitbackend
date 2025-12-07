const OtpModel = require("../../models/otp");
const User = require("../../models/user");
const bcrypt = require("bcryptjs");

const resetPass = async (req, res) => {
  try {
    const { newPassword, resetToken } = req.body;

    if (!newPassword || !resetToken) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 1️⃣ Find resetToken in OTP collection
    const otpEntry = await OtpModel.findOne({ resetToken });
    if (!otpEntry) {
      return res.status(401).json({ message: "Wrong" });
    }

    const email = otpEntry.email;

    // 2️⃣ Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3️⃣ Update user password
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    // 4️⃣ Delete OTP entry after success
    await OtpModel.deleteOne({ resetToken });

    return res.status(200).json({ message: "Correct" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
};

module.exports = resetPass;
