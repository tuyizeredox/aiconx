import { FastifyInstance } from 'fastify';
import { Store, IStore } from '../models/Store';
import { Product } from '../models/Product';
import { z } from 'zod';
import { checkCustomDomainLimit, checkShippingZoneLimit } from '../middleware/subscription';

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

export async function storeRoutes(fastify: FastifyInstance) {
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
        .select('name logo_url category follower_count owner_username status is_verified')
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

  // Get store by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const store = await Store.findById(id).lean();

      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      // Get store products
      const products = await Product.find({ store_id: id, status: 'active' })
        .limit(20)
        .lean();

      return {
        ...store,
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
  fastify.get('/owner/username/:username', async (request, reply) => {
    try {
      const { username } = request.params as { username: string };
      const store = await Store.findOne({ owner_username: username.toLowerCase() }).lean();

      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      return store;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get store by owner identifier (username)
  fastify.get('/owner/:identifier', async (request, reply) => {
    try {
      const { identifier } = request.params as { identifier: string };
      
      const filter = { owner_username: identifier.toLowerCase() };

      const store = await Store.findOne(filter).lean();

      // Return null (200 OK) instead of 404 if store doesn't exist
      // This is expected behavior - not all users have stores
      if (!store) {
        return reply.code(200).send(null);
      }

      return store;
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
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = createStoreSchema.parse(request.body);

      // Check if user already has a store
      const existingStore = await Store.findOne({ owner_username: user.username });
      if (existingStore) {
        return reply.code(400).send({ error: 'User already has a store' });
      }

      const store = new Store({
        ...body,
        owner_username: user.username,
        status: 'active', // In production, might be 'pending'
        created_at: new Date(),
        updated_at: new Date()
      });

      await store.save();
      return store;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update store
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, checkCustomDomainLimit],
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

      // Update allowed fields
      const allowedUpdates = [
        'name', 'description', 'logo_url', 'banner_url', 'category',
        'payment_method', 'bank_name', 'bank_account_name', 'bank_account_number', 'routing_number', 'paypal_email', 'mobile_money_number',
        'delivery_settings',
        'phone_number', 'address', 'website_url', 'custom_domain', 'social_links'
      ];
      allowedUpdates.forEach(field => {
        if ((body as any)[field] !== undefined) {
          (store as any)[field] = (body as any)[field];
        }
      });

      store.updated_at = new Date();
      await store.save();

      return store;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}