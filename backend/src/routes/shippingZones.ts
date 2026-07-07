import { FastifyInstance } from 'fastify';
import { ShippingZone, IShippingZone } from '../models/ShippingZone';
import { checkShippingZoneLimit } from '../middleware/subscription';

export async function shippingZoneRoutes(fastify: FastifyInstance) {
  // Get shipping zones for a vendor
  fastify.get('/vendor/:vendorUsername', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { vendorUsername } = request.params as { vendorUsername: string };
      const user = request.user as any;

      // Check if user owns the vendor account or is admin
      if (user.username !== vendorUsername.toLowerCase()) {
        return reply.code(403).send({ error: 'You can only view your own shipping zones' });
      }

      const zones = await ShippingZone
        .find({ vendor_username: vendorUsername.toLowerCase(), is_active: true })
        .sort({ zone_name: 1 });

      return reply.send({ zones });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get shipping zones for a store
  fastify.get('/store/:storeId', async (request, reply) => {
    try {
      const { storeId } = request.params as { storeId: string };

      const zones = await ShippingZone
        .find({ store_id: storeId, is_active: true })
        .sort({ zone_name: 1 });

      return reply.send({ zones });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // List shipping zones with filtering
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        vendor_username,
        store_id,
        store_ids,
        is_active = true,
        sort = 'zone_name',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (vendor_username) filter.vendor_username = vendor_username.toLowerCase();
      if (store_id) filter.store_id = store_id;
      if (store_ids) {
        const ids = store_ids.split(',');
        filter.store_id = { $in: ids };
      }
      if (query.is_active !== undefined) {
        filter.is_active = query.is_active === 'true';
      }

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const zones = await ShippingZone
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await ShippingZone.countDocuments(filter);

      return reply.send({
        zones,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get shipping zone by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const zone = await ShippingZone.findById(id);

      if (!zone) {
        return reply.code(404).send({ error: 'Shipping zone not found' });
      }

      return reply.send(zone);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create shipping zone
  fastify.post('/', {
    preHandler: [fastify.authenticate, checkShippingZoneLimit]
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IShippingZone>;
      const user = request.user as any;

      // Validate required fields
      if (!body.zone_name) {
        return reply.code(400).send({ error: 'Missing required field: zone_name' });
      }

      if (body.flat_rate === undefined) {
        return reply.code(400).send({ error: 'Missing required field: flat_rate' });
      }

      // Set vendor_username from authenticated user
      body.vendor_username = user.username;

      // Validate flat_rate
      if (body.flat_rate < 0) {
        return reply.code(400).send({ error: 'flat_rate cannot be negative' });
      }

      // Validate estimated days
      if (body.estimated_days_min && body.estimated_days_max) {
        if (body.estimated_days_min > body.estimated_days_max) {
          return reply.code(400).send({ error: 'estimated_days_min cannot be greater than estimated_days_max' });
        }
      }

      const zone = new ShippingZone(body);
      await zone.save();

      return reply.code(201).send(zone);
    } catch (error: any) {
      if (error && typeof error === 'object' && error.code === 11000) {
        return reply.code(409).send({ error: 'A shipping zone with this name already exists for this vendor/store' });
      } else if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        return reply.code(400).send({ error: 'Validation failed', details: messages });
      } else {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error', message: error.message });
      }
    }
  });

  // Update shipping zone
  fastify.put('/:id', {
    preHandler: [fastify.authenticate, checkShippingZoneLimit]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IShippingZone>;
      const user = request.user as any;

      const zone = await ShippingZone.findById(id);

      if (!zone) {
        return reply.code(404).send({ error: 'Shipping zone not found' });
      }

      // Check if user owns the zone
      if (zone.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only update your own shipping zones' });
      }

      // Update allowed fields
      const allowedUpdates = [
        'zone_name',
        'countries',
        'flat_rate',
        'free_above',
        'estimated_days_min',
        'estimated_days_max',
        'is_active'
      ];

      allowedUpdates.forEach(field => {
        const key = field as keyof IShippingZone;
        if (body[key] !== undefined) {
          (zone as any)[key] = body[key];
        }
      });

      // Validate flat_rate if being updated
      if (body.flat_rate !== undefined && body.flat_rate < 0) {
        return reply.code(400).send({ error: 'flat_rate cannot be negative' });
      }

      // Validate estimated days if being updated
      if (body.estimated_days_min !== undefined && body.estimated_days_max !== undefined) {
        if (body.estimated_days_min > body.estimated_days_max) {
          return reply.code(400).send({ error: 'estimated_days_min cannot be greater than estimated_days_max' });
        }
      }

      await zone.save();

      return reply.send(zone);
    } catch (error: any) {
      if (error && typeof error === 'object' && error.code === 11000) {
        return reply.code(409).send({ error: 'A shipping zone with this name already exists for this vendor/store' });
      } else if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        return reply.code(400).send({ error: 'Validation failed', details: messages });
      } else {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error', message: error.message });
      }
    }
  });

  // Delete shipping zone
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const zone = await ShippingZone.findById(id);

      if (!zone) {
        return reply.code(404).send({ error: 'Shipping zone not found' });
      }

      // Check if user owns the zone
      if (zone.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only delete your own shipping zones' });
      }

      await ShippingZone.findByIdAndDelete(id);

      return reply.send({ message: 'Shipping zone deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Calculate shipping cost for a zone
  fastify.post('/:id/calculate', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { order_amount, country_code } = request.body as {
        order_amount: number;
        country_code: string;
      };

      const zone = await ShippingZone.findById(id);

      if (!zone) {
        return reply.code(404).send({ error: 'Shipping zone not found' });
      }

      if (!zone.is_active) {
        return reply.code(400).send({ error: 'Shipping zone is not active' });
      }

      // Check if country is in the zone or it's a worldwide zone
      if (zone.countries.length > 0 && 
          !zone.countries.includes(country_code?.toUpperCase()) && 
          !zone.countries.includes('WORLD')) {
        return reply.code(400).send({ error: 'Country not covered by this shipping zone' });
      }

      let shipping_cost = zone.flat_rate;

      // Check if order qualifies for free shipping
      if (zone.free_above > 0 && order_amount >= zone.free_above) {
        shipping_cost = 0;
      }

      return reply.send({
        zone_id: id,
        zone_name: zone.zone_name,
        shipping_cost,
        is_free: shipping_cost === 0,
        estimated_days_min: zone.estimated_days_min,
        estimated_days_max: zone.estimated_days_max,
        currency: 'USD'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get available shipping zones for a country
  fastify.get('/available/:countryCode', async (request, reply) => {
    try {
      const { countryCode } = request.params as { countryCode: string };
      const { vendor_username, store_id } = request.query as any;

      const filter: any = {
        is_active: true,
        $or: [
          { countries: { $in: [countryCode.toUpperCase(), 'WORLD'] } },
          { countries: { $size: 0 } } // Empty countries array means worldwide
        ]
      };

      if (vendor_username) filter.vendor_username = vendor_username.toLowerCase();
      if (store_id) filter.store_id = store_id;

      const zones = await ShippingZone
        .find(filter)
        .sort({ flat_rate: 1 }); // Sort by cheapest first

      return reply.send({ zones });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}