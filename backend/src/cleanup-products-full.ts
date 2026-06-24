import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/database';
import { Product } from './models/Product';
import { CartItem } from './models/CartItem';
import { WishlistItem } from './models/WishlistItem';
import { AffiliateLink } from './models/AffiliateLink';
import { Order } from './models/Order';
import { Review } from './models/Review';
import { Store } from './models/Store';
import { User } from './models/User';

async function cleanupProductsFull() {
  try {
    await connectDB();
    console.log('Connected to database...\n');

    const adminUsers = await User.find({ role: 'super_admin' }).select('username email');
    const adminUsernames = adminUsers.map(u => u.username).filter(Boolean);
    console.log(`Preserving super_admin accounts: ${adminUsers.map(u => u.email).join(', ')}\n`);

    const productsRemaining = await Product.countDocuments();
    console.log(`Products remaining: ${productsRemaining}`);
    if (productsRemaining > 0) {
      const r = await Product.deleteMany({});
      console.log(`  -> Deleted ${r.deletedCount} products.`);
    } else {
      console.log('  -> Already empty.');
    }

    const cartResult = await CartItem.deleteMany({});
    console.log(`CartItems deleted: ${cartResult.deletedCount}`);

    const wishlistResult = await WishlistItem.deleteMany({});
    console.log(`WishlistItems deleted: ${wishlistResult.deletedCount}`);

    const affiliateResult = await AffiliateLink.deleteMany({});
    console.log(`AffiliateLinks deleted: ${affiliateResult.deletedCount}`);

    const orderResult = await Order.deleteMany({});
    console.log(`Orders deleted: ${orderResult.deletedCount}`);

    const reviewResult = await Review.deleteMany({});
    console.log(`Reviews deleted: ${reviewResult.deletedCount}`);

    const storeQuery = adminUsernames.length > 0
      ? { owner_username: { $nin: adminUsernames } }
      : {};
    const storeResult = await Store.deleteMany(storeQuery);
    console.log(`Stores deleted (non-admin): ${storeResult.deletedCount}`);

    console.log('\n--- Final counts ---');
    console.log(`Products: ${await Product.countDocuments()}`);
    console.log(`CartItems: ${await CartItem.countDocuments()}`);
    console.log(`WishlistItems: ${await WishlistItem.countDocuments()}`);
    console.log(`AffiliateLinks: ${await AffiliateLink.countDocuments()}`);
    console.log(`Orders: ${await Order.countDocuments()}`);
    console.log(`Reviews: ${await Review.countDocuments()}`);
    console.log(`Stores: ${await Store.countDocuments()}`);
    console.log(`Users: ${await User.countDocuments()} (super_admin only)`);

    console.log('\nFull product cleanup complete.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

cleanupProductsFull();
