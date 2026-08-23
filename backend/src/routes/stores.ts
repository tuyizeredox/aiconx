import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { Store, IStore } from '../models/Store';
import { Product } from '../models/Product';
import { Follow } from '../models/Follow';
import { z } from 'zod';
import { checkCustomDomainLimit, checkShippingZoneLimit, checkStoreLimit, checkStorefrontLimit, getVendorPlan } from '../middleware/subscription';

// A store's physical location. Every part is optional so a vendor can publish
// just a city (still matchable by name in "near me") or drop a precise pin.
const storeLocationSchema = z.object({
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  city: z.string().max(120).nullish(),
  country: z.string().max(120).nullish(),
}).strict();

const createStoreSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string(),
  logo_url: z.string().optional(),
  banner_url: z.string().optional(),
  owner_name: z.string().optional(),
  
    // Payment Settings
    payment_method: z.enum(['bank_transfer', 'paypal', 'mobile_money', 'itecpay', 'other']).optional(),
  bank_name: z.string().optional(),
  bank_account_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  routing_number: z.string().optional(),
  paypal_email: z.string().email().optional().or(z.literal('')),
  mobile_money_number: z.string().optional(),
  
  // Delivery Settings
  delivery_settings: z.object({
    shipping_enabled: z.boolean().default(true),
    delivery_enabled: z.boolean().default(false),
    pickup_enabled: z.boolean().default(false),
    delivery_fee: z.number().min(0).default(0),
    delivery_radius_km: z.number().min(0).optional(),
    min_order_for_delivery: z.number().min(0).default(0),
    free_delivery_above: z.number().min(0).optional(),
    delivery_time_est: z.string().optional(),
    pickup_instructions: z.string().optional(),
  }).optional(),
  
  // Additional Info
  phone_number: z.string().optional(),
  address: z.string().optional(),
  location: storeLocationSchema.optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  custom_domain: z.string().optional(),
  social_links: z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    tiktok: z.string().optional(),
  }).optional(),
});

import { escapeRegex } from '../utils/sanitize';

// ---------------------------------------------------------------------------
// Storefront Builder (Pro/Elite) validation
// ---------------------------------------------------------------------------
// Blocks are polymorphic (each `type` has a different `data` shape), so we
// validate the real shape/bounds here via zod rather than in the Mongoose
// schema (which just stores the whole thing as Mixed). Adding a new block
// type later only means widening this schema, no DB migration.

const blockTypeEnum = z.enum([
  'hero', 'rich_text', 'image', 'image_text', 'gallery', 'product_grid',
  'video', 'testimonials', 'cta_banner', 'categories', 'contact', 'divider'
]);

const heroDataSchema = z.object({
  type: z.literal('hero'),
  headline: z.string().max(120).optional(),
  subheadline: z.string().max(300).optional(),
  image_url: z.string().max(2000).optional(),
  video_url: z.string().max(2000).optional(),
  cta_text: z.string().max(40).optional(),
  cta_link: z.string().max(500).optional(),
  overlay_opacity: z.number().min(0).max(1).optional(),
  height: z.enum(['compact', 'tall']).optional(),
}).strict();

const richTextDataSchema = z.object({
  type: z.literal('rich_text'),
  title: z.string().max(120).optional(),
  body: z.string().max(5000).optional(),
}).strict();

const imageDataSchema = z.object({
  type: z.literal('image'),
  image_url: z.string().max(2000).optional(),
  caption: z.string().max(200).optional(),
  link: z.string().max(500).optional(),
}).strict();

const imageTextDataSchema = z.object({
  type: z.literal('image_text'),
  image_url: z.string().max(2000).optional(),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
  cta_text: z.string().max(40).optional(),
  cta_link: z.string().max(500).optional(),
  image_position: z.enum(['left', 'right']).optional(),
}).strict();

const galleryDataSchema = z.object({
  type: z.literal('gallery'),
  title: z.string().max(120).optional(),
  images: z.array(z.string().max(2000)).max(20).optional(),
}).strict();

const productGridDataSchema = z.object({
  type: z.literal('product_grid'),
  title: z.string().max(120).optional(),
  mode: z.enum(['curated', 'best_selling', 'newest', 'category']).default('newest'),
  product_ids: z.array(z.string().max(64)).max(24).optional(),
  category: z.string().max(40).optional(),
  columns: z.enum(['2', '3', '4']).optional(),
}).strict();

