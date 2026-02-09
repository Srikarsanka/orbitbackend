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
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
      rejectUnauthorized: false
    }
    });

    console.log(`[ForgotPass] Verifying SMTP connection...`);
    try {
        await transporter.verify();
        console.log(`[ForgotPass] SMTP Connection Successful`);
    } catch (verifyErr) {
        console.error(`[ForgotPass] SMTP Connection Failed:`, verifyErr);
        // Fallback: Return success but log error if email fails (to avoid UI hanging)
        // Or return error. Let's return error for now so user knows.
        return res.status(500).json({ message: "Email service unavailable", error: verifyErr.message });
    }

    console.log(`[ForgotPass] Sending email to: ${email}`);
    
    // ... HTML Template ...

    const finalHtml = htmlTemplate.replace("{{OTP}}", generatedOtp);

    // Send Mail with timeout logic
    const sendMailPromise = transporter.sendMail({
      from: `<${process.env.EMAIL_USER}>`,
      to: email,
      subject: "OTP — Reset Your Password",
      html: finalHtml,
    });

    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Email sending timed out")), 10000)
    );

    await Promise.race([sendMailPromise, timeoutPromise]);

    console.log(`[ForgotPass] Email sent successfully to: ${email}`);

    return res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(`[ForgotPass] Error:`, err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

module.exports = forgotPass;
