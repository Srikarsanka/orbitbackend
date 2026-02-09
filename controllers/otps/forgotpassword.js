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
    
    // 🔥 Email HTML Template with Banner
    const htmlTemplate = `
    <div style="max-width: 550px; margin: auto; border-radius: 8px; overflow: hidden; font-family: Arial, sans-serif; border: 1px solid #e5e5e5;">
      <div style="background: linear-gradient(135deg, #4f46e5, #06b6d4); padding: 22px; text-align: center; color: white; font-size: 22px; font-weight: bold;">
        Reset Password
      </div>
      <div style="padding: 30px;">
        <p style="font-size: 16px; margin-bottom: 20px; color: #333;">
          Hello 👋,<br><br>
          Please use the verification code below to reset your password for <strong>Orbit — AI Powered Virtual Classroom</strong>.
        </p>
        <div style="font-size: 38px; font-weight: bold; text-align: center; letter-spacing: 6px; margin: 30px 0; color: #4f46e5;">
          {{OTP}}
        </div>
        <p style="font-size: 15px; color: #444;">
          This OTP will expire in <strong>5 minutes</strong>.
          If you didn’t request this reset, you can safely ignore this email.
        </p>
      </div>
      <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 13px; color: #666;">
        © 2025 Orbit — AI Powered Virtual Classroom
      </div>
    </div>
    `;

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
    console.error(`[ForgotPass] Error sending email:`, err);
    
    // 🔥 FALLBACK FOR TESTING: Log OTP so user can proceed even if email fails
    console.log(`================================================`);
    console.log(`🔥 [DEBUG] OTP GENERATED: ${generatedOtp}`);
    console.log(`================================================`);

    return res.status(200).json({ 
      message: "OTP generated! (Email failed, check backend logs)", 
      // isDebug: true 
    });
  }
};

module.exports = forgotPass;
