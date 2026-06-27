# Amazon S3 and CloudFront Setup Guide

This document explains how to configure Amazon S3 as the primary storage with CloudFront CDN for media delivery, with Cloudinary as fallback.

## Environment Variables

Add the following environment variables to your backend `.env` file:

### AWS S3 Configuration (Primary Storage)

```bash
# AWS Region
AWS_REGION=us-east-1

# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key

# S3 Bucket Name
S3_BUCKET_NAME=your-bucket-name

# CloudFront Domain (Optional but recommended)
CLOUDFRONT_DOMAIN=your-distribution.cloudfront.net

# Use S3 as primary storage (default: true)
USE_S3_PRIMARY=true
```

### Cloudinary Configuration (Fallback)

```bash
# Cloudinary Credentials (fallback)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## AWS Setup Instructions

### 1. Create an S3 Bucket

1. Go to AWS Console → S3
2. Click "Create bucket"
3. Enter a unique bucket name
4. Select your region
5. Configure bucket settings:
   - **Block Public Access**: Off (for public media files)
   - Or configure with proper bucket policy for restricted access
6. Enable versioning (optional but recommended)
7. Create the bucket

### 2. Configure Bucket Policy (for Public Access)

If you want your media files to be publicly accessible (recommended for images/videos):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

Replace `your-bucket-name` with your actual bucket name.

### 3. Configure CORS (for Direct Browser Uploads)

Add this CORS configuration to your S3 bucket:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "PUT",
            "POST",
            "GET",
            "DELETE"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ]
    }
]
```

### 4. Create CloudFront Distribution (Recommended)

1. Go to AWS Console → CloudFront
2. Click "Create distribution"
3. **Origin settings**:
   - Origin domain: Select your S3 bucket
   - S3 bucket access: "Yes use OAI" (recommended) or "No"
4. **Default cache behavior**:
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - Cache policy: CachingOptimized
5. **Settings**:
   - Price class: Use only US, Canada, and Europe (or your preferred)
   - Alternate domain names (CNAME): Add your custom domain if available
   - Custom SSL certificate: Add if using custom domain
6. Create distribution

### 5. Create IAM User for Application Access

1. Go to AWS Console → IAM
2. Create a new user with "Programmatic access"
3. Attach the following policy (replace bucket name):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

4. Create the user and save the Access Key ID and Secret Access Key
5. Add these credentials to your `.env` file

## How It Works

### Upload Flow

1. **Client-side upload (S3 - Primary)**:
   - Frontend requests a presigned URL from backend
   - Backend generates presigned URL using AWS SDK
   - Frontend uploads directly to S3 using presigned URL
   - CloudFront URL is returned for media delivery

2. **Backend upload (Fallback)**:
   - Frontend sends file to backend as base64
   - Backend uploads to S3 first
   - If S3 fails, falls back to Cloudinary
   - Returns URL from successful upload

### Storage Priority

- **Primary**: Amazon S3 with CloudFront CDN
- **Fallback**: Cloudinary (if S3 fails or not configured)

### URL Format

- **S3 with CloudFront**: `https://your-distribution.cloudfront.net/media/timestamp_random_filename.jpg`
- **S3 without CloudFront**: `https://bucket-name.s3.region.amazonaws.com/media/timestamp_random_filename.jpg`
- **Cloudinary**: `https://res.cloudinary.com/cloud-name/image/upload/v123/filename.jpg`

## Testing

### Check Storage Status

```bash
curl http://localhost:3000/api/files/storage-status
```

Expected response:
```json
{
  "s3": {
    "configured": true,
    "bucket": "your-bucket-name",
    "region": "us-east-1"
  },
  "cloudfront": {
    "configured": true,
    "domain": "your-distribution.cloudfront.net"
  },
  "cloudinary": {
    "configured": true,
    "cloudName": "your-cloud-name"
  },
  "primary": "s3"
}
```

### Test Upload

```bash
# Get presigned URL
curl "http://localhost:3000/api/files/presigned-url?filename=test.jpg&contentType=image/jpeg&folder=media" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Upload file using presigned URL
curl -X PUT "PRESIGNED_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @test.jpg
```

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use IAM roles** in production instead of access keys when possible
3. **Enable bucket encryption** (SSE-S3 or SSE-KMS)
4. **Enable CloudFront signed URLs** for private content
5. **Use environment-specific buckets** (dev, staging, production)
6. **Rotate access keys regularly**
7. **Enable MFA** on AWS root account
8. **Use AWS CloudTrail** to monitor S3 access

## Troubleshooting

### S3 Upload Fails

- Check AWS credentials are correct
- Verify bucket exists and is in the correct region
- Ensure IAM user has proper permissions
- Check bucket policy allows uploads
- Verify CORS configuration

### CloudFront Not Working

- Verify distribution is deployed (can take 15-20 minutes)
- Check origin is correctly configured to point to S3
- Ensure bucket policy allows CloudFront OAI access if using OAI
- Verify DNS propagation if using custom domain

### Fallback to Cloudinary

- Check `USE_S3_PRIMARY` is set to `true`
- Verify S3 credentials are configured
- Check network connectivity to AWS
- Review backend logs for specific error messages

## Cost Optimization

1. **Use S3 Intelligent-Tiering** for automatic cost optimization
2. **Enable CloudFront caching** to reduce S3 requests
3. **Use lifecycle policies** to move old files to Glacier
4. **Monitor S3 and CloudFront costs** with AWS Cost Explorer
5. **Consider using CloudFront Functions** for simple transformations

## Migration from Cloudinary

Existing Cloudinary URLs in the database will continue to work. New uploads will use S3. To migrate existing files:

1. Export all Cloudinary URLs from your database
2. Download files from Cloudinary
3. Upload to S3 using the storage service
4. Update database with new S3 URLs
5. Delete from Cloudinary (optional)

## Support

For issues or questions:
- Check AWS CloudTrail logs for detailed error information
- Review backend logs for upload failures
- Verify environment variables are set correctly
- Test credentials using AWS CLI
