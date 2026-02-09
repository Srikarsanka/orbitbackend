const User = require("../../models/user");
const OtpModel = require("../../models/otp");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");

const forgotPass = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // 1️⃣ Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Generate OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000);

    // 3️⃣ Hash OTP
    const hashedOtp = await bcrypt.hash(generatedOtp.toString(), 10);

    // 4️⃣ Save / update OTP in DB
    await OtpModel.findOneAndUpdate(
      { email },
      {
        email,
        otp: hashedOtp,
        resetToken: null,
        createdAt: Date.now(),
      },
      { upsert: true, new: true }
    );

    // 5️⃣ Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log(`[ForgotPass] Sending email to: ${email}`);
    
    // ... HTML Template ...

    const finalHtml = htmlTemplate.replace("{{OTP}}", generatedOtp);

    await transporter.sendMail({
      from: `<${process.env.EMAIL_USER}>`,
      to: email,
      subject: "OTP — Reset Your Password",
      html: finalHtml,
    });

    console.log(`[ForgotPass] Email sent successfully to: ${email}`);

    return res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(`[ForgotPass] Error:`, err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

module.exports = forgotPass;
