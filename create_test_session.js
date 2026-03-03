const mongoose = require('mongoose');
const Class = require('./models/createclass');
const ClassSession = require('./models/ClassSession');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => { console.error(err); process.exit(1); });

async function createTestSession() {
  try {
    // 1. Create Dummy Class
    const classCode = 'TEST_' + Math.floor(Math.random() * 10000);
    const newClass = new Class({
        className: 'Test Class',
        subject: 'Testing',
        description: 'Temporary class for testing video call',
        classCode: classCode,
        facultyEmail: 'faculty@orbit.com',
        facultyName: 'Test Faculty',
        facultyPhoto: 'default.png',
        students: [
            { studentEmail: 'student@orbit.com', studentName: 'Test Student' }
        ]
    });
    
    await newClass.save();
    console.log(`📚 Tes Class Created: ${newClass._id}`);

    // 2. Create Dummy Session
    const newSession = new ClassSession({
        classId: newClass._id,
        classCode: classCode,
        sessionTitle: 'Video Call Test Session',
        scheduledStartTime: new Date(),
        scheduledEndTime: new Date(Date.now() + 60 * 60000), // 1 hour later
        duration: 60,
        status: 'LIVE',
        facultyEmail: 'faculty@orbit.com',
        facultyName: 'Test Faculty',
        participants: []
    });

    await newSession.save();
    console.log(`🎥 Test Session Created: ${newSession._id}`);
    
    console.log('\n==================================================');
    console.log('🔗 OPEN THIS URL TO TEST:');
    console.log(`https://orbitbackend-0i66.onrender.com/video/room.html?session=${newSession._id}&role=faculty&email=faculty@orbit.com`);
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error creating test session:', error);
    process.exit(1);
  }
}

createTestSession();
