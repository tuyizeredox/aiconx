import { FastifyInstance } from 'fastify';
import { LiveSession, ILiveSession } from '../models/LiveSession';
import { User } from '../models/User';
import { checkLiveSessionLimit } from '../middleware/subscription';
import { likeTarget, unlikeTarget } from '../services/likeService';

export async function liveSessionRoutes(fastify: FastifyInstance) {
  // List live sessions with filtering
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        status = 'active',
        category,
        host_username,
        store_id,
        sort = '-started_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (status) filter.status = status;
      if (category) filter.category = category;
      if (host_username) filter.host_username = host_username;
      if (store_id) filter.store_id = store_id;

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const sessions = await LiveSession
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await LiveSession.countDocuments(filter);

      // Convert _id to id for frontend compatibility
      const sessionsWithId = sessions.map(session => ({
        ...session.toObject(),
        id: session._id.toString()
      }));

      reply.send({
        sessions: sessionsWithId,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get live session by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Validate ID parameter
      if (!id || id === 'undefined') {
        return reply.code(400).send({ error: 'Invalid session ID' });
      }

      const session = await LiveSession.findById(id);

      if (!session) {
        return reply.code(404).send({ error: 'Live session not found' });
      }

      // Convert _id to id for frontend compatibility
      const sessionWithId = {
        ...session.toObject(),
        id: session._id.toString()
      };

      reply.send(sessionWithId);
    } catch (error: any) {
      fastify.log.error(error?.message || 'Error fetching live session');
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create live session
  fastify.post('/', {
    preHandler: [fastify.authenticate, checkLiveSessionLimit]
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<ILiveSession>;
      const user = request.user as any;

      // Validate required fields
      if (!body.title) {
        return reply.code(400).send({ error: 'Missing required field: title' });
      }

      // Fetch full user data to get display_name
      const userData = await User.findOne({ email: user.email }).lean();
      if (!userData) {
        return reply.code(400).send({ error: 'User not found' });
      }

      const session = new LiveSession({
        ...body,
        host_username: user.username,
        host_name: userData.display_name || user.username,
        status: 'scheduled',
        stream_key: generateStreamKey(),
      });

      await session.save();

      // Emit real-time event
      fastify.io?.emit('live-session:created', {
        session: session.toObject()
      });

      reply.code(201).send(session);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update live session
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<ILiveSession>;
      const user = request.user as any;

      const session = await LiveSession.findById(id);

      if (!session) {
        return reply.code(404).send({ error: 'Live session not found' });
      }

      // Check if user is the host
      if (session.host_username !== user.username) {
        return reply.code(403).send({ error: 'You can only update your own live sessions' });
      }

      // Prevent updates to certain fields if session is active/ended
      if (session.status === 'active' || session.status === 'ended') {
        const restrictedFields = ['title', 'description', 'category', 'scheduled_at'];
        const hasRestrictedUpdate = restrictedFields.some(field => body[field as keyof ILiveSession] !== undefined);
        if (hasRestrictedUpdate) {
          return reply.code(400).send({ error: 'Cannot update session details while live session is active or ended' });
        }
      }

      // Update allowed fields
      const allowedUpdates = ['title', 'description', 'thumbnail', 'category', 'pinned_products', 'scheduled_at'];
      allowedUpdates.forEach(field => {
        const key = field as keyof ILiveSession;
        if (body[key] !== undefined) {
          (session as any)[key] = body[key];
        }
      });

      await session.save();

      // Emit real-time event
      fastify.io?.emit('live-session:updated', {
        session: session.toObject()
      });

      reply.send(session);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Start live session
  fastify.post('/:id/start', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const session = await LiveSession.findById(id);

      if (!session) {
        return reply.code(404).send({ error: 'Live session not found' });
      }

      // Check if user is the host
      if (session.host_username !== user.username) {
        return reply.code(403).send({ error: 'You can only start your own live sessions' });
      }

      if (session.status !== 'scheduled') {
        return reply.code(400).send({ error: 'Live session must be in scheduled status to start' });
      }

      session.status = 'active';
      session.started_at = new Date();
      await session.save();

      // Emit real-time event
      fastify.io?.emit('live-session:started', {
        session: session.toObject()
      });

      reply.send(session);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // End live session
  fastify.post('/:id/end', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const session = await LiveSession.findById(id);

      if (!session) {
        return reply.code(404).send({ error: 'Live session not found' });
      }

      // Check if user is the host
      if (session.host_username !== user.username) {
        return reply.code(403).send({ error: 'You can only end your own live sessions' });
      }

      if (session.status !== 'active') {
        return reply.code(400).send({ error: 'Live session must be active to end' });
      }

      session.status = 'ended';
      session.ended_at = new Date();
      await session.save();

      // Emit real-time event
      fastify.io?.emit('live-session:ended', {
        session: session.toObject()
      });

      reply.send(session);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update viewer count
  fastify.post('/:id/viewers', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { count: number };

      const session = await LiveSession.findById(id);

      if (!session) {
        return reply.code(404).send({ error: 'Live session not found' });
      }

      if (session.status !== 'active') {
        return reply.code(400).send({ error: 'Live session must be active to update viewer count' });
      }

      session.viewer_count = Math.max(0, body.count || 0);
      await session.save();

      // Emit real-time event
      fastify.io?.to(`live-session-${id}`).emit('viewer-count-updated', {
        session_id: id,
        viewer_count: session.viewer_count
      });

      reply.send({ viewer_count: session.viewer_count });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Delete live session
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const session = await LiveSession.findById(id);

      if (!session) {
        return reply.code(404).send({ error: 'Live session not found' });
      }

      // Check if user is the host
      if (session.host_username !== user.username) {
        return reply.code(403).send({ error: 'You can only delete your own live sessions' });
      }

      // Prevent deletion of active sessions
      if (session.status === 'active') {
        return reply.code(400).send({ error: 'Cannot delete an active live session' });
      }

      await LiveSession.findByIdAndDelete(id);

      // Emit real-time event
      fastify.io?.emit('live-session:deleted', {
        session_id: id
      });

      reply.send({ message: 'Live session deleted successfully' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get user's live sessions
  fastify.get('/user/me', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { status, limit = 20, skip = 0 } = query;
      const user = request.user as any;

      const filter: any = { host_username: user.username };
      if (status) filter.status = status;

      const sessions = await LiveSession
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await LiveSession.countDocuments(filter);

      reply.send({
        sessions,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}

// Helper function to generate a unique stream key
function generateStreamKey(): string {
  return `stream_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}