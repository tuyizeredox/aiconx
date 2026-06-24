import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from './models/User';
import { Post } from './models/Post';
import { Product } from './models/Product';
import { connectDB } from './config/database';

async function cleanupDB() {
  try {
    await connectDB();
    console.log('Connected to database...');

    const adminUsers = await User.find({ role: 'super_admin' }).select('email username');
    const adminIds = adminUsers.map(u => u._id);

    console.log(`Found ${adminUsers.length} super_admin(s) to preserve:`);
    adminUsers.forEach(u => console.log(`  - ${u.email} (${u.username || 'no username'})`));

    const usersResult = await User.deleteMany({ role: { $ne: 'super_admin' } });
    console.log(`Deleted ${usersResult.deletedCount} non-admin users.`);

    const postsResult = await Post.deleteMany({});
    console.log(`Deleted ${postsResult.deletedCount} posts.`);

    const productsResult = await Product.deleteMany({});
    console.log(`Deleted ${productsResult.deletedCount} products.`);

    const remainingAdmins = await User.find({ role: 'super_admin' }).select('email role is_verified');
    console.log(`\nRemaining admin accounts (${remainingAdmins.length}):`);
    remainingAdmins.forEach(u => console.log(`  - ${u.email} | role: ${u.role} | verified: ${u.is_verified}`));

    console.log('\nCleanup complete.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

cleanupDB();
