import { FastifyRequest, FastifyReply } from 'fastify';
import { Settings } from '../models/Settings';
import { ActivityLog } from '../models/ActivityLog';

// 30-second TTL cache for maintenance settings — avoids 1 DB query per request
let _maintenanceCache: { maintenance_mode: boolean; maintenance_message?: string } | null = null;
let _maintenanceCacheExpiry = 0;
const MAINTENANCE_CACHE_TTL_MS = 30_000;

async function getMaintenanceSettings() {
  const now = Date.now();
  if (_maintenanceCache && now < _maintenanceCacheExpiry) {
    return _maintenanceCache;
  }
  const settings = await Settings.findOne().select('maintenance_mode maintenance_message').lean();
  _maintenanceCache = settings ? { maintenance_mode: !!settings.maintenance_mode, maintenance_message: (settings as any).maintenance_message } : { maintenance_mode: false };
  _maintenanceCacheExpiry = now + MAINTENANCE_CACHE_TTL_MS;
  return _maintenanceCache;
}

export function invalidateMaintenanceCache() {
  _maintenanceCache = null;
  _maintenanceCacheExpiry = 0;
}

export async function extractLanguage(request: FastifyRequest, reply: FastifyReply) {
  // Try to get from header first
  const headerLang = request.headers['accept-language'];
  
  // Default to en
  request.language = 'en';

  if (headerLang) {
    // Take the first one (e.g., 'en-US,en;q=0.9' -> 'en')
    const lang = headerLang.split(',')[0].split('-')[0].trim().toLowerCase();
    request.language = lang || 'en';
  }

  // If authenticated, we might want to prioritize user preference, 
  // but usually the frontend should send the correct header.
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = await request.jwtVerify();
    request.user = user;
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function authenticateOptional(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = await request.jwtVerify();
    request.user = user;
  } catch (err) {
    // Silently fail, user remains undefined on request
  }
}

export async function isAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = request.user as any;
    if (decoded.role !== 'super_admin') {
      return reply.code(403).send({ error: 'Forbidden: Admin access required' });
    }
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function logActivity(request: FastifyRequest, action: string, targetId?: any, targetType?: string, metadata?: any) {
  try {
    const user = request.user as any;
    if (!user) return;

    await ActivityLog.create({
      user_id: user.userId || user._id,
      action,
      target_id: targetId,
      target_type: targetType,
      metadata,
      ip_address: request.ip
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

export async function checkMaintenance(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Skip check for login and admin routes
    if (request.url.startsWith('/api/auth') || request.url.startsWith('/api/admin')) {
      return;
    }

    const settings = await getMaintenanceSettings();
    if (settings?.maintenance_mode) {
      // Check if user is super admin
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role === 'super_admin') {
          return;
        }
      } catch (err) {
        // Not logged in or invalid token - proceed to block
      }
      
      return reply.code(503).send({ 
        error: 'Service Unavailable', 
        message: settings.maintenance_message || 'Aicon X is currently under maintenance. Please check back later.',
        maintenance: true
      });
    }
  } catch (err) {
    // If settings check fails, proceed normally
  }
}