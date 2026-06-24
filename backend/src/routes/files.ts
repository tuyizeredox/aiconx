import { FastifyInstance } from 'fastify';
import { v2 as cloudinary } from 'cloudinary';
import { z } from 'zod';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function fileRoutes(fastify: FastifyInstance) {
  // Get a signature for Cloudinary client-side upload (more secure)
  fastify.get('/upload-signature', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder: 'iqon' },
        process.env.CLOUDINARY_API_SECRET!
      );

      return {
        signature,
        timestamp,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        folder: 'iqon',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate upload signature' });
    }
  });

  // Direct upload (if needed, but client-side is better for performance)
  fastify.post('/upload', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      const file = body?.file as string;
      
      if (!file) {
        fastify.log.error('No file provided in request body');
        return reply.code(400).send({ error: 'No file provided' });
      }

      // Validate file is a valid base64 string
      if (!/^data:image\/(png|jpeg|jpg|gif|webp)|^data:video\/(mp4|webm|ogg)|^[A-Za-z0-9+/=]+$/.test(file)) {
        fastify.log.error('Invalid file format - must be base64 encoded image or video');
        return reply.code(400).send({ error: 'Invalid file format. Please provide a base64 encoded image or video.' });
      }

      // Log Cloudinary config status (without exposing secrets)
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      
      if (!cloudName || !apiKey || !apiSecret) {
        fastify.log.error('Cloudinary credentials not configured');
        fastify.log.error(`Config status - cloud_name: ${cloudName ? 'set' : 'missing'}, api_key: ${apiKey ? 'set' : 'missing'}, api_secret: ${apiSecret ? 'set' : 'missing'}`);
        return reply.code(500).send({ error: 'Cloudinary configuration missing' });
      }

      fastify.log.info(`Uploading file to Cloudinary (cloud: ${cloudName})`);
      fastify.log.info(`File size: ${Math.round(file.length / 1024)}KB`);

      const uploadResponse = await cloudinary.uploader.upload(file, {
        folder: 'iqon',
        resource_type: 'auto', // Auto-detect image or video
      });

      fastify.log.info(`Upload successful: ${uploadResponse.public_id}`);

      return {
        url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Cloudinary upload error: ${errorMessage}`);
      fastify.log.error(error); // Log full error stack
      return reply.code(500).send({ 
        error: 'Upload failed',
        message: errorMessage 
      });
    }
  });

  // Delete file
  fastify.delete('/:publicId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { publicId } = request.params as { publicId: string };
      await cloudinary.uploader.destroy(publicId);
      return { status: 'deleted' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Deletion failed' });
    }
  });
}