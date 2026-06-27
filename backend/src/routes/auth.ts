import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { randomInt, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { User } from '../models/User';
import { sendVerificationCode, sendWhatsAppVerification } from '../services/mailService';

const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
});

const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_RATE_MAX = 200; // max attempts per window per IP
const authRateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkAuthRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = authRateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    authRateBuckets.set(ip, { count: 1, resetAt: now + AUTH_RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= AUTH_RATE_MAX) return false;
  bucket.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of authRateBuckets.entries()) {
    if (now > bucket.resetAt) authRateBuckets.delete(ip);
  }
}, AUTH_RATE_WINDOW_MS);

// Helper to get RP ID and Origin dynamically based on request or config
const getWebAuthnConfig = (request: any): { rpID: string, origin: string } => {
  const host = (request.headers.host || 'localhost') as string;
  const protocol = (request.headers['x-forwarded-proto'] || 'http') as string;
  const originHeader = request.headers.origin as string | undefined;
  
  // 1. Determine Origin
  // Prioritize originHeader because WebAuthn MUST match the browser's current domain
  let currentOrigin = originHeader || process.env.FRONTEND_URL || `${protocol}://${host}`;
  
  // 2. Determine RP ID (must be the frontend domain)
  let currentRpID = process.env.RP_ID;
  if (!currentRpID) {
    try {
      // Extract hostname from the determined origin
      const url = new URL(currentOrigin);
      currentRpID = url.hostname;
      
      // Special case: if origin is localhost but we have a host header, use host
      if (currentRpID === 'localhost' && host !== 'localhost' && !host.includes('localhost')) {
         currentRpID = host.split(':')[0];
      }
    } catch (e) {
      // Fallback to host if origin parsing fails
      currentRpID = host.split(':')[0];
    }
  }
  
  return { rpID: currentRpID as string, origin: currentOrigin as string };
};