const videoDataSchema = z.object({
  type: z.literal('video'),
  video_url: z.string().max(2000).optional(),
  caption: z.string().max(200).optional(),
}).strict();

const testimonialsDataSchema = z.object({
  type: z.literal('testimonials'),
  title: z.string().max(120).optional(),
  limit: z.number().min(1).max(20).optional(),
}).strict();

const ctaBannerDataSchema = z.object({
  type: z.literal('cta_banner'),
  heading: z.string().max(120).optional(),
  body: z.string().max(300).optional(),
  button_text: z.string().max(40).optional(),
  button_link: z.string().max(500).optional(),
}).strict();

const categoriesDataSchema = z.object({
  type: z.literal('categories'),
  title: z.string().max(120).optional(),
}).strict();

const contactDataSchema = z.object({
  type: z.literal('contact'),
  title: z.string().max(120).optional(),
  show_social: z.boolean().optional(),
  show_address: z.boolean().optional(),
}).strict();

const dividerDataSchema = z.object({
  type: z.literal('divider'),
  height: z.enum(['sm', 'md', 'lg']).optional(),
}).strict();

const blockDataSchema = z.discriminatedUnion('type', [
  heroDataSchema, richTextDataSchema, imageDataSchema, imageTextDataSchema,
  galleryDataSchema, productGridDataSchema, videoDataSchema, testimonialsDataSchema,
  ctaBannerDataSchema, categoriesDataSchema, contactDataSchema, dividerDataSchema,
]);

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #ea580c');

const blockStyleSchema = z.object({
  background_color: hexColor.optional(),
  background_image_url: z.string().max(2000).optional(),
  padding: z.enum(['none', 'sm', 'md', 'lg']).optional(),
  text_align: z.enum(['left', 'center', 'right']).optional(),
  width: z.enum(['contained', 'full']).optional(),
}).strict();

export const blockSchema = z.object({
  id: z.string().min(1).max(64),
  type: blockTypeEnum,
  visible: z.boolean().default(true),
  style: blockStyleSchema.optional(),
  data: blockDataSchema,
}).strict().refine((b) => b.data.type === b.type, {
  message: 'data.type must match block type',
  path: ['data', 'type'],
});

export { blockTypeEnum };

export const storefrontConfigSchema = z.object({
  enabled: z.boolean(),
  theme: z.object({
    primary_color: hexColor.optional(),
    accent_color: hexColor.optional(),
  }).strict().optional(),
  blocks: z.array(blockSchema).max(30),
}).strict();

// The unpublished working copy. Same shape minus `enabled` — a draft is by
// definition not live, so it can't carry a publish flag. `updated_at` is set
// server-side, never accepted from the client.
export const storefrontDraftSchema = z.object({
  theme: z.object({
    primary_color: hexColor.optional(),
    accent_color: hexColor.optional(),
  }).strict().optional(),
  blocks: z.array(blockSchema).max(30),
  generated_by_ai: z.boolean().optional(),
}).strict();

// Belt-and-suspenders guard against a schema-valid but huge payload (zod can't
// sum string lengths across 30 blocks on its own).
const MAX_STOREFRONT_CONFIG_BYTES = 200_000;

// Drops any cta_link/button_link that isn't a real, external, clickable URL —
// a bare "/shop" or "/about" is schema-valid (it's just a string) but doesn't
// correspond to any actual route on this platform and would 404 for visitors.
// Applied on every save (AI-generated or hand-typed in the builder) so a
// stray relative path can never make it into a published storefront. An
// empty link is safe: block renderers fall back to the store's own catalog.
const SAFE_LINK_PATTERN = /^(https?:\/\/|mailto:|tel:|wa\.me\/)/i;
export function sanitizeStorefrontLinks<T extends { data?: Record<string, any> }>(blocks: T[]): T[] {
  for (const block of blocks) {
    if (!block?.data || typeof block.data !== 'object') continue;
    for (const field of ['cta_link', 'button_link'] as const) {
      const value = block.data[field];
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      block.data[field] = SAFE_LINK_PATTERN.test(trimmed) ? trimmed : '';
    }
  }
  return blocks;
}

