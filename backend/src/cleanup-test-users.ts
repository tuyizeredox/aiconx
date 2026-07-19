import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from './models/User';
import { Store } from './models/Store';
import { Product } from './models/Product';
import { connectDB } from './config/database';

const DRY_RUN = !process.argv.includes('--confirm');

const TEST_PATTERN = /test/i;
const EXAMPLE_DOMAIN = /@example\.com$/i;

async function cleanupTestUsers() {
  try {
    await connectDB();
    console.log(`Connected to database... (${DRY_RUN ? 'DRY RUN — no data will be deleted' : 'LIVE RUN — deleting matched data'})`);

    const candidates = await User.find({
      role: { $ne: 'super_admin' },
      $or: [
        { email: { $regex: TEST_PATTERN } },
        { username: { $regex: TEST_PATTERN } },
        { email: { $regex: EXAMPLE_DOMAIN } },
      ],
    }).select('email username role');

    console.log(`\nMatched ${candidates.length} user(s):`);
    candidates.forEach(u => console.log(`  - ${u.email} (${u.username || 'no username'}) [${u.role}]`));

    if (candidates.length === 0) {
      console.log('\nNo matching test users found. Nothing to do.');
      await mongoose.connection.close();
      process.exit(0);
    }

    const usernames = candidates.map(u => u.username).filter(Boolean);

    const stores = await Store.find({ owner_username: { $in: usernames } }).select('owner_username store_name');
    console.log(`\nMatched ${stores.length} store(s) owned by test users:`);
    stores.forEach(s => console.log(`  - ${(s as any).store_name || s._id} (owner: ${s.owner_username})`));

    const products = await Product.find({ vendor_username: { $in: usernames } }).select('vendor_username title');
    console.log(`\nMatched ${products.length} product(s) owned by test users:`);
    products.forEach(p => console.log(`  - ${(p as any).title || p._id} (vendor: ${p.vendor_username})`));

    if (DRY_RUN) {
      console.log('\nDry run complete. Re-run with --confirm to actually delete the above.');
      await mongoose.connection.close();
      process.exit(0);
    }

    const productsResult = await Product.deleteMany({ vendor_username: { $in: usernames } });
    console.log(`\nDeleted ${productsResult.deletedCount} product(s).`);

    const storesResult = await Store.deleteMany({ owner_username: { $in: usernames } });
    console.log(`Deleted ${storesResult.deletedCount} store(s).`);

    const userIds = candidates.map(u => u._id);
    const usersResult = await User.deleteMany({ _id: { $in: userIds } });
    console.log(`Deleted ${usersResult.deletedCount} user(s).`);

    console.log('\nCleanup complete.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

cleanupTestUsers();