const loginSchema = z.object({
  email: z.string().min(3), // Could be email or username
  password: z.string().min(6),
  rememberMe: z.boolean().optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6),
  display_name: z.string().min(1).max(50),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Google Login
  fastify.post('/google-login', async (request, reply) => {
    try {
      const { idToken } = z.object({
        idToken: z.string(),
      }).parse(request.body);

      // Verify the ID token with Google
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return reply.code(401).send({ error: 'Invalid Google token' });
      }

      const { email, name, picture, sub: googleId } = payload;

      // Find existing user first with projection
      let user = await User.findOne({ email: email.toLowerCase() }).select('username email display_name avatar_url banner_url role is_blocked is_verified google_id');

      if (!user) {
        // Create new user with optimized username generation
        const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
        
        // Try base username, then with random suffixes
        const candidates = [
          baseUsername,
          `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`,
          `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`,
        ];
        
        for (const candidate of candidates) {
          try {
            const newUser = new User({
              email: email.toLowerCase(),
              username: candidate,
              display_name: name || '',
              avatar_url: picture || '',
              google_id: googleId,
              is_verified: true,
            });
            user = await newUser.save();
            break;
          } catch (err: any) {
            if (err.code !== 11000) throw err;
            // Try next candidate
          }
        }
        
        if (!user) {
          return reply.code(500).send({ error: 'Could not create account' });
        }
      } else if (!user.google_id) {
        // Link Google to existing account
        user = await User.findByIdAndUpdate(
          user._id,
          { $set: { google_id: googleId, is_verified: true } },
          { new: true, select: 'username email display_name avatar_url banner_url role is_blocked is_verified' }
        );
      }

      if (user?.is_blocked) {
        return reply.code(403).send({ error: 'Your account has been suspended' });
      }

      // Ensure user exists after all updates
      const finalUser = user!;
      
      // Generate JWT token
      const token = fastify.jwt.sign({
        userId: finalUser._id.toString(),
        email: finalUser.email,
        username: finalUser.username,
        role: finalUser.role,
      }, { expiresIn: '7d' });

      return {
        user: {
          id: finalUser._id,
          username: finalUser.username,
          email: finalUser.email,
          display_name: finalUser.display_name,
          avatar_url: finalUser.avatar_url,
          banner_url: finalUser.banner_url,
          role: finalUser.role,
          is_blocked: finalUser.is_blocked,
          is_verified: finalUser.is_verified,
          is_2fa_enabled: finalUser.is_2fa_enabled || false,
          phone_number: finalUser.phone_number || '',
          is_phone_verified: finalUser.is_phone_verified || false,
          notifications: finalUser.notifications || { notif_sales: true, notif_msg: true, notif_follow: true, notif_live: false },
          preferences: finalUser.preferences || { theme: 'light', language: 'en' },
          unread_messages_count: finalUser.unread_messages_count || 0,
        },
        token,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error during Google login' });
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    if (!checkAuthRateLimit(request.ip)) {
      return reply.code(429).send({ error: 'Too many login attempts. Please try again later.' });
    }
    try {
      const { email: identifier, password, rememberMe } = loginSchema.parse(request.body);

      // Support login by email OR username - use projection for efficiency
      const user = await User.findOne({ 
        $or: [
          { email: identifier.toLowerCase() }, 
          { username: identifier.toLowerCase() }
        ] 
      }).select('+password +two_factor_secret username email display_name avatar_url banner_url role is_blocked is_verified is_2fa_enabled phone_number is_phone_verified notifications preferences unread_messages_count');

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password || '');
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      if (user.is_blocked) {
        return reply.code(403).send({ error: 'Your account has been suspended' });
      }

      if (user.is_2fa_enabled) {
        // Generate a temporary token for 2FA challenge (5 mins expiry)
        const twoFactorToken = fastify.jwt.sign({
          userId: user._id.toString(),
          pending_2fa: true,
          remember_me: !!rememberMe,
        }, { expiresIn: '5m' });

        return { 
          two_factor_required: true,
          two_factor_token: twoFactorToken,
        };
      }

      // Generate JWT token
      const token = fastify.jwt.sign({
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      }, { expiresIn: rememberMe ? '30d' : '1d' });

      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          banner_url: user.banner_url,
          role: user.role,
          is_blocked: user.is_blocked,
          is_verified: user.is_verified,
          is_2fa_enabled: user.is_2fa_enabled,
          phone_number: user.phone_number,
          is_phone_verified: user.is_phone_verified,
          notifications: user.notifications,
          preferences: user.preferences,
          unread_messages_count: user.unread_messages_count || 0,
        },
        token,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      
      const err = error as any;
      fastify.log.error(err);
      
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? (err?.message || err?.errmsg || String(err))
        : 'Authentication failed';
      
      return reply.code(500).send({ 
        error: errorMessage,
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
      });
    }
  });

  // Verify 2FA during Login
  fastify.post('/login/2fa', async (request, reply) => {
    try {
      const { two_factor_token, token: otpToken } = z.object({
        two_factor_token: z.string(),
        token: z.string().length(6),
      }).parse(request.body);

      // Verify the 2FA challenge token
      const decoded = fastify.jwt.verify(two_factor_token) as { userId: string, pending_2fa: boolean, remember_me?: boolean };
      
      if (!decoded.pending_2fa) {
        return reply.code(400).send({ error: 'Invalid challenge' });
      }

      const user = await User.findById(decoded.userId).select('+two_factor_secret');

      if (!user || !user.two_factor_secret) {
        return reply.code(400).send({ error: 'Invalid request' });
      }

      if (user.is_blocked) {
        return reply.code(403).send({ error: 'Your account has been suspended' });
      }

      const { valid: isValid } = verifySync({ 
        token: otpToken, 
        secret: user.two_factor_secret 
      });

      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid 2FA code' });
      }

      // Generate JWT token
      const jwtToken = fastify.jwt.sign({
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      }, { expiresIn: decoded.remember_me ? '30d' : '1d' });

      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          banner_url: user.banner_url,
          role: user.role,
          is_blocked: user.is_blocked,
          is_verified: user.is_verified,
          is_2fa_enabled: user.is_2fa_enabled,
          phone_number: user.phone_number,
          is_phone_verified: user.is_phone_verified,
          notifications: user.notifications,
          preferences: user.preferences,
          unread_messages_count: user.unread_messages_count || 0,
          authenticators: user.authenticators,
        },
        token: jwtToken,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // WebAuthn Registration Options
  fastify.get('/webauthn/register-options', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    try {
      const user = await User.findById((request.user as any).userId);
      if (!user) return reply.code(404).send({ error: 'User not found' });

      const { rpID } = getWebAuthnConfig(request);

      const options = await generateRegistrationOptions({
        rpName: 'Aicon X',
        rpID,
        userID: Buffer.from(user._id.toString()),
        userName: user.username,
        attestationType: 'none',
        excludeCredentials: user.authenticators.map(auth => ({
          id: auth.credentialID,
          type: 'public-key',
          transports: auth.transports as any[],
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform',
        },
      });

      user.current_challenge = options.challenge;
      user.current_challenge_expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 min
      await user.save();

      return options;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate registration options' });
    }
  });

  // WebAuthn Registration Verify
  fastify.post('/webauthn/register-verify', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    try {
      const body = z.object({
        id: z.string(),
        rawId: z.string(),
        response: z.object({
          clientDataJSON: z.string(),
          attestationObject: z.string(),
          transports: z.array(z.string()).optional(),
        }),
        type: z.literal('public-key'),
        clientExtensionResults: z.any().optional(),
        authenticatorAttachment: z.string().optional(),
      }).parse(request.body);

      const user = await User.findById((request.user as any).userId).select('+current_challenge +current_challenge_expires_at');
      if (!user) return reply.code(404).send({ error: 'User not found' });

      if (!user.current_challenge || !user.current_challenge_expires_at || user.current_challenge_expires_at < new Date()) {
        return reply.code(400).send({ error: 'Challenge expired or not found' });
      }

      const expectedChallenge = user.current_challenge;
      
      // Always clear challenge after one attempt
      user.current_challenge = undefined;
      user.current_challenge_expires_at = undefined;
      await user.save();

      const { rpID, origin } = getWebAuthnConfig(request);

      const verification = await verifyRegistrationResponse({
        response: body as any,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (verification.verified && (verification as any).registrationInfo) {
        const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = (verification as any).registrationInfo;

        user.authenticators.push({
          credentialID: Buffer.from(credentialID).toString('base64url'),
          credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64url'),
          counter,
          credentialDeviceType,
          credentialBackedUp,
          transports: body.response.transports,
        });

        await user.save();

        return { verified: true };
      }

      return reply.code(400).send({ verified: false, error: 'Verification failed' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid registration response format', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to verify registration' });
    }
  });

  // WebAuthn Authentication Options
  fastify.post('/webauthn/login-options', async (request, reply) => {
    try {
      const { email: identifier } = z.object({ email: z.string() }).parse(request.body);
      const user = await User.findOne({ 
        $or: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }] 
      });

      if (!user || user.authenticators.length === 0) {
        return reply.code(400).send({ error: 'Biometric authentication not set up for this user' });
      }

      const { rpID } = getWebAuthnConfig(request);

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: user.authenticators.map(auth => ({
          id: auth.credentialID,
          type: 'public-key',
          transports: auth.transports as any[],
        })),
        userVerification: 'preferred',
      });

      user.current_challenge = options.challenge;
      user.current_challenge_expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 min
      await user.save();

      return options;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate authentication options' });
    }
  });

  // WebAuthn Authentication Verify
  fastify.post('/webauthn/login-verify', async (request, reply) => {
    try {
      const { email: identifier, response } = z.object({
        email: z.string(),
        response: z.any()
      }).parse(request.body);

      const user = await User.findOne({ 
        $or: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }] 
      }).select('+current_challenge +current_challenge_expires_at +password');

      if (!user || !user.current_challenge || !user.current_challenge_expires_at || user.current_challenge_expires_at < new Date()) {
        return reply.code(400).send({ error: 'User, challenge expired or not found' });
      }

      if (user.is_blocked) {
        return reply.code(403).send({ error: 'Your account has been suspended' });
      }

      const authenticator = user.authenticators.find(auth => auth.credentialID === response.id);
      if (!authenticator) {
        return reply.code(400).send({ error: 'Authenticator not found' });
      }

      const expectedChallenge = user.current_challenge;

      // Always clear challenge after one attempt
      user.current_challenge = undefined;
      user.current_challenge_expires_at = undefined;
      await user.save();

      const { rpID, origin } = getWebAuthnConfig(request);

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: authenticator.credentialID,
          publicKey: Buffer.from(authenticator.credentialPublicKey, 'base64url'),
          counter: authenticator.counter,
          transports: authenticator.transports as any[],
        },
      });

      if (verification.verified) {
        // Update counter
        authenticator.counter = verification.authenticationInfo.newCounter;
        await user.save();

        // Generate JWT token
        const token = fastify.jwt.sign({
          userId: user._id.toString(),
          email: user.email,
          username: user.username,
          role: user.role,
        });

        return {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            banner_url: user.banner_url,
            role: user.role,
            is_blocked: user.is_blocked,
            is_verified: user.is_verified,
            is_2fa_enabled: user.is_2fa_enabled,
            phone_number: user.phone_number,
            is_phone_verified: user.is_phone_verified,
            notifications: user.notifications,
            preferences: user.preferences,
            unread_messages_count: user.unread_messages_count || 0,
            authenticators: user.authenticators,
          },
          token,
        };
      }

      return reply.code(400).send({ verified: false, error: 'Authentication failed' });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to verify authentication' });
    }
  });

  // Register
  fastify.post('/register', async (request, reply) => {
    if (!checkAuthRateLimit(request.ip)) {
      return reply.code(429).send({ error: 'Too many registration attempts. Please try again later.' });
    }
    try {
      const body = request.body;
      
      const { email, username, password, display_name } = registerSchema.parse(body);

      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [{ email }, { username: username || '' }] 
      });
      if (existingUser) {
        return reply.code(409).send({ error: 'User or email already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Generate username logic
      const baseUsername = (username || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '');
      let finalUser = null;
      let attempts = 0;

      while (!finalUser && attempts < 5) {
        // If username was provided, try it exactly as is first.
        // If not, or if it's taken, start adding suffixes.
        const suffix = (attempts === 0) ? '' : randomInt(1000, 9999).toString();
        const candidate = (attempts === 0 && username) ? username.toLowerCase() : `${baseUsername}${suffix}`;

        try {
          const newUser = new User({
            email: email.toLowerCase(),
            username: candidate,
            password: hashedPassword,
            display_name,
            is_verified: false
          });
          await newUser.save();
          finalUser = newUser;
        } catch (err: any) {
          if (err.code === 11000) {
            // Check if it's a username conflict
            const isUsernameConflict = err.message?.includes('username') || 
                                      (err.keyPattern && err.keyPattern.username) ||
                                      JSON.stringify(err).includes('username');
            
            if (isUsernameConflict) {
              // If user provided a specific username and it's taken, return error
              if (username && attempts === 0) {
                return reply.code(409).send({ error: 'Username is already taken' });
              }
              attempts++;
              continue;
            }
            
            // If it's an email conflict
            const isEmailConflict = err.message?.includes('email') || 
                                   (err.keyPattern && err.keyPattern.email) ||
                                   JSON.stringify(err).includes('email');
            if (isEmailConflict) {
              return reply.code(409).send({ error: 'Email already exists' });
            }
          }
          throw err;
        }
      }

      if (!finalUser) {
        return reply.code(500).send({ error: 'Could not generate a unique username' });
      }

      const user = finalUser;

      // Generate JWT token
      const token = fastify.jwt.sign({
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      });

      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          banner_url: user.banner_url,
          role: user.role,
          is_blocked: user.is_blocked,
          is_verified: user.is_verified,
          is_2fa_enabled: user.is_2fa_enabled,
          phone_number: user.phone_number,
          is_phone_verified: user.is_phone_verified,
          notifications: user.notifications,
          preferences: user.preferences,
          unread_messages_count: user.unread_messages_count || 0,
          authenticators: user.authenticators,
        },
        token,
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      
      fastify.log.error(error, 'Registration Error:');

      // Check for connection errors specifically
      if (error.name === 'MongooseServerSelectionError' || error.name === 'MongooseError' || error.message?.includes('ECONNREFUSED') || error.message?.includes('buffering timed out')) {
        return reply.code(503).send({ 
          error: 'Database connection error. Please ensure MongoDB is running.',
          message: 'Database connection error'
        });
      }
      
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? (error?.message || error?.errmsg || JSON.stringify(error))
        : 'Internal server error';
      
      return reply.code(500).send({ 
        error: errorMessage,
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error?.stack || error) : undefined,
        raw: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  });

  // Forgot Password
  fastify.post('/forgot-password', async (request, reply) => {
    try {
      const { email: identifier } = z.object({ email: z.string().min(3) }).parse(request.body);
      const user = await User.findOne({ 
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier.toLowerCase() }
        ]
      });

      if (!user || !user.email) {
        // Return success even if user not found for security
        return { success: true, message: 'If an account exists, a reset link has been sent.' };
      }

      const email = user.email;

      // Generate a secure reset token
      const resetToken = randomBytes(32).toString('hex');
      user.reset_token = resetToken;
      user.reset_token_expiry = new Date(Date.now() + 3600000); // 1 hour
      await user.save();

      // Send email
      await sendVerificationCode(email, resetToken);

      // In development, log the token
      if (process.env.NODE_ENV === 'development') {
        fastify.log.info(`[DEV] Reset token for ${email}: ${resetToken}`);
      }

      return { 
        success: true, 
        message: 'If an account exists, a reset link has been sent.',
        // For development, we return the token
        ...(process.env.NODE_ENV === 'development' ? { dev_token: resetToken } : {})
      };
    } catch (error) {
      fastify.log.error(error as any, 'Forgot Password Error:');
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Reset Password
  fastify.post('/reset-password', async (request, reply) => {
    try {
      const { token, newPassword } = z.object({ 
        token: z.string(), 
        newPassword: z.string().min(6) 
      }).parse(request.body);

      const user = await User.findOne({ 
        reset_token: token,
        reset_token_expiry: { $gt: new Date() }
      });

      if (!user) {
        return reply.code(400).send({ error: 'Invalid or expired token' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
      user.reset_token = undefined;
      user.reset_token_expiry = undefined;
      await user.save();

      return { success: true, message: 'Password has been reset successfully.' };
    } catch (error) {
      fastify.log.error(error as any, 'Reset Password Error:');
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get current user (me)
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      // Use projection to only fetch needed fields
      const user = await User.findById(userId).select('username email display_name bio avatar_url banner_url is_verified is_2fa_enabled phone_number is_phone_verified role is_blocked notifications preferences unread_messages_count created_at updated_at');

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return {
        id: user._id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url,
        is_verified: user.is_verified,
        is_2fa_enabled: user.is_2fa_enabled,
        phone_number: user.phone_number,
        is_phone_verified: user.is_phone_verified,
        role: user.role,
        is_blocked: user.is_blocked,
        notifications: user.notifications,
        preferences: user.preferences,
        unread_messages_count: user.unread_messages_count || 0,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update user profile
  fastify.patch('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const updateSchema = z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
      display_name: z.string().max(50).optional(),
      bio: z.string().max(500).optional(),
      avatar_url: z.string().optional(),
      banner_url: z.string().optional(),
      notifications: z.object({
        notif_sales: z.boolean().optional(),
        notif_msg: z.boolean().optional(),
        notif_follow: z.boolean().optional(),
        notif_live: z.boolean().optional(),
      }).optional(),
      preferences: z.object({
        theme: z.enum(['light', 'dark']).optional(),
        language: z.string().optional(),
      }).optional(),
    });

    try {
      const updateData = updateSchema.parse(request.body);
      const { userId } = request.user as { userId: string };

      const user = await User.findByIdAndUpdate(
        userId,
        { ...updateData, updated_at: new Date() },
        { new: true }
      );

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return {
        id: user._id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url,
        is_verified: user.is_verified,
        is_2fa_enabled: user.is_2fa_enabled,
        phone_number: user.phone_number,
        is_phone_verified: user.is_phone_verified,
        role: user.role,
        is_blocked: user.is_blocked,
        notifications: user.notifications,
        preferences: user.preferences,
        unread_messages_count: user.unread_messages_count || 0,
        authenticators: user.authenticators,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update password
  fastify.post('/change-password', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+password');

      if (!user || !user.password) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return reply.code(400).send({ error: 'Invalid current password' });
      }

      user.password = await bcrypt.hash(newPassword, 12);
      await user.save();

      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update email (Step 1: Send verification code)
  fastify.post('/change-email', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { newEmail, password } = z.object({
        newEmail: z.string().email(),
        password: z.string(),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+password');

      if (!user || !user.password) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return reply.code(400).send({ error: 'Invalid password' });
      }

      // Check if new email already exists
      const existingUser = await User.findOne({ email: newEmail });
      if (existingUser) {
        return reply.code(409).send({ error: 'Email already in use' });
      }

      // Generate 6-digit code
      const code = randomInt(100000, 1000000).toString();
      user.email_verification_code = code;
      user.email_verification_expiry = new Date(Date.now() + 15 * 60000); // 15 mins
      await user.save();

      // Send email
      await sendVerificationCode(newEmail, code);

      return { success: true, message: 'Verification code sent to your new email' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Verify and update email (Step 2)
  fastify.post('/verify-email', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { newEmail, token } = z.object({
        newEmail: z.string().email(),
        token: z.string().length(6),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+email_verification_code +email_verification_expiry');

      if (!user || !user.email_verification_code) {
        return reply.code(400).send({ error: 'No verification pending' });
      }

      if (user.email_verification_code !== token) {
        return reply.code(400).send({ error: 'Invalid verification code' });
      }

      if (user.email_verification_expiry && user.email_verification_expiry < new Date()) {
        return reply.code(400).send({ error: 'Verification code expired' });
      }

      user.email = newEmail;
      user.email_verification_code = undefined;
      user.email_verification_expiry = undefined;
      user.is_verified = true; // Mark as verified since they just proved they own the email
      await user.save();

      return { success: true, message: 'Email updated and verified successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update phone (Step 1: Send verification code via WhatsApp/SMS)
  fastify.post('/change-phone', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { newPhone } = z.object({
        newPhone: z.string().min(10),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId);

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Check if new phone already exists
      const existingUser = await User.findOne({ phone_number: newPhone });
      if (existingUser && existingUser._id.toString() !== userId) {
        return reply.code(409).send({ error: 'Phone number already in use' });
      }

      // Generate 6-digit code
      const code = randomInt(100000, 1000000).toString();
      user.phone_verification_code = code;
      user.phone_verification_expiry = new Date(Date.now() + 15 * 60000); // 15 mins
      await user.save();

      // Send WhatsApp/SMS
      await sendWhatsAppVerification(newPhone, code);

      return { success: true, message: 'Verification code sent to your phone' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Verify and update phone (Step 2)
  fastify.post('/verify-phone', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { newPhone, token } = z.object({
        newPhone: z.string().min(10),
        token: z.string().length(6),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+phone_verification_code +phone_verification_expiry');

      if (!user || !user.phone_verification_code) {
        return reply.code(400).send({ error: 'No verification pending' });
      }

      if (user.phone_verification_code !== token) {
        return reply.code(400).send({ error: 'Invalid verification code' });
      }

      if (user.phone_verification_expiry && user.phone_verification_expiry < new Date()) {
        return reply.code(400).send({ error: 'Verification code expired' });
      }

      user.phone_number = newPhone;
      user.phone_verification_code = undefined;
      user.phone_verification_expiry = undefined;
      user.is_phone_verified = true;
      await user.save();

      return { success: true, message: 'Phone number updated and verified successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Setup 2FA
  fastify.post('/2fa/setup', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId);

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Generate a new secret and save it to the user
      const secret = generateSecret();
      user.two_factor_secret = secret;
      await user.save();

      const otpauth = generateURI({ secret, label: user.email, issuer: 'Aicon X' });
      const qrCode = await QRCode.toDataURL(otpauth);

      return { secret, qrCode };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Enable 2FA
  fastify.post('/2fa/enable', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { token } = z.object({
        token: z.string().length(6),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+two_factor_secret');

      if (!user || !user.two_factor_secret) {
        return reply.code(400).send({ error: '2FA setup not initiated' });
      }

      const isValid = verifySync({ 
        token, 
        secret: user.two_factor_secret 
      });

      if (!isValid) {
        return reply.code(400).send({ error: 'Invalid verification code' });
      }

      user.is_2fa_enabled = true;
      await user.save();

      return { success: true, message: '2FA enabled successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Disable 2FA
  fastify.post('/2fa/disable', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { token } = z.object({
        token: z.string().length(6),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+two_factor_secret');

      if (!user || !user.two_factor_secret) {
        return reply.code(400).send({ error: '2FA is not enabled' });
      }

      const isValid = verifySync({ 
        token, 
        secret: user.two_factor_secret 
      });

      if (!isValid) {
        return reply.code(400).send({ error: 'Invalid verification code' });
      }

      user.two_factor_secret = undefined;
      user.is_2fa_enabled = false;
      await user.save();

      return { success: true, message: '2FA disabled successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Logout (client-side token removal)
  fastify.post('/logout', async (request, reply) => {
    // In a stateless JWT system, logout is handled client-side
    return { success: true };
  });

  // Address Management Routes
  fastify.get('/me/addresses', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await User.findById((request.user as any).userId);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return { addresses: user.saved_addresses || [] };
  });

  fastify.post('/me/addresses', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const addressSchema = z.object({
      label: z.string().optional(),
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string().default('NG'),
      phone: z.string().optional(),
      is_default: z.boolean().default(false),
    });

    try {
      const body = addressSchema.parse(request.body);
      const user = await User.findById((request.user as any).userId);
      if (!user) return reply.code(404).send({ error: 'User not found' });

      if (!user.saved_addresses) user.saved_addresses = [];

      if (body.is_default) {
        user.saved_addresses.forEach(a => a.is_default = false);
      } else if (user.saved_addresses.length === 0) {
        body.is_default = true;
      }

      user.saved_addresses.push(body as any);
      await user.save();

      return { message: 'Address added', addresses: user.saved_addresses };
    } catch (error: any) {
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'Invalid address data', details: error.errors });
      throw error;
    }
  });

  fastify.put('/me/addresses/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const addressSchema = z.object({
      label: z.string().optional(),
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      is_default: z.boolean().optional(),
    });

    try {
      const body = addressSchema.parse(request.body);
      const user = await User.findById((request.user as any).userId);
      if (!user) return reply.code(404).send({ error: 'User not found' });

      const address = user.saved_addresses?.find(a => (a as any)._id.toString() === id);
      if (!address) return reply.code(404).send({ error: 'Address not found' });

      if (body.is_default && !address.is_default) {
        user.saved_addresses?.forEach(a => a.is_default = false);
      }

      Object.assign(address, body);
      await user.save();

      return { message: 'Address updated', addresses: user.saved_addresses };
    } catch (error: any) {
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'Invalid address data', details: error.errors });
      throw error;
    }
  });

  fastify.delete('/me/addresses/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await User.findById((request.user as any).userId);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    user.saved_addresses = user.saved_addresses?.filter(a => (a as any)._id.toString() !== id);
    await user.save();

    return { message: 'Address deleted', addresses: user.saved_addresses };
  });

  fastify.patch('/me/addresses/:id/default', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await User.findById((request.user as any).userId);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    user.saved_addresses?.forEach(a => {
      a.is_default = (a as any)._id.toString() === id;
    });

    await user.save();
    return { message: 'Default address updated', addresses: user.saved_addresses };
  });
}