// The storefront draft is the vendor's unpublished work — it must never reach
// anyone else, and these store endpoints are public. Every response built from
// a full store document goes through here.
function forViewer<T extends { owner_username?: string; storefront_draft?: any }>(store: T, viewerUsername?: string): T {
  if (viewerUsername && store.owner_username === viewerUsername.toLowerCase()) return store;
  const { storefront_draft, ...visible } = store;
  return visible as T;
}

// Computes whether a store's custom storefront should actually render.
// A vendor's saved config is never deleted on downgrade — this just flips
// false until they re-upgrade, so re-enabling instantly restores their work.
async function computeStorefrontActive(store: { owner_username: string; storefront_config?: any }) {
  if (!store.storefront_config?.enabled) return false;
  const { limits } = await getVendorPlan(store.owner_username);
  return !!limits.custom_storefront;
}

// Store pages are addressed by slug (/store/kigali-coffee), but every link
// shared, notified or bookmarked before slugs existed carries an ObjectId — so
// this endpoint accepts either. A renamed store is also findable by the handle
// it used to have; the response's own `slug` is the canonical one, which the
// client uses to correct the address bar.
async function findStoreByIdentifier(identifier: string) {
  if (mongoose.Types.ObjectId.isValid(identifier) && String(new mongoose.Types.ObjectId(identifier)) === identifier) {
    const byId = await Store.findById(identifier).lean();
    if (byId) return byId;
  }
  const slug = identifier.toLowerCase();
  return (await Store.findOne({ slug }).lean()) || (await Store.findOne({ previous_slugs: slug }).lean());
}

const EARTH_RADIUS_KM = 6371;
const toRadians = (deg: number) => (deg * Math.PI) / 180;

