const cron = require('node-cron');
const ScheduledClass = require('../models/ScheduledClass');
const Class = require('../models/createclass');
const nodemailer = require('nodemailer');
const { loadTemplate, formatDate, formatTime, formatISO } = require('../utils/emailService');

// Email Setup (Reused)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    if(!to || to.length === 0) return;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    });
    console.log(`⏰ Reminder sent to ${to.length} recipients: ${subject}`);
  } catch (error) {
    console.error('❌ Reminder failed:', error);
  }
};

const startScheduler = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const thirtyMinutesLater = new Date(now.getTime() + 30 * 60000);
      const windowStart = new Date(now.getTime() + 29 * 60000); // 29 mins from now
      
      // Find classes scheduled between 29-31 minutes from now (approx 30 mins)
      // and reminder NOT sent yet
      const upcomingClasses = await ScheduledClass.find({
        status: 'scheduled',
        reminderSent: false,
        scheduledTime: { 
            $gte: windowStart, 
            $lte: thirtyMinutesLater 
        }
      });

      if (upcomingClasses.length > 0) {
        console.log(`🔔 Found ${upcomingClasses.length} classes for reminder.`);
      }

      for (const schedule of upcomingClasses) {
        const classDetails = await Class.findById(schedule.classId);
        if (classDetails && classDetails.students.length > 0) {
          
            const startTime = new Date(schedule.scheduledTime);
            // Default duration 60 mins if not stored, though schedule usually has it. 
            // ScheduledClass model has duration? Yes.
            const duration = schedule.duration || 60; 
            const endTime = new Date(startTime.getTime() + duration * 60000);

            const emailVariables = {
                ORBIT_LOGO_URL: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
                BANNER_URL: 'https://img.freepik.com/free-vector/webinar-concept-illustration_114360-4764.jpg', // Reminder specific banner
                FACULTY_NAME: classDetails.facultyName,
                CLASS_NAME: classDetails.className,
                DATE: formatDate(startTime),
                TIME: formatTime(startTime),
                START_ISO: formatISO(startTime),
                END_ISO: formatISO(endTime),
                JOIN_LINK: `https://orbit-pgd9.vercel.app/`,
                STUDENT_NAME: 'Student'
            };

            const emailPromises = classDetails.students.map(student => {
                const personalVariables = { ...emailVariables, STUDENT_NAME: student.studentName };
                const html = loadTemplate('reminder', personalVariables);

                return transporter.sendMail({
                    from: `"Orbit Class Scheduler" <${process.env.EMAIL_USER}>`,
                    to: student.studentEmail,
                    subject: `Reminder: ${classDetails.className} Starts Soon ⏰`,
                    html: html
                });
            });

            await Promise.all(emailPromises);
            
            // Mark as sent
            schedule.reminderSent = true;
            await schedule.save();
            console.log(`✅ Reminders sent for class: ${schedule.className}`);
        }
      }

    } catch (error) {
      console.error('Scheduler Error:', error);
    }
  });

  console.log('⏳ Class Scheduler Started (Checks every minute)');
};

module.exports = startScheduler;
