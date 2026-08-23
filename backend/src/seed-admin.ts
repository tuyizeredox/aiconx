import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models/User';
import { connectDB } from './config/database';

async function seedAdmin() {
  try {
    await connectDB();
    console.log('Connected to database...');

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const role = 'super_admin';

    if (!email || !password) {
      console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
      process.exit(1);
    }

    let user = await User.findOne({ email });

    if (user) {
      console.log('User already exists, updating to super_admin...');
      user.role = 'super_admin';
      user.is_blocked = false;
      user.password = await bcrypt.hash(password, 12);
      if (!user.username) user.username = 'superadmin';
      await user.save();
      console.log('Admin user updated successfully.');
    } else {
      console.log('Creating new super_admin user...');
      const hashedPassword = await bcrypt.hash(password, 12);
      const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || 'admin';
      let username = baseUsername;
      let suffix = 0;
      while (await User.findOne({ username })) {
        suffix += 1;
        username = `${baseUsername}${suffix}`;
      }
      user = new User({
        email,
        username,
        password: hashedPassword,
        display_name: 'Super Admin',
        role,
        is_verified: true,
        is_blocked: false,
      });
      await user.save();
      console.log(`Admin user created successfully (username: ${username}).`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin();