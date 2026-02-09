const nodemailer = require("nodemailer");

// Test email configuration
async function testEmail() {
  console.log("🔍 Testing email configuration...");
  console.log("EMAIL_HOST:", process.env.EMAIL_HOST);
  console.log("EMAIL_PORT:", process.env.EMAIL_PORT);
  console.log("EMAIL_USER:", process.env.EMAIL_USER);
  console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "***SET***" : "NOT SET");

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log("🔍 Verifying SMTP connection...");
    await transporter.verify();
    console.log("✅ SMTP Connection Successful!");

    console.log("📧 Sending test email...");
    await transporter.sendMail({
      from: `Orbit Test <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: "✅ Orbit Email Test - Success!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #4A47E6;">🎉 Email Configuration Successful!</h2>
          <p>Your Orbit backend email system is working correctly.</p>
          <p><strong>Configuration:</strong></p>
          <ul>
            <li>Host: ${process.env.EMAIL_HOST}</li>
            <li>Port: ${process.env.EMAIL_PORT}</li>
            <li>User: ${process.env.EMAIL_USER}</li>
          </ul>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            Sent from Orbit Backend on Render
          </p>
        </div>
      `
    });

    console.log("✅ Test email sent successfully!");
    console.log("📬 Check your inbox:", process.env.EMAIL_USER);
  } catch (error) {
    console.error("❌ Email test failed:", error.message);
    console.error("Full error:", error);
  }
}

module.exports = testEmail;
