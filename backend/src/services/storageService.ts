import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary as fallback
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize S3 Client with modern AWS SDK v3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: false, // Use virtual-hosted-style URLs for CloudFront compatibility
});

// Configuration
const S3_BUCKET = process.env.S3_BUCKET_NAME || '';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';
const USE_S3_PRIMARY = process.env.USE_S3_PRIMARY !== 'false'; // Default to true

export interface UploadResult {
  url: string;
  key?: string;
  public_id?: string;
  provider: 's3' | 'cloudinary';
}

export interface StorageConfig {
  folder?: string;
  resource_type?: 'image' | 'video' | 'auto';
  transformation?: string;
}

/**
 * Generate a unique S3 key for the file
 */
function generateS3Key(filename: string, folder = 'media'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = filename.split('.').pop() || '';
  const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${folder}/${timestamp}_${random}_${sanitizedName}`;
}

/**
 * Generate CloudFront URL for S3 object
 */
function getCloudFrontUrl(key: string): string {
  if (CLOUDFRONT_DOMAIN) {
    return `https://${CLOUDFRONT_DOMAIN}/${key}`;
  }
  // Fallback to direct S3 URL if CloudFront not configured
  return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

/**
 * Upload file to S3 (primary storage)
 */
async function uploadToS3(
  file: Buffer | string,
  filename: string,
  contentType: string,
  config: StorageConfig = {}
): Promise<UploadResult> {
  try {
    const key = generateS3Key(filename, config.folder || 'media');
    
    // Convert base64 to Buffer if needed
    let body: Buffer;
    if (typeof file === 'string') {
      if (file.startsWith('data:')) {
        // Remove data URL prefix
        const base64Data = file.split(',')[1];
        body = Buffer.from(base64Data, 'base64');
      } else {
        body = Buffer.from(file, 'base64');
      }
    } else {
      body = file;
    }

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
      Metadata: {
        'uploaded-at': new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    return {
      url: getCloudFrontUrl(key),
      key,
      provider: 's3',
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
}

/**
 * Upload file to Cloudinary (fallback)
 */
async function uploadToCloudinary(
  file: Buffer | string,
  config: StorageConfig = {}
): Promise<UploadResult> {
  try {
    const uploadResponse = await cloudinary.uploader.upload(file as string, {
      folder: config.folder || 'iqon',
      resource_type: config.resource_type || 'auto',
    });

    return {
      url: uploadResponse.secure_url,
      public_id: uploadResponse.public_id,
      provider: 'cloudinary',
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/**
 * Delete file from S3
 */
async function deleteFromS3(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error) {
    console.error('S3 delete error:', error);
    throw error;
  }
}

/**
 * Delete file from Cloudinary
 */
async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
}

/**
 * Generate presigned URL for direct upload to S3 (client-side upload)
 */
export async function generatePresignedUploadUrl(
  filename: string,
  contentType: string,
  folder = 'media',
  expiresIn = 3600
): Promise<{ uploadUrl: string; key: string; cloudFrontDomain?: string }> {
  try {
    const key = generateS3Key(filename, folder);
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return {
      uploadUrl,
      key,
      cloudFrontDomain: CLOUDFRONT_DOMAIN || undefined,
    };
  } catch (error) {
    console.error('Presigned URL generation error:', error);
    throw error;
  }
}

/**
 * Main upload function with automatic fallback
 */
export async function uploadFile(
  file: Buffer | string,
  filename: string,
  contentType: string,
  config: StorageConfig = {}
): Promise<UploadResult> {
  // Try S3 first if enabled
  if (USE_S3_PRIMARY && S3_BUCKET) {
    try {
      return await uploadToS3(file, filename, contentType, config);
    } catch (error) {
      console.warn('S3 upload failed, falling back to Cloudinary:', error);
    }
  }

  // Fallback to Cloudinary
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    return await uploadToCloudinary(file, config);
  }

  throw new Error('No storage provider configured');
}

/**
 * Delete file with automatic provider detection
 */
export async function deleteFile(keyOrPublicId: string, provider?: 's3' | 'cloudinary'): Promise<void> {
  if (provider === 's3' || (!provider && keyOrPublicId.includes('/'))) {
    // Assume S3 if key contains path separator
    try {
      await deleteFromS3(keyOrPublicId);
      return;
    } catch (error) {
      console.warn('S3 delete failed:', error);
    }
  }

  // Try Cloudinary
  if (provider === 'cloudinary' || !provider) {
    try {
      await deleteFromCloudinary(keyOrPublicId);
      return;
    } catch (error) {
      console.warn('Cloudinary delete failed:', error);
    }
  }

  throw new Error('Failed to delete file from all providers');
}

/**
 * Get file URL (CloudFront for S3, direct URL for Cloudinary)
 */
export function getFileUrl(keyOrPublicId: string, provider: 's3' | 'cloudinary' = 's3'): string {
  if (provider === 's3') {
    return getCloudFrontUrl(keyOrPublicId);
  }
  // Cloudinary URLs are already full URLs
  return keyOrPublicId;
}

/**
 * Check if S3 is properly configured
 */
export function isS3Configured(): boolean {
  return !!(S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

/**
 * Check if CloudFront is configured
 */
export function isCloudFrontConfigured(): boolean {
  return !!CLOUDFRONT_DOMAIN;
}

/**
 * Get storage configuration status
 */
export function getStorageStatus() {
  return {
    s3: {
      configured: isS3Configured(),
      bucket: S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
    },
    cloudfront: {
      configured: isCloudFrontConfigured(),
      domain: CLOUDFRONT_DOMAIN,
    },
    cloudinary: {
      configured: !!(process.env.CLOUDINARY_CLOUD_NAME),
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    },
    primary: USE_S3_PRIMARY ? 's3' : 'cloudinary',
  };
}
