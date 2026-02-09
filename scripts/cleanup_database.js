// Cleanup script - Remove all data except sankasrikar111@gmail.com user
const mongoose = require('mongoose');
const User = require('../models/user');
const Class = require('../models/createclass');
const Announcement = require('../models/anoucement');
const ClassSession = require('../models/ClassSession');
const Material = require('../models/Materials');
const WhiteboardState = require('../models/WhiteboardState');
require('dotenv').config();

async function cleanupDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const keepEmail = 'sankasrikar111@gmail.com';

    // 1. Remove all users except sankasrikar111@gmail.com
    console.log('🗑️  Removing users...');
    const userResult = await User.deleteMany({ 
      email: { $ne: keepEmail } 
    });
    console.log(`   Deleted ${userResult.deletedCount} users (kept ${keepEmail})`);

    // 2. Remove all classes
    console.log('🗑️  Removing classes...');
    const classResult = await Class.deleteMany({});
    console.log(`   Deleted ${classResult.deletedCount} classes`);

    // 3. Remove all announcements
    console.log('🗑️  Removing announcements...');
    const announcementResult = await Announcement.deleteMany({});
    console.log(`   Deleted ${announcementResult.deletedCount} announcements`);

    // 4. Remove all class sessions
    console.log('🗑️  Removing class sessions...');
    const sessionResult = await ClassSession.deleteMany({});
    console.log(`   Deleted ${sessionResult.deletedCount} class sessions`);

    // 5. Remove all materials
    console.log('🗑️  Removing materials...');
    const materialResult = await Material.deleteMany({});
    console.log(`   Deleted ${materialResult.deletedCount} materials`);

    // 6. Remove all whiteboard states
    console.log('🗑️  Removing whiteboard states...');
    const whiteboardResult = await WhiteboardState.deleteMany({});
    console.log(`   Deleted ${whiteboardResult.deletedCount} whiteboard states`);

    // 7. Check remaining user
    const remainingUser = await User.findOne({ email: keepEmail });
    if (remainingUser) {
      console.log('\n✅ Kept user:');
      console.log(`   Email: ${remainingUser.email}`);
      console.log(`   Name: ${remainingUser.fullName}`);
      console.log(`   Role: ${remainingUser.role}`);
      console.log(`   Embedding format: ${remainingUser.faceEmbedding?.length || 0}-dim`);
    } else {
      console.log(`\n⚠️  Warning: User ${keepEmail} not found in database!`);
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`   Users removed: ${userResult.deletedCount}`);
    console.log(`   Classes removed: ${classResult.deletedCount}`);
    console.log(`   Announcements removed: ${announcementResult.deletedCount}`);
    console.log(`   Sessions removed: ${sessionResult.deletedCount}`);
    console.log(`   Materials removed: ${materialResult.deletedCount}`);
    console.log(`   Whiteboard states removed: ${whiteboardResult.deletedCount}`);

    await mongoose.disconnect();
    console.log('\n✅ Database cleanup complete!');
    console.log('   You can now create new users with the updated face recognition system.');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    process.exit(1);
  }
}

cleanupDatabase();
