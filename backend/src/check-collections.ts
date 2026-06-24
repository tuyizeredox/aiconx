import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/database';

async function checkCollections() {
  await connectDB();
  const db = mongoose.connection.db!;
  const cols = await db.listCollections().toArray();
  for (const col of cols) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`${col.name}: ${count}`);
  }
  await mongoose.connection.close();
  process.exit(0);
}

checkCollections();
