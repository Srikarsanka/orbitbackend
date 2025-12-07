const Announcement = require("../models/anoucement");
const Class = require("../models/createclass");
const nodemailer = require("nodemailer");

exports.sendAnnouncement = async (req, res) => {
  try {
    const {
      classId,
      className,
      title,
      message,
      sendEmail,
      facultyEmail,
      facultyName,
    } = req.body;

    // 1️⃣ Save announcement in DB
    const announcement = await Announcement.create({
      classId,
      className,
      title,
      message,
      sendEmail,
      facultyEmail,
      facultyName,
    });

    // 2️⃣ If email sending enabled
    if (sendEmail) {
      const classData = await Class.findById(classId);

      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      const studentEmails = classData.students.map((s) => s.studentEmail);

      // 🔥 For testing — send to your Gmail also
      // If you want only your email during testing, replace below line with: ["sankasrikar@gmail.com"]
      const receiverEmails = [
        ...studentEmails,
        "sankasrikar@gmail.com",
        "moturisatish382@gmail.com",
      ];

      if (receiverEmails.length > 0) {
        // Nodemailer transporter
        let transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT,
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        // Email content
        const mailOptions = {
          from: ` <${process.env.EMAIL_USER}>`,
          to: receiverEmails, // sends to students + your testing account
          subject: `Announcement: ${title}`,
          html: `
html: 
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
  <!-- Header Image -->
  <img src="https://res.cloudinary.com/djha4r2ys/image/upload/v1764306543/Gemini_Generated_Image_o5vh83o5vh83o5vh_zcfr6w.png" 
       style="width: 100%; max-height: 260px; object-fit: cover; display: block;" />

  <!-- Main Content -->
  <div style="padding: 35px 30px;">
    <!-- Class Info Badge -->
    <div style="background: #f0f4ff; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 20px; font-size: 14px; color: #4A47E6; font-weight: 500;">
      <i class="fas fa-book" style="margin-right: 6px;"></i> ${className}
    </div>

    <!-- Announcement Title -->
    <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #1a1a1a; line-height: 1.4; border-left: 4px solid #4A47E6; padding-left: 15px;">
      ${title}
    </h2>

    <!-- Message Content -->
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #334155; white-space: pre-line;">
        ${message}
      </p>
    </div>

    <!-- Announcement Details -->
    <div style="border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 20px 0;">
      <div style="display: flex; flex-wrap: wrap; gap: 20px;">
        <div style="flex: 1; min-width: 150px;">
          <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">
            <i class="fas fa-user-circle" style="margin-right: 5px;"></i> Posted by
          </div>
          <div style="font-size: 16px; color: #1e293b; font-weight: 500;">${facultyName}</div>
        </div>
        <div style="flex: 1; min-width: 150px;">
          <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">
            <i class="fas fa-graduation-cap" style="margin-right: 5px;"></i> Course
          </div>
          <div style="font-size: 16px; color: #1e293b; font-weight: 500;">${className}</div>
        </div>
        <div style="flex: 1; min-width: 150px;">
          <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">
            <i class="fas fa-calendar-alt" style="margin-right: 5px;"></i> Date
          </div>
          <div style="font-size: 16px; color: #1e293b; font-weight: 500;">${new Date().toLocaleDateString(
            "en-US",
            { weekday: "long", year: "numeric", month: "long", day: "numeric" }
          )}</div>
        </div>
      </div>
    </div>

    <!-- Call to Action -->
    <div style="text-align: center; margin: 30px 0 20px 0;">
      <a href="https://orbit-zqsz.vercel.app/" 
         style="display: inline-block; background: #4A47E6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 15px; transition: all 0.3s ease;">
        <i class="fas fa-external-link-alt" style="margin-right: 8px;"></i> View Full Announcement
      </a>
    </div>
  </div>

  <!-- Footer -->
  <div style="background: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
    <div style="margin-bottom: 15px;">
      <span style="display: inline-block; background: #e2e8f0; color: #64748b; padding: 6px 12px; border-radius: 4px; font-size: 12px;">
        <i class="fas fa-robot" style="margin-right: 5px;"></i> Automated Message
      </span>
    </div>
    <p style="margin: 0 0 15px 0; color: #64748b; font-size: 14px;">
      This announcement was sent via Orbit Classroom System
    </p>
    <div style="color: #4A47E6; font-weight: 600; letter-spacing: 1px; font-size: 14px;">
      <i class="fas fa-globe" style="margin-right: 8px;"></i> ORBIT • ACHIEVE • LEARNING
    </div>
  </div>

  <!-- Font Awesome CDN for Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</div>

`,
        };

        // Send mail
        await transporter.sendMail(mailOptions);
      }
    }

    return res.status(200).json({
      message: "Announcement sent successfully!",
      announcement,
    });
  } catch (error) {
    console.error("Error sending announcement:", error);
    return res.status(500).json({
      message: "Failed to send announcement",
    });
  }
};

exports.getRecentAnnouncements = async (req, res) => {
  try {
    const { facultyEmail } = req.body;

    if (!facultyEmail) {
      return res.status(400).json({ message: "Faculty email required" });
    }

    const announcements = await Announcement.find({ facultyEmail }).sort({
      createdAt: -1,
    });

    return res.status(200).json({ announcements });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ message: "Failed to fetch announcements" });
  }
};
