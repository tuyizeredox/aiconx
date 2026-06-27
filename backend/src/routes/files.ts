import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { 
  uploadFile, 
  deleteFile, 
  generatePresignedUploadUrl, 
  getStorageStatus,
  isS3Configured 
} from '../services/storageService';

export async function fileRoutes(fastify: FastifyInstance) {
  // Get storage status
  fastify.get('/storage-status', async (request, reply) => {
    try {
      return getStorageStatus();
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to get storage status' });
    }
  });

  // Get presigned URL for S3 direct upload (client-side upload)
  fastify.get('/presigned-url', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { filename, contentType, folder = 'media' } = query;

      if (!filename || !contentType) {
        return reply.code(400).send({ error: 'filename and contentType are required' });
      }

      if (!isS3Configured()) {
        return reply.code(503).send({ error: 'S3 not configured, falling back to Cloudinary' });
      }

      const presignedData = await generatePresignedUploadUrl(filename, contentType, folder);

      return presignedData;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate presigned URL' });
    }
  });

  // Direct upload (backend upload - useful for base64 files)
  fastify.post('/upload', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      const file = body?.file as string;
      const filename = body?.filename || 'upload.jpg';
      const contentType = body?.contentType || 'image/jpeg';
      const folder = body?.folder || 'media';
      
      if (!file) {
        fastify.log.error('No file provided in request body');
        return reply.code(400).send({ error: 'No file provided' });
      }

      // Validate file is a valid base64 string
      if (!/^data:image\/(png|jpeg|jpg|gif|webp)|^data:video\/(mp4|webm|ogg)|^[A-Za-z0-9+/=]+$/.test(file)) {
        fastify.log.error('Invalid file format - must be base64 encoded image or video');
        return reply.code(400).send({ error: 'Invalid file format. Please provide a base64 encoded image or video.' });
      }

      fastify.log.info(`Uploading file (size: ${Math.round(file.length / 1024)}KB)`);

      const uploadResult = await uploadFile(file, filename, contentType, { folder });

      fastify.log.info(`Upload successful: ${uploadResult.provider} - ${uploadResult.url}`);

      return {
        url: uploadResult.url,
        key: uploadResult.key,
        public_id: uploadResult.public_id,
        provider: uploadResult.provider,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Upload error: ${errorMessage}`);
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Upload failed',
        message: errorMessage 
      });
    }
  });

  // Delete file
  fastify.delete('/:keyOrPublicId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { keyOrPublicId } = request.params as { keyOrPublicId: string };
      const query = request.query as any;
      const provider = query?.provider as 's3' | 'cloudinary' | undefined;

      await deleteFile(keyOrPublicId, provider);
      return { status: 'deleted' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Deletion failed' });
    }
  });
}