/**
 * Fix duplicate username index error
 * Run this once to remove the stale username index
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixUsernameIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iqon');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection;
    const collection = db.collection('users');

    // List all indexes
    const indexes = await collection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Check if username index exists
    const usernameIndex = indexes.find(idx => idx.name === 'username_1');
    
    if (usernameIndex) {
      console.log('\n⚠️  Found stale username_1 index');
      console.log('🗑️  Dropping username_1 index...');
      
      await collection.dropIndex('username_1');
      console.log('✅ Successfully dropped username_1 index');
      
      // Verify it's gone
      const remainingIndexes = await collection.indexes();
      console.log('\n📋 Remaining indexes:');
      remainingIndexes.forEach(idx => {
        console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
      });
      
      console.log('\n✨ Fix complete! You can now register users.');
    } else {
      console.log('\n✅ No username_1 index found. Nothing to fix.');
    }

    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixUsernameIndex();
