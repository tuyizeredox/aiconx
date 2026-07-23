import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { Call } from '../models/Call';
import { User } from '../models/User';

let io: SocketIOServer;
const onlineUsers = new Map<string, Set<string>>();

// Short-lived cache for WebRTC call room lookups (30s TTL)
// Prevents DB hit on every ICE candidate exchange
const callRoomCache = new Map<string, { caller_username: string; callee_username: string; expiresAt: number }>();
const CALL_CACHE_TTL_MS = 30_000;

async function getCallRoom(callId: string) {
  const now = Date.now();
  const cached = callRoomCache.get(callId);
  if (cached && now < cached.expiresAt) return cached;
  const call = await Call.findById(callId).select('caller_username callee_username').lean() as any;
  if (!call) return null;
  const entry = { caller_username: call.caller_username, callee_username: call.callee_username, expiresAt: now + CALL_CACHE_TTL_MS };
  callRoomCache.set(callId, entry);
  return entry;
}

// Prune expired call cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of callRoomCache.entries()) {
    if (now >= entry.expiresAt) callRoomCache.delete(id);
  }
}, CALL_CACHE_TTL_MS);

async function broadcastUserStatus(username: string) {
  if (!io) return;
  const user = await User.findOne({ username }).lean();
  io.emit('user:status', {
    username,
    is_online: !!user?.is_online,
    last_seen_at: user?.last_seen_at || null,
  });
}

async function setUserOnline(username: string, socketId: string) {
  let sockets = onlineUsers.get(username);
  if (!sockets) {
    sockets = new Set();
    onlineUsers.set(username, sockets);
  }
  const wasEmpty = sockets.size === 0;
  sockets.add(socketId);
  if (wasEmpty) {
    await User.findOneAndUpdate(
      { username },
      { is_online: true, last_seen_at: new Date() },
      { upsert: false }
    );
    await broadcastUserStatus(username);
  }
}

async function setUserOffline(username: string, socketId: string) {
  const sockets = onlineUsers.get(username);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(username);
    await User.findOneAndUpdate(
      { username },
      { is_online: false, last_seen_at: new Date() },
      { upsert: false }
    );
    await broadcastUserStatus(username);
  }
}

export function setupWebSocket(fastify: FastifyInstance) {
  // Get the underlying HTTP server (available after fastify.ready() or listen())
  const server = fastify.server;
  
  if (!server) {
    throw new Error('HTTP server not available. Call setupWebSocket after fastify.listen()');
  }
  // Create Socket.IO server
  io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        const extraOrigins = (process.env.CORS_ORIGINS || '')
          .split(',')
          .map(o => o.trim())
          .filter(Boolean);

        const allowedOrigins = [
          'https://aiconx.vercel.app',
          'https://aiconx.net',
          'https://www.aiconx.net',
          process.env.FRONTEND_URL,
          'http://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          ...extraOrigins,
        ].filter(Boolean);

        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
          callback(null, true);
        } else {
          console.warn(`WebSocket CORS rejected origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
  });

  // TODO: Add Redis adapter for scaling when needed
  // if (process.env.REDIS_URL) {
  //   const pubClient = createClient({ url: process.env.REDIS_URL });
  //   const subClient = pubClient.duplicate();
  //   io.adapter(createAdapter(pubClient, subClient));
  // }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      // Verify JWT token
      const decoded = fastify.jwt.verify(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user.userId;
    const username = socket.data.user.username;
    console.log(`User ${username || userId} connected`);

    // Join user-specific rooms for notifications and messages
    socket.join(`user:${userId}`);
    if (username) {
      socket.join(`user:${username}`);
      setUserOnline(username, socket.id).catch(err => console.error('setUserOnline error:', err));
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${username || userId} disconnected`);
      if (username) {
        setUserOffline(username, socket.id).catch(err => console.error('setUserOffline error:', err));
      }
    });

    // Typing indicators
    socket.on('typing', (data: { conversationId: string; toUsername: string }) => {
      if (!username || !data?.toUsername) return;
      io.to(`user:${data.toUsername}`).emit('typing', {
        conversationId: data.conversationId,
        username,
      });
    });

    socket.on('stop-typing', (data: { conversationId: string; toUsername: string }) => {
      if (!username || !data?.toUsername) return;
      io.to(`user:${data.toUsername}`).emit('stop-typing', {
        conversationId: data.conversationId,
        username,
      });
    });

    // Example: Join conversation room
    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    // Example: Leave conversation room
    socket.on('leave-conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // WebRTC signaling relay for calls
    socket.on('call:offer', async (data: { callId: string; sdp: any }) => {
      try {
        const call = await getCallRoom(data.callId);
        if (!call) return;
        const targetUsername = call.caller_username === socket.data.user.username ? call.callee_username : call.caller_username;
        io?.to(`user:${targetUsername}`).emit('call:offer', { callId: data.callId, sdp: data.sdp });
      } catch (err) {
        console.error('call:offer relay error:', err);
      }
    });

    socket.on('call:answer', async (data: { callId: string; sdp: any }) => {
      try {
        const call = await getCallRoom(data.callId);
        if (!call) return;
        const targetUsername = call.caller_username === socket.data.user.username ? call.callee_username : call.caller_username;
        io?.to(`user:${targetUsername}`).emit('call:answer', { callId: data.callId, sdp: data.sdp });
      } catch (err) {
        console.error('call:answer relay error:', err);
      }
    });

    socket.on('call:ice-candidate', async (data: { callId: string; candidate: any }) => {
      try {
        const call = await getCallRoom(data.callId);
        if (!call) return;
        const targetUsername = call.caller_username === socket.data.user.username ? call.callee_username : call.caller_username;
        io?.to(`user:${targetUsername}`).emit('call:ice-candidate', { callId: data.callId, candidate: data.candidate });
      } catch (err) {
        console.error('call:ice-candidate relay error:', err);
      }
    });

    // Example: Join live session room
    socket.on('join-live-session', (sessionId: string) => {
      socket.join(`live-session:${sessionId}`);
    });

    // Example: Leave live session room
    socket.on('leave-live-session', (sessionId: string) => {
      socket.leave(`live-session:${sessionId}`);
    });
  });

  console.log('✅ WebSocket server initialized');
}

export { io };