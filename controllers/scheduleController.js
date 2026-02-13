const ScheduledClass = require('../models/ScheduledClass');
const ClassRoom = require('../models/createclass');
const User = require('../models/user');
const nodemailer = require('nodemailer');
const { loadTemplate, formatDate, formatTime, formatISO } = require('../utils/emailService');

// Email Transporter Setup (Lazy init or reused if exported elsewhere)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const ORBIT_LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png'; // Placeholder or actual URL


// Helper to send email
const sendEmail = async (to, subject, html) => {
  try {
    if(!to || to.length === 0) return;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    });
    console.log(`📧 Email sent to ${to.length} recipients: ${subject}`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
  }
};

// 1. Schedule a Class
exports.scheduleClass = async (req, res) => {
  try {
    const { classId, scheduledTime, duration } = req.body;
    
    // Validate request
    if (!classId || !scheduledTime) {
      return res.status(400).json({ error: 'Missing classId or scheduledTime' });
    }

    // Fetch Class Details
    const classDetails = await ClassRoom.findById(classId);
    if (!classDetails) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const newSchedule = new ScheduledClass({
      classId,
      facultyId: classDetails.facultyEmail, // Assuming facultyEmail is used as ID/Key often
      className: classDetails.className,
      classCode: classDetails.classCode || 'N/A',
      scheduledTime: new Date(scheduledTime),
      duration: duration || 60,
      status: 'scheduled'
    });

    await newSchedule.save();

      // Prepare Email Variables
      const startTime = new Date(scheduledTime);
      const endTime = new Date(startTime.getTime() + (duration || 60) * 60000);

      const emailVariables = {
          ORBIT_LOGO_URL: ORBIT_LOGO_URL,
          BANNER_URL: 'https://cdn.dribbble.com/users/1162077/screenshots/3848914/media/30c7270b220790835f1bc182c1613eb9.png',
          FACULTY_NAME: classDetails.facultyName,
          CLASS_NAME: classDetails.className,
          DATE: formatDate(startTime),
          TIME: formatTime(startTime),
          START_ISO: formatISO(startTime),
          END_ISO: formatISO(endTime),
          JOIN_LINK: `https://orbit-zqsz.vercel.app/`,
          STUDENT_NAME: 'Student'
      };

      const emailPromises = classDetails.students.map(student => {
          const personalVariables = { ...emailVariables, STUDENT_NAME: student.patientName || student.fullName || 'Student' };
          const html = loadTemplate('classScheduled', personalVariables);

          return transporter.sendMail({
              from: `"Orbit Class Scheduler" <${process.env.EMAIL_USER}>`,
              to: student.studentEmail,
              subject: `Class Scheduled – ${classDetails.className}`,
              html: html
          });
      });

      Promise.all(emailPromises).catch(err => console.error('Error sending schedule emails:', err));

    res.status(201).json({ success: true, schedule: newSchedule });

  } catch (error) {
    console.error('Schedule Class Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 2. Get Scheduled Classes (for Faculty)
exports.getScheduledClasses = async (req, res) => {
  try {
    const { facultyId } = req.params; // Expecting email or ID
    // Logic: fetch all future scheduled classes for this faculty
    // Or filter by classId if provided in query
    
    const query = { 
        facultyId: facultyId,
        status: { $in: ['scheduled', 'live'] } // Only active ones
    };

    const schedules = await ScheduledClass.find(query)
      .sort({ scheduledTime: 1 }); // Soonest first

    res.json(schedules);

  } catch (error) {
    console.error('Get Scheduled Classes Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 3. Cancel Class
exports.cancelClass = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const schedule = await ScheduledClass.findById(scheduleId);
    
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    
    schedule.status = 'cancelled';
    await schedule.save();

    // Notify Students
    const classDetails = await ClassRoom.findById(schedule.classId); // Changed from Class to ClassRoom
    if (classDetails && classDetails.students.length > 0) {
       const studentEmails = classDetails.students.map(s => s.studentEmail);
       const emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #ef4444;">Class Cancelled</h2>
          <p>The class <strong>${schedule.className}</strong> scheduled for ${new Date(schedule.scheduledTime).toLocaleString()} has been cancelled.</p>
        </div>
      `;
      sendEmail(studentEmails, `Cancelled: ${schedule.className}`, emailHtml);
    }

    res.json({ success: true, message: 'Class cancelled' });

  } catch (error) {
    console.error('Cancel Class Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 4. Get Schedules by Class (for Students/Faculty specific view)
exports.getSchedulesByClass = async (req, res) => {
    try {
        const { classId } = req.params;
        // The instruction implies an emailVariables object should be here.
        // Based on the provided snippet, we'll add it as shown,
        // but note that `classRoom`, `startTime` are not defined here
        // and the line `DATE: formatDate(startTime),: { $gte: new Date() }`
        // from the snippet is syntactically incorrect and seems to mix concerns.
        // I will only add the BANNER_URL as explicitly requested,
        // and create a minimal emailVariables object if it doesn't exist,
        // without introducing other undefined variables or syntax errors.
        const emailVariables = {
            ORBIT_LOGO_URL: ORBIT_LOGO_URL,
            BANNER_URL: 'https://img.freepik.com/free-vector/online-learning-banner_23-2148590897.jpg', // Professional placeholder
            // Other variables like FACULTY_NAME, CLASS_NAME, DATE are not defined in this scope
            // and would cause errors if added without their corresponding data.
        };
        const schedules = await ScheduledClass.find({ 
            classId, 
            status: { $ne: 'cancelled' },
            scheduledTime: { $gte: new Date() } // Future only? or all? Let's say all future + recent
        }).sort({ scheduledTime: 1 });
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
}
