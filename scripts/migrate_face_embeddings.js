// Migration script to update all users from old face_recognition (128-dim) to InsightFace (512-dim)
// This script will mark all users with old embeddings as needing re-registration

const mongoose = require('mongoose');
const User = require('../models/user');
require('dotenv').config();

async function migrateFaceEmbeddings() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users with old 128-dimension embeddings
    const users = await User.find({});
    
    let oldFormatCount = 0;
    let newFormatCount = 0;

    for (const user of users) {
      if (user.faceEmbedding && user.faceEmbedding.length === 128) {
        console.log(`🔄 User ${user.email} has old format (128-dim)`);
        oldFormatCount++;
        
        // Option 1: Clear the embedding (force re-registration)
        // user.faceEmbedding = [];
        // await user.save();
        
        // Option 2: Just log it for manual handling
        console.log(`   → Needs re-registration`);
      } else if (user.faceEmbedding && user.faceEmbedding.length === 512) {
        console.log(`✅ User ${user.email} has new format (512-dim)`);
        newFormatCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Old format (128-dim): ${oldFormatCount} users`);
    console.log(`   New format (512-dim): ${newFormatCount} users`);
    console.log(`   Total users: ${users.length}`);
    
    if (oldFormatCount > 0) {
      console.log('\n⚠️  Action Required:');
      console.log('   Users with old format need to re-register with the new system.');
      console.log('   Uncomment the "Option 1" code above to auto-clear old embeddings.');
    }

    await mongoose.disconnect();
    console.log('\n✅ Migration check complete');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

migrateFaceEmbeddings();
