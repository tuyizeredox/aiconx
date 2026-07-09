import { FastifyInstance } from 'fastify';
import { CartItem, ICartItem } from '../models/CartItem';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { z } from 'zod';

const addToCartSchema = z.object({
  product_id: z.string(),
  quantity: z.number().min(1).default(1),
  selected_color: z.string().or(z.literal('')).optional(),
  selected_size: z.string().or(z.literal('')).optional(),
  selected_options: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  selected_image: z.string().or(z.literal('')).optional(),
  affiliate_username: z.string().or(z.literal('')).optional(),
});

const updateCartItemSchema = z.object({
  quantity: z.number().min(1),
});

function sameVariant(a: ICartItem, b: {
  selected_color?: string;
  selected_size?: string;
  selected_image?: string;
  selected_options?: { name: string; value: string }[];
}): boolean {
  if ((a.selected_color || '') !== (b.selected_color || '')) return false;
  if ((a.selected_size || '') !== (b.selected_size || '')) return false;
  if ((a.selected_image || '') !== (b.selected_image || '')) return false;
  const aOpts = a.selected_options || [];
  const bOpts = b.selected_options || [];
  if (aOpts.length !== bOpts.length) return false;
  const normalize = (opts: { name: string; value: string }[]) =>
    [...opts].sort((x, y) => x.name.localeCompare(y.name)).map(o => `${o.name}:${o.value}`).join('|');
  return normalize(aOpts) === normalize(bOpts);
}

export async function cartRoutes(fastify: FastifyInstance) {
  // Get user's cart
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      const items = await CartItem.find({ user_username: user.username }).lean();
      return { items };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Add item to cart
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { product_id, quantity, selected_color, selected_size, selected_options, selected_image, affiliate_username } = addToCartSchema.parse(request.body);

      // Get product details (also needed to validate the requested image/color/size belong to this product)
      const product = await Product.findById(product_id);
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      const validatedImage = selected_image && product.images.includes(selected_image) ? selected_image : undefined;

      // Different variant combos (color/size/options/image) are separate cart line items
      const existingItems = await CartItem.find({ user_username: user.username, product_id });
      let cartItem = existingItems.find(item => sameVariant(item, {
        selected_color: selected_color || undefined,
        selected_size: selected_size || undefined,
        selected_image: validatedImage,
        selected_options,
      }));

      if (cartItem) {
        // Same product with the same color/size/options/image is already in the cart —
        // don't silently bump the quantity, tell the buyer so they can change it from the cart.
        return { ...cartItem.toObject(), already_in_cart: true };
      }

      cartItem = new CartItem({
        user_username: user.username,
        product_id,
        product_title: product.title,
        product_image: validatedImage || product.images[0],
        product_price: product.price,
        store_id: product.store_id,
        store_name: product.store_name,
        quantity,
        selected_color: selected_color || undefined,
        selected_size: selected_size || undefined,
        selected_options: selected_options && selected_options.length > 0 ? selected_options : undefined,
        selected_image: validatedImage,
        affiliate_username,
      });

      await cartItem.save();
      return { ...cartItem.toObject(), already_in_cart: false };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update cart item quantity
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { quantity } = updateCartItemSchema.parse(request.body);
      const user = request.user as any;

      const cartItem = await CartItem.findOneAndUpdate(
        { _id: id, user_username: user.username },
        { quantity },
        { new: true }
      );

      if (!cartItem) {
        return reply.code(404).send({ error: 'Cart item not found' });
      }

      return cartItem;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Remove item from cart
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const result = await CartItem.deleteOne({ _id: id, user_username: user.username });
      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'Cart item not found' });
      }

      return { status: 'deleted' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Clear cart
  fastify.delete('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      await CartItem.deleteMany({ user_username: user.username });
      return { status: 'cleared' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}