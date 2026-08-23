import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { Readable } from 'stream';
import mongoose from 'mongoose';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Backup, IBackup } from '../models/Backup';

// Daily full-database backups. Every collection is dumped generically via the
// native driver (not per-model) so newly added models are covered without
// having to remember to register them here.
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // poll hourly...
const MIN_GAP_MS = 23 * 60 * 60 * 1000; // ...but only actually run once every ~23h+, so a
// restart mid-day doesn't trigger a second backup on top of today's.
const RETENTION_COUNT = 14; // keep the last 14 successful backups, prune older ones

const S3_BUCKET = process.env.S3_BUCKET_NAME || '';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const BACKUP_S3_PREFIX = 'backups/';
const LOCAL_BACKUP_DIR = path.join(process.cwd(), 'backups');

function isS3Configured(): boolean {
  return !!(S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function getS3Client(): S3Client {
  return new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
}

async function dumpDatabaseToGzip(): Promise<{ buffer: Buffer; collectionsCount: number; documentsCount: number }> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection is not ready');

  const collections = await db.listCollections().toArray();
  const dump: Record<string, unknown[]> = {};
  let documentsCount = 0;

  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    const docs = await db.collection(name).find({}).toArray();
    dump[name] = docs;
    documentsCount += docs.length;
  }

  const json = JSON.stringify({ generated_at: new Date().toISOString(), collections: dump });
  const buffer = zlib.gzipSync(Buffer.from(json, 'utf-8'));
  return { buffer, collectionsCount: Object.keys(dump).length, documentsCount };
}

async function pruneOldBackups(): Promise<void> {
  const stale = await Backup.find({ status: 'success' }).sort({ started_at: -1 }).skip(RETENTION_COUNT);
  for (const backup of stale) {
    try {
      if (backup.provider === 's3') {
        await getS3Client().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: backup.location }));
      } else {
        await fs.promises.rm(backup.location, { force: true });
      }
    } catch (err) {
      console.warn(`[backup] Failed to prune old backup ${backup.filename}:`, err);
    }
    await Backup.deleteOne({ _id: backup._id });
  }
}

export async function runBackup(triggeredBy: 'cron' | 'manual', triggeredByUserId?: string): Promise<IBackup> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.json.gz`;

  const record = await Backup.create({
    filename,
    provider: isS3Configured() ? 's3' : 'local',
    location: '',
    status: 'running',
    triggered_by: triggeredBy,
    triggered_by_user: triggeredByUserId,
    started_at: new Date(),
  });

  try {
    const { buffer, collectionsCount, documentsCount } = await dumpDatabaseToGzip();

    let location: string;
    if (isS3Configured()) {
      const key = `${BACKUP_S3_PREFIX}${filename}`;
      await getS3Client().send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: 'application/gzip',
      }));
      location = key;
    } else {
      await fs.promises.mkdir(LOCAL_BACKUP_DIR, { recursive: true });
      location = path.join(LOCAL_BACKUP_DIR, filename);
      await fs.promises.writeFile(location, buffer);
    }

    record.location = location;
    record.size_bytes = buffer.length;
    record.collections_count = collectionsCount;
    record.documents_count = documentsCount;
    record.status = 'success';
    record.finished_at = new Date();
    await record.save();

    await pruneOldBackups();
  } catch (error: any) {
    console.error('[backup] Backup run failed:', error);
    record.status = 'failed';
    record.error_message = error?.message || 'Unknown error';
    record.finished_at = new Date();
    await record.save();
  }

  return record;
}

export async function getBackupStream(backup: IBackup): Promise<NodeJS.ReadableStream> {
  if (backup.provider === 's3') {
    const result = await getS3Client().send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: backup.location }));
    return result.Body as unknown as Readable;
  }
  return fs.createReadStream(backup.location);
}

async function tick() {
  try {
    const last = await Backup.findOne({ status: 'success' }).sort({ started_at: -1 });
    if (!last || Date.now() - last.started_at.getTime() > MIN_GAP_MS) {
      await runBackup('cron');
    }
  } catch (err) {
    console.error('[backup] Scheduled backup check failed:', err);
  }
}

// Check on startup (also catches a day that was missed while the server was
// down) and then once an hour thereafter.
setTimeout(tick, 30_000); // give mongoose a moment to finish connecting
setInterval(tick, CHECK_INTERVAL_MS);

export const backupService = { runBackup, getBackupStream };