// Great-circle distance between two lat/lng pairs, in kilometres.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export async function storeRoutes(fastify: FastifyInstance) {
  // Stores worth following, that the caller isn't already following.
  //
  // The mirror of /users/suggested, and it exists for the same reason: a
  // shopper who already follows the biggest stores was getting an empty
  // "suggested" section, because the exclusion only happened after the top-N
  // cut. Excluding first means a full list comes back every time.
  fastify.get('/suggested', {
    preHandler: [fastify.authenticateOptional],
  }, async (request, reply) => {
    try {
      const { limit = 10 } = request.query as any;
      const user = request.user as any;

      const filter: any = { status: 'active' };

      if (user?.username) {
        const username = user.username.toLowerCase();
        const following = await Follow.find(
          { follower_username: username, follow_type: 'store' },
          { target_id: 1, following_username: 1 }
        ).lean();

        // A store follow records both the store id and the owner, and older
        // rows may carry only one — exclude on either so a followed store
        // can't slip back into the list.
        const followedIds = following.map(f => f.target_id).filter(Boolean);
        const followedOwners = following.map(f => f.following_username).filter(Boolean);

        const excludeIds = followedIds.filter(id => mongoose.Types.ObjectId.isValid(String(id)));
        if (excludeIds.length) filter._id = { $nin: excludeIds };

        // Never suggest a vendor their own store.
        filter.owner_username = { $nin: [...followedOwners, username] };
      }

      const stores = await Store.find(filter)
        .sort({ follower_count: -1, created_at: -1 })
        .limit(parseInt(limit))
        .select('name slug logo_url category owner_username follower_count product_count is_verified')
        .lean();

      return { data: stores.map(store => ({ ...store, id: String(store._id) })) };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Stores near a point — powers the marketplace's "near me" filter.
  //
  // Matching is deliberately two-tier so the feature is useful before every
  // vendor has dropped a map pin: stores with coordinates are measured and
  // sorted by real distance, and stores that only named their city are still
  // returned (with distance_km: null) when that city is passed in. Callers
  // that only want measured results can ignore entries without a distance.
  fastify.get('/nearby', async (request, reply) => {
    try {
      const { lat, lng, radius_km, city, limit = 100 } = request.query as any;

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
      const cityQuery = typeof city === 'string' ? city.trim() : '';

      if (!hasCoords && !cityQuery) {
        return reply.code(400).send({
          error: 'Missing location',
          message: 'Provide either lat and lng, or a city name.',
        });
      }

      const radius = Math.min(Math.max(parseFloat(radius_km) || 25, 1), 500);
      const resultLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 200);
      const select = 'name slug logo_url category follower_count owner_username status is_verified product_count rating_avg address location';

      const conditions: any[] = [];

      if (hasCoords) {
        // Bounding box first so Mongo can use the location index instead of
        // loading every store on the platform to measure it in memory.
        const latDelta = radius / 111.32;
        const cosLat = Math.cos(toRadians(latitude));
        // Near the poles the longitude degree shrinks to nothing; fall back to
        // the whole range rather than dividing by ~0.
        const lngDelta = Math.abs(cosLat) < 0.01 ? 180 : radius / (111.32 * cosLat);
        conditions.push({
          'location.lat': { $gte: latitude - latDelta, $lte: latitude + latDelta },
          'location.lng': { $gte: longitude - lngDelta, $lte: longitude + lngDelta },
        });
      }

      if (cityQuery) {
        const cityRegex = new RegExp(escapeRegex(cityQuery), 'i');
        conditions.push({ $or: [{ 'location.city': cityRegex }, { address: cityRegex }] });
      }

      const stores = await Store.find({ status: 'active', $or: conditions })
        .select(select)
        .limit(500)
        .lean();

      const measured = stores.map((store: any) => {
        const storeLat = store.location?.lat;
        const storeLng = store.location?.lng;
        const distance_km = hasCoords && Number.isFinite(storeLat) && Number.isFinite(storeLng)
          ? Math.round(haversineKm(latitude, longitude, storeLat, storeLng) * 10) / 10
          : null;
        return { ...store, id: String(store._id), distance_km };
      });

      // The bounding box is a square around a circular radius, so trim the
      // corners; city-only matches (no distance) are kept and listed last.
      const withinRadius = measured.filter(s => s.distance_km === null || s.distance_km <= radius);

      withinRadius.sort((a, b) => {
        if (a.distance_km === null && b.distance_km === null) return (b.follower_count || 0) - (a.follower_count || 0);
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        return a.distance_km - b.distance_km;
      });

      return {
        data: withinRadius.slice(0, resultLimit),
        total: withinRadius.length,
        radius_km: radius,
        center: hasCoords ? { lat: latitude, lng: longitude } : null,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // List stores with filtering and pagination
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        category,
        status = 'active',
        search,
        limit = 20,
        skip = 0,
        sort = '-follower_count'
      } = query;

      const filter: any = {};
      if (category) filter.category = category;
      if (status) filter.status = status;

      if (search) {
        filter.$text = { $search: search };
      }

      const stores = await Store.find(filter, filter.$text ? { score: { $meta: 'textScore' } } : {})
        .sort(filter.$text ? { score: { $meta: 'textScore' }, follower_count: -1 } : sort)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .select('name slug logo_url category follower_count owner_username status is_verified product_count rating_avg address location')
        .lean();

      const total = await Store.countDocuments(filter);

      return {
        data: stores,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get store by slug (preferred) or by ObjectId (legacy links)
  fastify.get('/:id', { preHandler: [fastify.authenticateOptional] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const store = await findStoreByIdentifier(id);

      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      // Get store products
      const products = await Product.find({ store_id: String(store._id), status: 'active' })
        .limit(20)
        .lean();

      const storefront_active = await computeStorefrontActive(store);

      return {
        ...forViewer(store, (request.user as any)?.username),
        // Resolving by slug means the caller may not know the id yet, and every
        // dependent query (products, reviews, follows) keys off it.
        id: String(store._id),
        storefront_active,
        products
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get store by owner username
  fastify.get('/owner/username/:username', { preHandler: [fastify.authenticateOptional] }, async (request, reply) => {
    try {
      const { username } = request.params as { username: string };
      const store = await Store.findOne({ owner_username: username.toLowerCase() }).lean();

      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      const storefront_active = await computeStorefrontActive(store);
      return { ...forViewer(store, (request.user as any)?.username), storefront_active };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get store by owner identifier (username)
  fastify.get('/owner/:identifier', { preHandler: [fastify.authenticateOptional] }, async (request, reply) => {
    try {
      const { identifier } = request.params as { identifier: string };
      
      const filter = { owner_username: identifier.toLowerCase() };

      const store = await Store.findOne(filter).lean();

      // Return null (200 OK) instead of 404 if store doesn't exist
      // This is expected behavior - not all users have stores
      if (!store) {
        return reply.code(200).send(null);
      }

      const storefront_active = await computeStorefrontActive(store);
      return { ...forViewer(store, (request.user as any)?.username), storefront_active };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Create store
  fastify.post('/', {
    preHandler: [fastify.authenticate, checkStoreLimit],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = createStoreSchema.parse(request.body);

      const store = new Store({
        ...body,
        owner_username: user.username,
        status: 'active', // In production, might be 'pending'
        created_at: new Date(),
        updated_at: new Date()
      });

      await store.save();
      return store;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      if (error?.code === 11000 && error?.keyPattern?.owner_username) {
        return reply.code(400).send({ error: 'User already has a store' });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update store
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, checkCustomDomainLimit, checkStorefrontLimit],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IStore>;
      const user = request.user as any;

      const store = await Store.findById(id);
      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      if (store.owner_username !== user.username) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      if ((body as any).location !== undefined && (body as any).location !== null) {
        (body as any).location = storeLocationSchema.parse((body as any).location);
      }

      if ((body as any).storefront_config !== undefined) {
        const parsed = storefrontConfigSchema.parse((body as any).storefront_config);
        if (Buffer.byteLength(JSON.stringify(parsed), 'utf8') > MAX_STOREFRONT_CONFIG_BYTES) {
          return reply.code(400).send({ error: 'Storefront config is too large' });
        }
        parsed.blocks = sanitizeStorefrontLinks(parsed.blocks);
        (body as any).storefront_config = parsed;
      }

      // The builder auto-saves the draft as the vendor works, and sends null to
      // drop it (on publish, or when they discard the draft).
      let clearDraft = false;
      if ((body as any).storefront_draft !== undefined) {
        if ((body as any).storefront_draft === null) {
          clearDraft = true;
          delete (body as any).storefront_draft;
        } else {
          const parsedDraft = storefrontDraftSchema.parse((body as any).storefront_draft);
          if (Buffer.byteLength(JSON.stringify(parsedDraft), 'utf8') > MAX_STOREFRONT_CONFIG_BYTES) {
            return reply.code(400).send({ error: 'Storefront draft is too large' });
          }
          parsedDraft.blocks = sanitizeStorefrontLinks(parsedDraft.blocks);
          (body as any).storefront_draft = { ...parsedDraft, updated_at: new Date() };
        }
      }

      // Update allowed fields
      const allowedUpdates = [
        'name', 'description', 'logo_url', 'banner_url', 'category',
        'payment_method', 'bank_name', 'bank_account_name', 'bank_account_number', 'routing_number', 'paypal_email', 'mobile_money_number',
        'delivery_settings',
        'phone_number', 'address', 'location', 'website_url', 'custom_domain', 'social_links',
        'storefront_config', 'storefront_draft'
      ];
      allowedUpdates.forEach(field => {
        if ((body as any)[field] !== undefined) {
          (store as any)[field] = (body as any)[field];
        }
      });

      if (clearDraft) {
        // Mixed paths need the explicit markModified for mongoose to emit the
        // $unset — assigning undefined alone is silently dropped.
        store.set('storefront_draft', undefined);
        store.markModified('storefront_draft');
      }

      store.updated_at = new Date();
      await store.save();

      return store;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Submit (or resubmit) identity verification for the caller's store
  fastify.post('/verification', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = z.object({
        document_type: z.enum(['national_id', 'passport']),
        document_number: z.string().min(1),
        document_image_url: z.string().min(1),
      }).parse(request.body);

      const store = await Store.findOne({ owner_username: user.username.toLowerCase() });
      if (!store) {
        return reply.code(404).send({ error: 'You need to create a store before submitting verification.' });
      }

      if (store.verification_status === 'pending' || store.verification_status === 'approved') {
        return reply.code(409).send({
          error: 'Verification already in progress',
          message: store.verification_status === 'approved'
            ? 'Your store is already verified.'
            : 'Your verification request is already under review.',
        });
      }

      store.verification_status = 'pending';
      store.identity_document_type = body.document_type;
      store.identity_document_number = body.document_number;
      store.identity_document_image_url = body.document_image_url;
      store.identity_submitted_at = new Date();
      store.identity_rejection_reason = undefined;
      store.updated_at = new Date();
      await store.save();

      return store;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
}