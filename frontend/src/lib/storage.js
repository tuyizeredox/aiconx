import { filesAPI } from '@/api/apiClient';

/**
 * Storage utility for S3 (primary) and Cloudinary (fallback)
 * Handles file uploads with automatic provider selection
 */

/**
 * Upload a single file with automatic provider selection
 * @param {File} file - The file to upload
 * @param {Object} options - Upload options
 * @param {string} options.folder - Folder path (default: 'media')
 * @param {boolean} options.forceBackend - Force backend upload instead of direct S3
 * @param {Function} options.onProgress - Progress callback (progress: number) 0-100
 * @returns {Promise<Object>} Upload result with url, key, provider
 */
export const uploadFile = async (file, options = {}) => {
  const { folder = 'media', forceBackend = false, onProgress } = options;
  
  try {
    // Check storage status
    const storageStatus = await filesAPI.getStorageStatus();
    
    console.log('Storage status:', storageStatus);
    
    // Try S3 direct upload first (faster)
    if (!forceBackend && storageStatus.s3.configured && storageStatus.primary === 's3') {
      try {
        console.log('Attempting S3 direct upload...');
        
        // Get presigned URL
        const presignedData = await filesAPI.getPresignedUrl(
          file.name,
          file.type,
          folder
        );
        
        console.log('Presigned URL received, uploading to S3...');
        
        // Upload directly to S3 with progress tracking
        const response = await filesAPI.uploadToS3(file, presignedData, onProgress);
        
        console.log('S3 upload successful:', response.url);
        
        return {
          url: response.url,
          key: response.key,
          provider: 's3',
          format: file.type.split('/')[1],
          bytes: file.size,
        };
      } catch (s3Error) {
        console.warn('S3 direct upload failed, trying backend upload:', s3Error.message);
        // Fall through to backend upload
      }
    }
    
    // Backend upload (handles S3 + Cloudinary fallback)
    console.log('Using backend upload...');
    const response = await filesAPI.upload(file, { folder, onProgress });
    
    console.log('Backend upload successful:', response.url, response.provider);
    
    return {
      url: response.url,
      key: response.key,
      public_id: response.public_id,
      provider: response.provider || 'cloudinary',
      format: response.format,
      bytes: response.bytes,
    };
  } catch (error) {
    console.error('File upload failed:', error);
    throw error;
  }
};

/**
 * Upload multiple files in parallel
 * @param {File[]} files - Array of files to upload
 * @param {Object} options - Upload options
 * @returns {Promise<Object[]>} Array of upload results
 */
export const uploadMultipleFiles = async (files, options = {}) => {
  console.log(`Uploading ${files.length} files...`);
  
  const uploadPromises = files.map((file, index) => 
    uploadFile(file, options).catch(error => {
      console.error(`Failed to upload file ${index + 1}:`, error);
      return { error, fileName: file.name };
    })
  );
  
  const results = await Promise.all(uploadPromises);
  
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  
  console.log(`Upload complete: ${successful.length} successful, ${failed.length} failed`);
  
  return results;
};

/**
 * Delete a file from storage
 * @param {string} keyOrPublicId - S3 key or Cloudinary public_id
 * @param {string} provider - Storage provider ('s3' or 'cloudinary')
 * @returns {Promise<Object>}
 */
export const deleteFile = async (keyOrPublicId, provider) => {
  try {
    await filesAPI.delete(keyOrPublicId, provider);
    console.log('File deleted successfully:', keyOrPublicId);
    return { success: true };
  } catch (error) {
    console.error('File deletion failed:', error);
    throw error;
  }
};

/**
 * Get storage configuration status
 * @returns {Promise<Object>}
 */
export const getStorageStatus = async () => {
  try {
    return await filesAPI.getStorageStatus();
  } catch (error) {
    console.error('Failed to get storage status:', error);
    throw error;
  }
};

/**
 * Check if S3 is available and configured
 * @returns {Promise<boolean>}
 */
export const isS3Available = async () => {
  try {
    const status = await getStorageStatus();
    return status.s3.configured && status.primary === 's3';
  } catch {
    return false;
  }
};

/**
 * Upload image with automatic optimization
 * @param {File} file - Image file
 * @param {Object} options - Upload options
 * @returns {Promise<Object>}
 */
export const uploadImage = async (file, options = {}) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }
  
  return uploadFile(file, { ...options, folder: options.folder || 'images' });
};

/**
 * Upload video file
 * @param {File} file - Video file
 * @param {Object} options - Upload options
 * @returns {Promise<Object>}
 */
export const uploadVideo = async (file, options = {}) => {
  if (!file.type.startsWith('video/')) {
    throw new Error('File must be a video');
  }
  
  return uploadFile(file, { ...options, folder: options.folder || 'videos' });
};

/**
 * Upload avatar/profile image
 * @param {File} file - Avatar image
 * @returns {Promise<Object>}
 */
export const uploadAvatar = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Avatar must be an image');
  }
  
  return uploadFile(file, { folder: 'avatars' });
};

/**
 * Upload product image
 * @param {File} file - Product image
 * @returns {Promise<Object>}
 */
export const uploadProductImage = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Product image must be an image');
  }
  
  return uploadFile(file, { folder: 'products' });
};

/**
 * Upload post media
 * @param {File} file - Post media (image or video)
 * @returns {Promise<Object>}
 */
export const uploadPostMedia = async (file) => {
  const folder = file.type.startsWith('video/') ? 'posts/videos' : 'posts/images';
  return uploadFile(file, { folder });
};

/**
 * Upload story media
 * @param {File} file - Story media (image or video)
 * @returns {Promise<Object>}
 */
export const uploadStoryMedia = async (file) => {
  const folder = file.type.startsWith('video/') ? 'stories/videos' : 'stories/images';
  return uploadFile(file, { folder });
};
