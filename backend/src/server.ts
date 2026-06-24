import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import mongoose from 'mongoose';
import { connectDB } from './config/database';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { productRoutes } from './routes/products';
import { orderRoutes } from './routes/orders';
import { messageRoutes } from './routes/messages';
import { notificationRoutes } from './routes/notifications';
import { communityRoutes } from './routes/communities';
import { liveSessionRoutes } from './routes/liveSessions';
import { storeRoutes } from './routes/stores';
import { reviewRoutes } from './routes/reviews';
import { commentRoutes } from './routes/comments';
import { likeRoutes } from './routes/likes';
import { liveChatMessageRoutes } from './routes/liveChatMessages';
import { followRoutes } from './routes/follows';
import { communityMemberRoutes } from './routes/communityMembers';
import { couponRoutes } from './routes/coupons';
import { affiliateLinkRoutes } from './routes/affiliateLinks';
import { postRoutes } from './routes/posts';
import { cartRoutes } from './routes/cart';
import { fileRoutes } from './routes/files';
import { aiRoutes } from './routes/ai';
import { paymentRoutes } from './routes/payments';
import { storyRoutes } from './routes/stories';
import { sentimentSummaryRoutes } from './routes/sentimentSummaries';
import { shippingZoneRoutes } from './routes/shippingZones';
import { storeReviewRoutes } from './routes/storeReviews';
import { vendorSubscriptionRoutes } from './routes/vendorSubscriptions';
import { withdrawalRoutes } from './routes/withdrawals';
import { wishlistRoutes } from './routes/wishlist';
import { bookmarkRoutes } from './routes/bookmarks';
import { announcementRoutes } from './routes/announcements';
import { reportRoutes } from './routes/reports';
import { callRoutes } from './routes/calls';
import { checkoutRoutes } from './routes/checkout';
import { adminRoutes } from './routes/admin';
import { setupWebSocket, io } from './websocket/socket';
import { authenticate, authenticateOptional, checkMaintenance, extractLanguage } from './middleware/auth';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
  bodyLimit: 50 * 1024 * 1024, // 50MB limit for file uploads
  ignoreTrailingSlash: true,
});

// Environment variables
const PORT = parseInt(process.env.PORT || '4000');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET is not defined in environment variables');
  process.exit(1);
}

// Register plugins
fastify.register(compress, { global: true, threshold: 1024 });

