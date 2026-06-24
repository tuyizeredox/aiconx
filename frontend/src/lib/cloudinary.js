import { filesAPI } from '@/api/apiClient';

/**
 * Uploads a file to Cloudinary using a secure signature from the backend
 * @param {File} file - The file to upload
 * @returns {Promise<Object>} - The Cloudinary response object with secure_url
 */
export const uploadFile = async (file) => {
  try {
    // 1. Get signature from backend
    const signatureData = await filesAPI.getUploadSignature();
    
    // 2. Upload to Cloudinary directly from client
    const response = await filesAPI.uploadToCloudinary(file, signatureData);
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return {
      url: response.secure_url,
      public_id: response.public_id,
      format: response.format,
      bytes: response.bytes
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};
