import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProductBooking } from '../models/ProductBooking';
import { Product } from '../models/Product';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';

const bookSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().int().min(1).max(99).default(1),
  selected_color: z.string().max(80).optional(),
  selected_size: z.string().max(80).optional(),
  selected_options: z.array(z.object({
    name: z.string().max(60),
    value: z.string().max(120),
  })).max(20).optional(),
  selected_image: z.string().max(2000).optional(),
});

export async function productBookingRoutes(fastify: FastifyInstance) {
  // How many shoppers are waiting on a product. Public, because it's the same
  // signal the product page shows to everyone ("8 people waiting").
  fastify.get('/product/:productId', async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const waiting = await ProductBooking.countDocuments({ product_id: productId, status: 'waiting' });
      return reply.send({ waiting });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // The caller's own bookings, newest first.
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { status, limit = 50 } = request.query as any;

      const filter: any = { user_username: user.username };
      if (status) filter.status = status;

      const bookings = await ProductBooking.find(filter)
        .sort({ created_at: -1 })
        .limit(Math.min(parseInt(limit) || 50, 100))
        .lean();

      // Current stock travels with each booking so the client can tell
      // "still waiting" apart from "ready to buy" without a second round trip.
      const productIds = bookings.map(b => b.product_id);
      const products = productIds.length
        ? await Product.find({ _id: { $in: productIds } })
          .select('inventory_count status price title images')
          .lean()
        : [];
      const productMap = new Map(products.map(p => [String(p._id), p]));

      return reply.send({
        data: bookings.map(b => {
          const product = productMap.get(b.product_id) as any;
          return {
            ...b,
            id: String(b._id),
            in_stock: !!product && product.inventory_count > 0 && product.status !== 'sold_out',
            current_price: product?.price ?? b.product_price,
          };
        }),
        total: bookings.length,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Everything waiting across a vendor's catalog — demand they can act on.
  fastify.get('/vendor/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const user = request.user as any;
      const bookings = await ProductBooking.aggregate([
        { $match: { vendor_username: user.username, status: 'waiting' } },
        {
          $group: {
            _id: '$product_id',
            product_title: { $first: '$product_title' },
            product_image: { $first: '$product_image' },
            waiting: { $sum: 1 },
            units: { $sum: '$quantity' },
          },
        },
        { $sort: { waiting: -1 } },
        { $limit: 100 },
      ]);

      return reply.send({
        data: bookings.map((b: any) => ({ product_id: b._id, ...b })),
        total: bookings.length,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Book an out-of-stock product
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = bookSchema.parse(request.body);

      const product = await Product.findById(body.product_id).lean();
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      if (product.vendor_username === user.username) {
        return reply.code(400).send({ error: 'You cannot book your own product' });
      }

      if (product.status === 'archived' || product.status === 'draft') {
        return reply.code(400).send({ error: 'This product is not available' });
      }

      // Booking only makes sense while it's unavailable — otherwise the
      // shopper should just buy it, and a booking would never fire.
      const isOutOfStock = product.inventory_count <= 0 || product.status === 'sold_out';
      if (!isOutOfStock) {
        return reply.code(400).send({
          error: 'Product is in stock',
          message: 'This product is available now — you can buy it directly.',
        });
      }

      const booking = new ProductBooking({
        product_id: String(product._id),
        product_title: product.title,
        product_image: product.images?.[0],
        product_price: product.price,
        store_id: product.store_id,
        store_name: product.store_name,
        vendor_username: product.vendor_username,
        user_username: user.username,
        user_name: user.display_name || user.username,
        quantity: body.quantity,
        selected_color: body.selected_color,
        selected_size: body.selected_size,
        selected_options: body.selected_options || [],
        selected_image: body.selected_image,
      });

      try {
        await booking.save();
      } catch (saveError: any) {
        if (saveError?.code === 11000) {
          return reply.code(409).send({
            error: 'Already booked',
            message: 'You are already on the waitlist for this product.',
          });
        }
        throw saveError;
      }

      // A waitlist is a restock signal, so the vendor hears about it.
      try {
        const notification = new Notification({
          recipient_username: product.vendor_username,
          type: 'offer',
          title: `Someone is waiting for ${product.title}`,
          body: 'A shopper booked this out-of-stock item. Restock it to convert the sale.',
          link: `/mystore?tab=products`,
          sender_username: user.username,
          sender_name: user.display_name || user.username,
          metadata: { product_id: String(product._id), booking_id: String(booking._id) },
        });
        await notification.save();
        fastify.io?.to(`user:${product.vendor_username}`).emit('notification:new', notification);
        NotificationService.sendPushNotification(product.vendor_username, notification, fastify);
      } catch (notifyError) {
        fastify.log.error(notifyError);
      }

      return reply.code(201).send({ ...booking.toObject(), id: String(booking._id) });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Cancel a booking
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const booking = await ProductBooking.findById(id);
      if (!booking) {
        return reply.code(404).send({ error: 'Booking not found' });
      }

      if (booking.user_username !== user.username) {
        return reply.code(403).send({ error: 'You can only cancel your own bookings' });
      }

      // Deleted rather than marked cancelled so the partial unique index frees
      // up immediately and the shopper can book again straight away.
      await ProductBooking.findByIdAndDelete(id);

      return reply.send({ message: 'Booking cancelled' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });
}