fastify.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  errorResponseBuilder: (_req, context) => ({
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Retry in ${Math.ceil((context as any).ttl / 1000)}s.`,
    statusCode: 429,
  }),
});

fastify.register(cors, {
  origin: (origin, cb) => {
    const extraOrigins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);

    const allowedOrigins = [
      // Production frontend — hardcoded as fallback in case env var is missing on Render
      'https://aiconx.vercel.app',
      process.env.FRONTEND_URL,
      // Local development
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://localhost:4000',
      ...extraOrigins,
    ].filter(Boolean);

    const allowedVercelPreviews = (process.env.VERCEL_PREVIEW_ORIGINS || '')
      .split(',').map(o => o.trim()).filter(Boolean);

    const isAllowedVercel = origin
      ? allowedVercelPreviews.some(p => origin === p || origin.endsWith(`.${p}`))
      : false;

    if (!origin || allowedOrigins.includes(origin) || isAllowedVercel) {
      cb(null, true);
      return;
    }

    fastify.log.warn(`CORS rejected origin: ${origin}`);
    cb(new Error(`CORS: origin ${origin} not allowed`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept-Language',
    'x-requested-with',
    'Origin',
    'Accept',
  ],
  exposedHeaders: ['set-cookie'],
});

fastify.register(jwt, {
  secret: JWT_SECRET,
});

// Add authentication decorator
fastify.decorate('authenticate', authenticate);
fastify.decorate('authenticateOptional', authenticateOptional);

// Add Socket.IO decorator
fastify.decorate('io', null);

// Attach request ID to every response for tracing
fastify.addHook('onSend', async (request, reply) => {
  reply.header('X-Request-ID', request.id);
});

// Add global hooks
fastify.addHook('preHandler', extractLanguage);
fastify.addHook('preHandler', checkMaintenance);

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  const statusCode = error.statusCode || 500;
  
  reply.status(statusCode).send({
    error: 'Internal server error',
    message: statusCode < 500 ? error.message : 'Internal server error',
    statusCode
  });
});

// Stricter rate limit for auth endpoints (10 req / 15 min per IP)
fastify.register(async (authScope) => {
  authScope.register(rateLimit, {
    max: 10,
    timeWindow: '15 minutes',
  });
  authScope.register(authRoutes);
}, { prefix: '/api/auth' });

// Register routes
fastify.register(userRoutes, { prefix: '/api/users' });
fastify.register(productRoutes, { prefix: '/api/products' });
fastify.register(orderRoutes, { prefix: '/api/orders' });
fastify.register(messageRoutes, { prefix: '/api/messages' });
fastify.register(notificationRoutes, { prefix: '/api/notifications' });
fastify.register(communityRoutes, { prefix: '/api/communities' });
fastify.register(liveSessionRoutes, { prefix: '/api/live-sessions' });
fastify.register(storeRoutes, { prefix: '/api/stores' });
fastify.register(reviewRoutes, { prefix: '/api/reviews' });
fastify.register(commentRoutes, { prefix: '/api/comments' });
fastify.register(likeRoutes, { prefix: '/api/likes' });
fastify.register(liveChatMessageRoutes, { prefix: '/api/live-chat-messages' });
fastify.register(followRoutes, { prefix: '/api/follows' });
fastify.register(communityMemberRoutes, { prefix: '/api/community-members' });
fastify.register(couponRoutes, { prefix: '/api/coupons' });
fastify.register(affiliateLinkRoutes, { prefix: '/api/affiliate-links' });
fastify.register(postRoutes, { prefix: '/api/posts' });
fastify.register(cartRoutes, { prefix: '/api/cart' });
fastify.register(fileRoutes, { prefix: '/api/files' });
fastify.register(aiRoutes, { prefix: '/api/ai' });
fastify.register(paymentRoutes, { prefix: '/api/payments' });
fastify.register(storyRoutes, { prefix: '/api/stories' });
fastify.register(sentimentSummaryRoutes, { prefix: '/api/sentiment-summaries' });
fastify.register(shippingZoneRoutes, { prefix: '/api/shipping-zones' });
fastify.register(storeReviewRoutes, { prefix: '/api/store-reviews' });
fastify.register(vendorSubscriptionRoutes, { prefix: '/api/vendor-subscriptions' });
fastify.register(withdrawalRoutes, { prefix: '/api/withdrawals' });
fastify.register(wishlistRoutes, { prefix: '/api/wishlist' });
fastify.register(bookmarkRoutes, { prefix: '/api/bookmarks' });
fastify.register(announcementRoutes, { prefix: '/api/announcements' });
fastify.register(reportRoutes, { prefix: '/api' });
fastify.register(callRoutes, { prefix: '/api/calls' });
fastify.register(checkoutRoutes, { prefix: '/api/checkout' });
fastify.register(adminRoutes, { prefix: '/api/admin' });

// Error handling for uncaught exceptions — always exit; let process manager restart
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Health check — probes MongoDB connectivity
fastify.get('/api/health', async (_request, reply) => {
  let dbStatus = 'disconnected';
  try {
    await mongoose.connection.db?.admin().ping();
    dbStatus = 'connected';
  } catch (_) {
    dbStatus = 'error';
  }
  const isOk = dbStatus === 'connected';
  return reply.code(isOk ? 200 : 503).send({
    status: isOk ? 'ok' : 'degraded',
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Start server
const start = async () => {
  try {
    // Try to connect to database but don't block server startup if it's not ready
    // This allows the server to at least start so the proxy doesn't fail with 500/504
    connectDB().catch(err => {
      console.error('❌ Delayed MongoDB connection failed:', err.message);
    });
    
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    
    // Setup WebSocket after server is listening
    setupWebSocket(fastify);
    fastify.io = io;
    console.log('✅ WebSocket server initialized');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();