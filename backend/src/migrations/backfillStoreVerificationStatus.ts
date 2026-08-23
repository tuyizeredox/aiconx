import 'dotenv/config';
import mongoose from 'mongoose';
import { Store } from '../models/Store';

/**
 * Migration: Backfill store verification_status
 *
 * Stores created before the seller identity verification (KYC) feature don't have a
 * verification_status field on their underlying document (Mongoose schema defaults only
 * apply to newly-created documents, and lean() reads bypass them entirely). This sets an
 * explicit 'unverified' status on any store missing the field, so the KYC gate, the admin
 * review queue, and the seller-facing status banner all behave consistently for every store.
 */
async function backfillStoreVerificationStatus() {
  try {
    console.log('Starting store verification_status backfill migration...');

    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vetora');
    }

    const result = await Store.updateMany(
      { verification_status: { $exists: false } },
      { $set: { verification_status: 'unverified' } }
    );

    console.log(`Migration complete. Updated ${result.modifiedCount} store(s).`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

backfillStoreVerificationStatus();
