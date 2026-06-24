import { FastifyInstance } from 'fastify';
import { Call, ICall } from '../models/Call';
import { User } from '../models/User';
import { z } from 'zod';

const createCallSchema = z.object({
  conversation_id: z.string().optional(),
  callee_username: z.string().min(1),
  call_type: z.enum(['voice', 'video']).default('voice'),
});

const updateCallSchema = z.object({
  status: z.enum(['answered', 'rejected', 'ended', 'missed']).optional(),
  duration: z.number().min(0).optional(),
});

const signalingSchema = z.object({
  sdp: z.any().optional(),
  iceCandidate: z.any().optional(),
});

export async function callRoutes(fastify: FastifyInstance) {
  // Create/initiate a call
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      if (!user?.userId || !user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - user not properly authenticated' });
      }

      const body = createCallSchema.parse(request.body);

      const calleeExists = await User.findOne({ username: body.callee_username.toLowerCase() }).maxTimeMS(5000);
      if (!calleeExists) {
        return reply.code(404).send({ error: 'Callee user not found' });
      }

      let callerDisplayName = user.username;
      try {
        const caller = await User.findById(user.userId).select('display_name username').maxTimeMS(5000);
        if (caller) {
          callerDisplayName = caller.display_name || caller.username || user.username;
        }
      } catch (dbError: any) {
        fastify.log.warn('Could not fetch caller display name, using username:', dbError?.message || dbError);
      }

      const call = new Call({
        ...body,
        conversation_id: body.conversation_id || `chat_${[user.username, body.callee_username].sort().join("_")}`,
        caller_username: user.username,
        caller_name: callerDisplayName,
      });

      await call.save();

      try {
        fastify.io?.to(`user:${body.callee_username}`).emit('call:incoming', {
          call: call.toObject(),
        });
      } catch (socketError: any) {
        fastify.log.warn('Socket emit failed (non-fatal):', socketError?.message || socketError);
      }

      return call;
    } catch (error: any) {
      fastify.log.error('Call creation error:', error);

      // Handle Mongoose validation errors
      if (error.name === 'ValidationError') {
        return reply.code(400).send({ error: 'Validation failed', details: error.message });
      }

      // Handle MongoDB cast errors (invalid ObjectId format)
      if (error.name === 'CastError') {
        return reply.code(400).send({ error: 'Invalid ID format', details: error.message });
      }

      if (error.name === 'MongooseServerSelectionError' || error.name === 'MongoError' || error.message?.includes('buffering timed out') || error.message?.includes('ECONNREFUSED')) {
        return reply.code(503).send({
          error: 'Database unavailable',
          message: 'Unable to connect to database. Please try again later.'
        });
      }
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Get incoming calls for current user
  fastify.get('/incoming', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      const calls = await Call.find({
        callee_username: user.username,
        status: 'ringing',
        created_at: { $gt: new Date(Date.now() - 60000) },
      }).sort({ created_at: -1 }).limit(10);

      return calls;
    } catch (error: any) {
      fastify.log.error(error);
      if (error.name === 'ValidationError') {
        return reply.code(400).send({ error: 'Validation failed', details: error.message });
      }
      if (error.name === 'MongooseServerSelectionError' || error.name === 'MongoError' || error.message?.includes('buffering timed out') || error.message?.includes('ECONNREFUSED')) {
        return reply.code(503).send({
          error: 'Database unavailable',
          message: 'Unable to connect to database. Please try again later.'
        });
      }
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Answer a call
  fastify.post('/:id/answer', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const call = await Call.findOne({ _id: id, callee_username: user.username, status: 'ringing' });
      if (!call) {
        return reply.code(404).send({ error: 'Call not found or unauthorized' });
      }

      call.status = 'answered';
      call.started_at = new Date();
      await call.save();

      fastify.io?.to(`user:${call.caller_username}`).emit('call:answered', {
        call: call.toObject(),
      });

      return call;
    } catch (error: any) {
      fastify.log.error(error);
      if (error.name === 'ValidationError') {
        return reply.code(400).send({ error: 'Validation failed', details: error.message });
      }
      if (error.name === 'CastError') {
        return reply.code(400).send({ error: 'Invalid ID format', details: error.message });
      }
      if (error.name === 'MongooseServerSelectionError' || error.name === 'MongoError' || error.message?.includes('buffering timed out') || error.message?.includes('ECONNREFUSED')) {
        return reply.code(503).send({
          error: 'Database unavailable',
          message: 'Unable to connect to database. Please try again later.'
        });
      }
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Reject a call
  fastify.post('/:id/reject', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const call = await Call.findOne({ _id: id, callee_username: user.username, status: 'ringing' });
      if (!call) {
        return reply.code(404).send({ error: 'Call not found or unauthorized' });
      }

      call.status = 'rejected';
      call.ended_at = new Date();
      await call.save();

      fastify.io?.to(`user:${call.caller_username}`).emit('call:rejected', {
        call: call.toObject(),
      });

      return call;
    } catch (error: any) {
      fastify.log.error(error);
      if (error.name === 'ValidationError') {
        return reply.code(400).send({ error: 'Validation failed', details: error.message });
      }
      if (error.name === 'CastError') {
        return reply.code(400).send({ error: 'Invalid ID format', details: error.message });
      }
      if (error.name === 'MongooseServerSelectionError' || error.name === 'MongoError' || error.message?.includes('buffering timed out') || error.message?.includes('ECONNREFUSED')) {
        return reply.code(503).send({
          error: 'Database unavailable',
          message: 'Unable to connect to database. Please try again later.'
        });
      }
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // End a call
  fastify.post('/:id/end', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const body = updateCallSchema.parse(request.body);

      const call = await Call.findOne({
        _id: id,
        $or: [
          { caller_username: user.username },
          { callee_username: user.username }
        ],
      });

      if (!call) {
        return reply.code(404).send({ error: 'Call not found or unauthorized' });
      }

      call.status = 'ended';
      call.ended_at = new Date();
      if (body.duration) {
        call.duration = body.duration;
      } else if (call.started_at) {
        call.duration = Math.floor((Date.now() - call.started_at.getTime()) / 1000);
      }
      await call.save();

      fastify.io?.to(`user:${call.caller_username}`).emit('call:ended', {
        call: call.toObject(),
      });
      fastify.io?.to(`user:${call.callee_username}`).emit('call:ended', {
        call: call.toObject(),
      });

      return call;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      if (error.name === 'ValidationError') {
        return reply.code(400).send({ error: 'Validation failed', details: error.message });
      }
      if (error.name === 'CastError') {
        return reply.code(400).send({ error: 'Invalid ID format', details: error.message });
      }
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Get call history
  fastify.get('/history', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const { limit = 50, skip = 0 } = request.query as any;

      const calls = await Call.find({
        $or: [
          { caller_username: user.username },
          { callee_username: user.username }
        ],
      }).sort({ created_at: -1 }).limit(parseInt(limit)).skip(parseInt(skip));

      const total = await Call.countDocuments({
        $or: [
          { caller_username: user.username },
          { callee_username: user.username }
        ],
      });

      return {
        calls,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit),
        },
      };
    } catch (error: any) {
      fastify.log.error(error);
      if (error.name === 'ValidationError') {
        return reply.code(400).send({ error: 'Validation failed', details: error.message });
      }
      if (error.name === 'MongooseServerSelectionError' || error.name === 'MongoError' || error.message?.includes('buffering timed out') || error.message?.includes('ECONNREFUSED')) {
        return reply.code(503).send({
          error: 'Database unavailable',
          message: 'Unable to connect to database. Please try again later.'
        });
      }
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Mark missed calls
  fastify.post('/missed', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      const result = await Call.updateMany(
        { callee_username: user.username, status: 'ringing', created_at: { $lt: new Date(Date.now() - 60000) } },
        { status: 'missed', ended_at: new Date() }
      );

      return { success: true, count: result.modifiedCount };
    } catch (error: any) {
      fastify.log.error(error);
      if (error.name === 'ValidationError') {
        return reply.code(400).send({ error: 'Validation failed', details: error.message });
      }
      if (error.name === 'MongooseServerSelectionError' || error.name === 'MongoError' || error.message?.includes('buffering timed out') || error.message?.includes('ECONNREFUSED')) {
        return reply.code(503).send({
          error: 'Database unavailable',
          message: 'Unable to connect to database. Please try again later.'
        });
      }
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
}