import { filesAPI } from '@/api/apiClient';

/**
 * Uploads a file using S3 as primary storage with Cloudinary fallback
 * @param {File} file - The file to upload
 * @param {Object} options - Upload options
 * @param {string} options.folder - Folder to upload to (default: 'media')
 * @returns {Promise<Object>} - The upload response object with url and provider info
 */
export const uploadFile = async (file, options = {}) => {
  const { folder = 'media' } = options;
  
  try {
    // 1. Check storage status
    const storageStatus = await filesAPI.getStorageStatus();
    
    // 2. Try S3 first if configured
    if (storageStatus.s3.configured && storageStatus.primary === 's3') {
      try {
        // Get presigned URL for S3 direct upload
        const presignedData = await filesAPI.getPresignedUrl(
          file.name,
          file.type,
          folder
        );
        
        // Upload directly to S3
        const response = await filesAPI.uploadToS3(file, presignedData);
        
        console.log('File uploaded to S3:', response.url);
        
        return {
          url: response.url,
          key: response.key,
          provider: 's3',
          format: file.type.split('/')[1],
          bytes: file.size,
        };
      } catch (s3Error) {
        console.warn('S3 upload failed, falling back to Cloudinary:', s3Error);
        // Fall through to Cloudinary
      }
    }
    
    // 3. Fallback to Cloudinary
    if (storageStatus.cloudinary.configured) {
      // For Cloudinary, we'll use the backend upload endpoint
      // which handles the fallback automatically
      const response = await filesAPI.upload(file, { folder });
      
      console.log('File uploaded to Cloudinary:', response.url);
      
      return {
        url: response.url,
        public_id: response.public_id,
        key: response.key,
        provider: response.provider || 'cloudinary',
        format: response.format,
        bytes: response.bytes,
      };
    }
    
    throw new Error('No storage provider configured');
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
};

/**
 * Uploads multiple files
 * @param {File[]} files - Array of files to upload
 * @param {Object} options - Upload options
 * @returns {Promise<Object[]>} - Array of upload responses
 */
export const uploadMultipleFiles = async (files, options = {}) => {
  const uploadPromises = files.map(file => uploadFile(file, options));
  return Promise.all(uploadPromises);
};

/**
 * Deletes a file from storage
 * @param {string} keyOrPublicId - S3 key or Cloudinary public_id
 * @param {string} provider - Storage provider ('s3' or 'cloudinary')
 * @returns {Promise<Object>}
 */
export const deleteFile = async (keyOrPublicId, provider) => {
  try {
    await filesAPI.delete(keyOrPublicId, provider);
    return { success: true };
  } catch (error) {
    console.error('File deletion error:', error);
    throw error;
  }
};
