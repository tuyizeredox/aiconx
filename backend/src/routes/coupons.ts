import { FastifyInstance } from 'fastify';
import { Coupon, ICoupon } from '../models/Coupon';
import { User } from '../models/User';
import { checkCouponLimit } from '../middleware/subscription';

export async function couponRoutes(fastify: FastifyInstance) {
  // List coupons with filtering
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        vendor_username,
        store_id,
        is_active = true,
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (vendor_username) filter.vendor_username = vendor_username;
      if (store_id) filter.store_id = store_id;
      if (is_active !== undefined) filter.is_active = is_active === 'true';

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const coupons = await Coupon
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // store_id is a string, so we can't use .populate()
      // If we need store info, we would need to fetch it separately.

      const total = await Coupon.countDocuments(filter);

      reply.send({
        coupons,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get coupon by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const coupon = await Coupon.findById(id);

      if (!coupon) {
        return reply.code(404).send({ error: 'Coupon not found' });
      }

      reply.send(coupon);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get coupon by code
  fastify.get('/code/:code', async (request, reply) => {
    try {
      const { code } = request.params as { code: string };

      const coupon = await Coupon.findOne({
        code: code.toUpperCase(),
        is_active: true
      });

      if (!coupon) {
        return reply.code(404).send({ error: 'Coupon not found or inactive' });
      }

      // Check if expired
      if (coupon.expires_at && coupon.expires_at < new Date()) {
        return reply.code(400).send({ error: 'Coupon has expired' });
      }

      // Check usage limits
      if (coupon.max_uses > 0 && coupon.uses_count >= coupon.max_uses) {
        return reply.code(400).send({ error: 'Coupon usage limit exceeded' });
      }

      reply.send(coupon);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create coupon
  fastify.post('/', {
    preHandler: [fastify.authenticate, checkCouponLimit]
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<ICoupon>;
      const user = request.user as any;

      // Validate required fields
      if (!body.code || !body.discount_type || body.discount_value === undefined) {
        return reply.code(400).send({ error: 'Missing required fields: code, discount_type, discount_value' });
      }

      // Validate discount value
      if (body.discount_type === 'percentage' && (body.discount_value < 0 || body.discount_value > 100)) {
        return reply.code(400).send({ error: 'Percentage discount must be between 0 and 100' });
      }

      if (body.discount_type === 'flat' && body.discount_value < 0) {
        return reply.code(400).send({ error: 'Flat discount cannot be negative' });
      }

      // Check if coupon code already exists
      const existingCoupon = await Coupon.findOne({
        code: body.code.toUpperCase()
      });

      if (existingCoupon) {
        return reply.code(409).send({ error: 'Coupon code already exists' });
      }

      const coupon = new Coupon({
        ...body,
        code: body.code.toUpperCase(),
        vendor_username: user.username,
      });

      await coupon.save();

      reply.code(201).send(coupon);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update coupon
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<ICoupon>;
      const user = request.user as any;

      const coupon = await Coupon.findById(id);

      if (!coupon) {
        return reply.code(404).send({ error: 'Coupon not found' });
      }

      // Check if user owns the coupon
      if (coupon.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only update your own coupons' });
      }

      // Prevent updating code if coupon has been used
      if (body.code && body.code.toUpperCase() !== coupon.code && coupon.uses_count > 0) {
        return reply.code(400).send({ error: 'Cannot change coupon code after it has been used' });
      }

      // Validate discount value if updating
      if (body.discount_value !== undefined) {
        const discountType = body.discount_type || coupon.discount_type;
        if (discountType === 'percentage' && (body.discount_value < 0 || body.discount_value > 100)) {
          return reply.code(400).send({ error: 'Percentage discount must be between 0 and 100' });
        }
        if (discountType === 'flat' && body.discount_value < 0) {
          return reply.code(400).send({ error: 'Flat discount cannot be negative' });
        }
      }

      // Update allowed fields
      const allowedUpdates = ['code', 'store_id', 'discount_type', 'discount_value', 'min_order_amount', 'max_uses', 'expires_at', 'is_active'];
      allowedUpdates.forEach(field => {
        const key = field as keyof ICoupon;
        if (body[key] !== undefined) {
          if (field === 'code') {
            (coupon as any)[key] = body[key].toUpperCase();
          } else {
            (coupon as any)[key] = body[key];
          }
        }
      });

      await coupon.save();

      reply.send(coupon);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete coupon
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const coupon = await Coupon.findById(id);

      if (!coupon) {
        return reply.code(404).send({ error: 'Coupon not found' });
      }

      // Check if user owns the coupon
      if (coupon.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only delete your own coupons' });
      }

      // Prevent deletion if coupon has been used
      if (coupon.uses_count > 0) {
        return reply.code(400).send({ error: 'Cannot delete coupon that has been used' });
      }

      await Coupon.findByIdAndDelete(id);

      reply.send({ message: 'Coupon deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Validate coupon for cart
  fastify.post('/validate', async (request, reply) => {
    try {
      const body = request.body as { code: string; cart_total: number; store_id?: string };

      const { code, cart_total, store_id } = body;

      const coupon = await Coupon.findOne({
        code: code.toUpperCase(),
        is_active: true
      });

      if (!coupon) {
        return reply.code(400).send({ error: 'Invalid or inactive coupon code' });
      }

      // Check expiry
      if (coupon.expires_at && coupon.expires_at < new Date()) {
        return reply.code(400).send({ error: 'Coupon has expired' });
      }

      // Check usage limits
      if (coupon.max_uses > 0 && coupon.uses_count >= coupon.max_uses) {
        return reply.code(400).send({ error: 'Coupon usage limit exceeded' });
      }

      // Check minimum order amount
      if (cart_total < coupon.min_order_amount) {
        return reply.code(400).send({
          error: `Minimum order amount of $${coupon.min_order_amount} required`
        });
      }

      // Check store restriction
      if (coupon.store_id && store_id && coupon.store_id !== store_id) {
        return reply.code(400).send({ error: 'Coupon is not valid for this store' });
      }

      // Calculate discount
      let discount = 0;
      if (coupon.discount_type === 'percentage') {
        discount = (cart_total * coupon.discount_value) / 100;
      } else {
        discount = Math.min(coupon.discount_value, cart_total);
      }

      reply.send({
        valid: true,
        coupon: {
          id: coupon._id,
          code: coupon.code,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          discount_amount: discount,
          final_total: cart_total - discount
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Apply coupon (increment usage count)
  fastify.post('/:id/apply', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const coupon = await Coupon.findById(id);

      if (!coupon) {
        return reply.code(404).send({ error: 'Coupon not found' });
      }

      if (!coupon.is_active) {
        return reply.code(400).send({ error: 'Coupon is not active' });
      }

      // Check expiry
      if (coupon.expires_at && coupon.expires_at < new Date()) {
        return reply.code(400).send({ error: 'Coupon has expired' });
      }

      // Check usage limits
      if (coupon.max_uses > 0 && coupon.uses_count >= coupon.max_uses) {
        return reply.code(400).send({ error: 'Coupon usage limit exceeded' });
      }

      // Increment usage count
      coupon.uses_count += 1;
      await coupon.save();

      reply.send({
        message: 'Coupon applied successfully',
        uses_count: coupon.uses_count
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get vendor's coupons
  fastify.get('/vendor/me', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { is_active, limit = 20, skip = 0 } = query;
      const user = request.user as any;

      const filter: any = { vendor_username: user.username };
      if (is_active !== undefined) filter.is_active = is_active === 'true';

      const coupons = await Coupon
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .populate('store_id', 'name');

      const total = await Coupon.countDocuments(filter);

      reply.send({
        coupons,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}