import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { Product } from '../models/Product';
import { Announcement } from '../models/Announcement';
import { Withdrawal } from '../models/Withdrawal';
import { Order } from '../models/Order';
import { Settings } from '../models/Settings';
import { Report } from '../models/Report';
import { ActivityLog } from '../models/ActivityLog';
import { Post } from '../models/Post';
import { VendorSubscription } from '../models/VendorSubscription';
import { authenticate, isAdmin, logActivity, invalidateMaintenanceCache } from '../middleware/auth';
import { escapeRegex } from '../utils/sanitize';

export async function adminRoutes(fastify: FastifyInstance) {
  // Add authentication and admin check to all routes in this plugin
  fastify.addHook('preHandler', async (request, reply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    await isAdmin(request, reply);
  });

  // --- User Management ---

  // Get all users
  fastify.get('/users', async (request, reply) => {
    try {
      const { page = 1, limit = 10, search = '' } = request.query as any;
      
      const parsedLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
      const parsedPage = Math.max(parseInt(page) || 1, 1);
      const parsedSkip = (parsedPage - 1) * parsedLimit;

      const query: any = {};
      if (search) {
        query.$text = { $search: search };
      }

      const users = await User.find(query)
        .sort(search ? { score: { $meta: 'textScore' } } : { created_at: -1 })
        .skip(parsedSkip)
        .limit(parsedLimit)
        .select('username email display_name role is_blocked is_verified avatar_url created_at')
        .lean();

      const total = await User.countDocuments(query);

      return {
        users,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          pages: Math.ceil(total / parsedLimit)
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Block/Unblock user
  fastify.patch('/users/:id/block', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { is_blocked } = z.object({ is_blocked: z.boolean() }).parse(request.body);

      const user = await User.findByIdAndUpdate(id, { is_blocked }, { new: true });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      await logActivity(request, is_blocked ? 'block_user' : 'unblock_user', user._id, 'user');

      return user;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Bulk block/unblock users
  fastify.patch('/users/bulk-block', async (request, reply) => {
    try {
      const { userIds, is_blocked } = z.object({ 
        userIds: z.array(z.string()),
        is_blocked: z.boolean() 
      }).parse(request.body);

      await User.updateMany({ _id: { $in: userIds } }, { is_blocked });

      await logActivity(request, is_blocked ? 'bulk_block_users' : 'bulk_unblock_users', null, 'user', { count: userIds.length });

      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete user
  fastify.delete('/users/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = await User.findByIdAndDelete(id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      await logActivity(request, 'delete_user', user._id, 'user', { email: user.email });
      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Toggle user email verification
  fastify.patch('/users/:id/verify', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { is_verified } = z.object({ is_verified: z.boolean() }).parse(request.body);
      const user = await User.findByIdAndUpdate(id, { is_verified }, { new: true });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      await logActivity(request, is_verified ? 'verify_user' : 'unverify_user', user._id, 'user');
      return user;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Change user role
  fastify.patch('/users/:id/role', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { role } = z.object({ 
        role: z.enum(['user', 'vendor', 'super_admin']) 
      }).parse(request.body);

      const oldUser = await User.findById(id);
      const user = await User.findByIdAndUpdate(id, { role }, { new: true });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      await logActivity(request, 'change_user_role', user._id, 'user', { 
        old_role: oldUser?.role, 
        new_role: role 
      });

      return user;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Store Management ---

  // Get all stores
  fastify.get('/stores', async (request, reply) => {
    try {
      const { page = 1, limit = 10, status, search = '' } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (status) query.status = status;
      if (search) {
        const escaped = escapeRegex(search);
        query.$or = [
          { name: { $regex: escaped, $options: 'i' } },
          { owner_username: { $regex: escaped, $options: 'i' } }
        ];
      }

      const stores = await Store.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Enrich stores with product counts and income data
      const enrichedStores = await Promise.all(stores.map(async (store) => {
        const productCount = await Product.countDocuments({ store_id: store._id.toString() });
        
        // Calculate total revenue from orders for this store
        const revenueResult = await Order.aggregate([
          { $match: { 
            store_id: store._id.toString(),
            status: { $ne: 'cancelled' },
            payment_status: 'paid'
          }},
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // Count orders for this store
        const ordersCount = await Order.countDocuments({ 
          store_id: store._id.toString(),
          status: { $ne: 'cancelled' }
        });

        return {
          ...store,
          products_count: productCount,
          orders_count: ordersCount,
          total_revenue: totalRevenue
        };
      }));

      const total = await Store.countDocuments(query);

      return {
        stores: enrichedStores,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update store status
  fastify.patch('/stores/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = z.object({ 
        status: z.enum(['active', 'pending', 'suspended']) 
      }).parse(request.body);

      const store = await Store.findByIdAndUpdate(id, { status }, { new: true });
      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      await logActivity(request, 'update_store_status', store._id, 'store', { status });

      return store;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Bulk update store status
  fastify.patch('/stores/bulk-status', async (request, reply) => {
    try {
      const { storeIds, status } = z.object({ 
        storeIds: z.array(z.string()),
        status: z.enum(['active', 'pending', 'suspended']) 
      }).parse(request.body);

      await Store.updateMany({ _id: { $in: storeIds } }, { status });

      await logActivity(request, 'bulk_update_store_status', null, 'store', { status, count: storeIds.length });

      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete store
  fastify.delete('/stores/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const store = await Store.findByIdAndDelete(id);
      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }
      await logActivity(request, 'delete_store', store._id, 'store', { name: store.name });
      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Verify store
  fastify.patch('/stores/:id/verify', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { is_verified } = z.object({ is_verified: z.boolean() }).parse(request.body);

      const store = await Store.findByIdAndUpdate(id, { is_verified }, { new: true });
      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      await logActivity(request, is_verified ? 'verify_store' : 'unverify_store', store._id, 'store');

      return store;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get store products
  fastify.get('/stores/:id/products', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { page = 1, limit = 20, status } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = { store_id: id };
      if (status) query.status = status;

      const products = await Product.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Product.countDocuments(query);

      return {
        products,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Subscription Management ---

  // Get all vendor subscriptions
  fastify.get('/subscriptions', async (request, reply) => {
    try {
      const { page = 1, limit = 20, status, search = '' } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (status) query.status = status;
      if (search) {
        const escaped = escapeRegex(search);
        query.$or = [
          { vendor_username: { $regex: escaped, $options: 'i' } },
          { store_id: { $regex: escaped, $options: 'i' } }
        ];
      }

      const subscriptions = await VendorSubscription.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Fetch user roles for each subscription
      const vendorUsernames = [...new Set(subscriptions.map(s => s.vendor_username))];
      const users = await User.find({ username: { $in: vendorUsernames } }).select('username role');
      const userRoleMap = new Map(users.map(u => [u.username, u.role]));

      // Fetch plan prices from Settings for amount calculation
      const settings = await Settings.findOne();
      const storedPlanPrices = settings?.plan_prices;
      const DEFAULT_PLAN_PRICES = {
        free: { monthly: 0, annual: 0 },
        pro: { monthly: 29000, annual: 23000 },
        elite: { monthly: 99000, annual: 79000 }
      };

      // Add user_role and calculate amounts based on current plan prices
      const subscriptionsWithRoles = await Promise.all(subscriptions.map(async (sub) => {
        const subObj = sub.toObject() as any;
        subObj.user_role = userRoleMap.get(sub.vendor_username) || 'user';

        // Always calculate amount from current plan prices for admin view
        const plan = (sub.plan || 'free') as string;
        const billingCycle = (sub.billing_cycle || 'monthly') as string;
        const prices = (storedPlanPrices as any)?.[plan] || (DEFAULT_PLAN_PRICES as any)[plan];
        const calculatedAmount = prices ? (billingCycle === 'annual' ? prices.annual : prices.monthly) : 0;
        subObj.amount = calculatedAmount;

        // Update DB if stored amount differs from current plan price
        if (subObj.amount !== calculatedAmount && calculatedAmount > 0) {
          await VendorSubscription.updateOne({ _id: sub._id }, { $set: { amount: calculatedAmount } });
        }

        return subObj;
      }));

      const total = await VendorSubscription.countDocuments(query);

      return {
        subscriptions: subscriptionsWithRoles,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Cancel subscription
  fastify.post('/subscriptions/:id/cancel', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const subscription = await VendorSubscription.findByIdAndUpdate(
        id,
        { status: 'cancelled', cancelled_at: new Date() },
        { new: true }
      );

      if (!subscription) {
        return reply.code(404).send({ error: 'Subscription not found' });
      }

      await logActivity(request, 'cancel_subscription', subscription._id, 'vendor_subscription');

      return subscription;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get plan prices
  fastify.get('/subscriptions/plans', async (request, reply) => {
    try {
      const settings = await Settings.findOne();
      const planPrices = settings?.plan_prices || {
        free: { monthly: 0, annual: 0 },
        pro: { monthly: 29000, annual: 23000 },
        elite: { monthly: 99000, annual: 79000 }
      };

      return { plans: planPrices };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update plan prices
  fastify.put('/subscriptions/plans', async (request, reply) => {
    try {
      const { plan_prices } = z.object({
        plan_prices: z.object({
          free: z.object({ monthly: z.number(), annual: z.number() }),
          pro: z.object({ monthly: z.number(), annual: z.number() }),
          elite: z.object({ monthly: z.number(), annual: z.number() })
        })
      }).parse(request.body);

      const settings = await Settings.findOne();
      if (settings) {
        settings.plan_prices = plan_prices;
        await settings.save();
      } else {
        await Settings.create({ plan_prices });
      }

      await logActivity(request, 'update_plan_prices', null, 'settings', { plan_prices });

      return { plans: plan_prices };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Withdrawal Management ---

  // Get all withdrawals
  fastify.get('/withdrawals', async (request, reply) => {
    try {
      const { page = 1, limit = 10, status } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (status) query.status = status;

      const withdrawals = await Withdrawal.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Withdrawal.countDocuments(query);

      return {
        withdrawals,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update withdrawal status
  fastify.patch('/withdrawals/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status, notes } = z.object({ 
        status: z.enum(['pending', 'processing', 'completed', 'rejected']),
        notes: z.string().optional()
      }).parse(request.body);

      const updateData: any = { status };
      if (notes) updateData.notes = notes;
      if (status === 'completed') updateData.processed_at = new Date();

      const withdrawal = await Withdrawal.findByIdAndUpdate(id, updateData, { new: true });
      if (!withdrawal) {
        return reply.code(404).send({ error: 'Withdrawal request not found' });
      }

      await logActivity(request, 'update_withdrawal_status', withdrawal._id, 'withdrawal', { status });

      return withdrawal;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Moderation (Reports) ---

  // Get all reports
  fastify.get('/reports', async (request, reply) => {
    try {
      const { page = 1, limit = 10, status } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (status) query.status = status;

      const reports = await Report.find(query)
        .populate('reporter_id', 'display_name email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Report.countDocuments(query);

      return {
        reports,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Resolve report
  fastify.patch('/reports/:id/resolve', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status, admin_notes } = z.object({
        status: z.enum(['resolved', 'dismissed']),
        admin_notes: z.string().optional()
      }).parse(request.body);

      const user = request.user as any;
      const report = await Report.findByIdAndUpdate(id, {
        status,
        admin_notes,
        resolved_at: new Date(),
        resolved_by: user.userId || user._id,
      }, { new: true });

      if (!report) {
        return reply.code(404).send({ error: 'Report not found' });
      }

      await logActivity(request, 'resolve_report', report._id, 'report', { status });

      return report;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Activity Logs ---

  // Get activity logs
  fastify.get('/activity-logs', async (request, reply) => {
    try {
      const { page = 1, limit = 20 } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const logs = await ActivityLog.find()
        .populate('user_id', 'display_name email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await ActivityLog.countDocuments();

      return {
        logs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Order Management ---

  // Get all orders
  fastify.get('/orders', async (request, reply) => {
    try {
      const { page = 1, limit = 10, status, search = '' } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (status) query.status = status;
      if (search) {
        const escaped = escapeRegex(search);
        query.$or = [
          { buyer_username: { $regex: escaped, $options: 'i' } },
          { vendor_username: { $regex: escaped, $options: 'i' } },
          { store_name: { $regex: escaped, $options: 'i' } }
        ];
      }

      const orders = await Order.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Order.countDocuments(query);

      return {
        orders,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update order status
  fastify.patch('/orders/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = z.object({
        status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
      }).parse(request.body);

      const order = await Order.findByIdAndUpdate(id, { status }, { new: true });
      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      await logActivity(request, 'update_order_status', order._id, 'order', { status });

      return order;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Product Management ---

  // Get all products
  fastify.get('/products', async (request, reply) => {
    try {
      const { page = 1, limit = 10, status, search = '' } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (status) query.status = status;
      if (search) {
        const escaped = escapeRegex(search);
        query.$or = [
          { title: { $regex: escaped, $options: 'i' } },
          { vendor_username: { $regex: escaped, $options: 'i' } },
          { store_name: { $regex: escaped, $options: 'i' } }
        ];
      }

      const products = await Product.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Product.countDocuments(query);

      return {
        products,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update product status
  fastify.patch('/products/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = z.object({ 
        status: z.enum(['active', 'draft', 'sold_out', 'archived']) 
      }).parse(request.body);

      const product = await Product.findByIdAndUpdate(id, { status }, { new: true });
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      await logActivity(request, 'update_product_status', product._id, 'product', { status });

      return product;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete product
  fastify.delete('/products/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const product = await Product.findByIdAndDelete(id);
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      await logActivity(request, 'delete_product', product._id, 'product');

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Announcement Management ---

  // Get all announcements (admin)
  fastify.get('/announcements', async (request, reply) => {
    try {
      const announcements = await Announcement.find()
        .sort({ created_at: -1 });
      return { announcements };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create announcement
  fastify.post('/announcements', async (request, reply) => {
    try {
      const data = z.object({
        title: z.string(),
        content: z.string(),
        type: z.enum(['info', 'warning', 'success', 'error']),
        target: z.enum(['all', 'vendors', 'users']),
        is_active: z.boolean().optional(),
        expires_at: z.string().optional().transform(v => v ? new Date(v) : undefined),
      }).parse(request.body);

      const user = request.user as any;
      const announcement = new Announcement({
        ...data,
        created_by: user._id,
      });

      await announcement.save();
      await logActivity(request, 'create_announcement', announcement._id, 'announcement');

      return announcement;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update announcement
  fastify.patch('/announcements/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        type: z.enum(['info', 'warning', 'success', 'error']).optional(),
        target: z.enum(['all', 'vendors', 'users']).optional(),
        is_active: z.boolean().optional(),
        expires_at: z.string().optional().transform(v => v ? new Date(v) : undefined),
      }).parse(request.body);

      const announcement = await Announcement.findByIdAndUpdate(id, data, { new: true });
      if (!announcement) {
        return reply.code(404).send({ error: 'Announcement not found' });
      }

      await logActivity(request, 'update_announcement', announcement._id, 'announcement');

      return announcement;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete announcement
  fastify.delete('/announcements/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const announcement = await Announcement.findByIdAndDelete(id);
      if (!announcement) {
        return reply.code(404).send({ error: 'Announcement not found' });
      }

      await logActivity(request, 'delete_announcement', announcement._id, 'announcement');

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- System Statistics ---

  fastify.get('/stats', async (request, reply) => {
    try {
      const [
        totalUsers,
        totalStores,
        activeStores,
        pendingStores,
        totalProducts,
        totalOrders,
        totalWithdrawals,
        pendingWithdrawals,
        totalReports,
        pendingReports,
        settings,
        activeSubscriptions,
        subscriptionRevenue
      ] = await Promise.all([
        User.countDocuments(),
        Store.countDocuments(),
        Store.countDocuments({ status: 'active' }),
        Store.countDocuments({ status: 'pending' }),
        Product.countDocuments(),
        Order.countDocuments(),
        Withdrawal.countDocuments(),
        Withdrawal.countDocuments({ status: 'pending' }),
        Report.countDocuments(),
        Report.countDocuments({ status: 'pending' }),
        Settings.findOne(),
        VendorSubscription.countDocuments({ status: 'active' }),
        VendorSubscription.find({ plan: { $ne: 'free' }, status: 'active' }).select('plan billing_cycle amount')
      ]);

      // Calculate total sales from all orders
      const salesResult = await Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);
      const totalSales = salesResult.length > 0 ? salesResult[0].total : 0;

      // Calculate subscription revenue using current plan prices from Settings
      const planPrices = (settings as any)?.plan_prices;
      const fallbackPrices: { [key: string]: { monthly: number; annual: number } } = {
        pro:   { monthly: 29000, annual: 23000 },
        elite: { monthly: 79000, annual: 63000 },
        free:  { monthly: 0, annual: 0 }
      };

      const totalSubscriptionRevenue = (subscriptionRevenue as any[]).reduce((sum: number, sub: any) => {
        const prices = planPrices?.[sub.plan] || fallbackPrices[sub.plan];
        if (!prices) return sum;
        const billingCycle = sub.billing_cycle || 'monthly';
        const amount = billingCycle === 'annual' ? prices.annual : prices.monthly;
        return sum + amount;
      }, 0);

      // Recent users
      const recentUsers = await User.find().sort({ created_at: -1 }).limit(5);
      
      // Recent stores
      const recentStores = await Store.find().sort({ created_at: -1 }).limit(5);

      // Recent activity
      const recentActivity = await ActivityLog.find()
        .populate('user_id', 'display_name')
        .sort({ created_at: -1 })
        .limit(10);

      // Sales chart data (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const salesChart = await Order.aggregate([
        { $match: { 
          status: { $ne: 'cancelled' },
          created_at: { $gte: sevenDaysAgo }
        }},
        { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          total: { $sum: "$total" }
        }},
        { $sort: { "_id": 1 } }
      ]);

      return {
        counts: {
          users: totalUsers,
          stores: {
            total: totalStores,
            active: activeStores,
            pending: pendingStores
          },
          products: totalProducts,
          orders: totalOrders,
          withdrawals: {
            total: totalWithdrawals,
            pending: pendingWithdrawals
          },
          reports: {
            total: totalReports,
            pending: pendingReports
          },
          total_sales: totalSales,
          subscriptions: {
            active: activeSubscriptions,
            total_revenue: totalSubscriptionRevenue
          }
        },
        recent: {
          users: recentUsers,
          stores: recentStores,
          activity: recentActivity
        },
        charts: {
          sales: salesChart
        },
        settings: settings || { 
          maintenance_mode: false, 
          maintenance_message: '',
          allow_registration: true,
          min_withdrawal_amount: 10,
          platform_fee_percent: 5,
          subscription_mode: false
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Post Management ---

  // Get all posts
  fastify.get('/posts', async (request, reply) => {
    try {
      const { page = 1, limit = 10, search = '', visibility } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (visibility && visibility !== 'all') query.visibility = visibility;
      if (search) {
        const escaped = escapeRegex(search);
        query.$or = [
          { content: { $regex: escaped, $options: 'i' } },
          { author_username: { $regex: escaped, $options: 'i' } },
          { author_name: { $regex: escaped, $options: 'i' } },
        ];
      }

      const posts = await Post.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Post.countDocuments(query);

      return {
        posts,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update post visibility
  fastify.patch('/posts/:id/visibility', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { visibility } = z.object({
        visibility: z.enum(['public', 'followers', 'community']),
      }).parse(request.body);

      const post = await Post.findByIdAndUpdate(id, { visibility }, { new: true });
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      await logActivity(request, 'update_post_visibility', post._id, 'post', { visibility });

      return post;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete post
  fastify.delete('/posts/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const post = await Post.findByIdAndDelete(id);
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      await logActivity(request, 'delete_post', post._id, 'post', { author: post.author_username });

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- System Settings ---

  // Update system settings
  fastify.patch('/settings', async (request, reply) => {
    try {
      const { 
        maintenance_mode, 
        maintenance_message,
        allow_registration,
        min_withdrawal_amount,
        platform_fee_percent,
        subscription_mode
      } = z.object({
        maintenance_mode: z.boolean().optional(),
        maintenance_message: z.string().optional(),
        allow_registration: z.boolean().optional(),
        min_withdrawal_amount: z.number().optional(),
        platform_fee_percent: z.number().optional(),
        subscription_mode: z.boolean().optional()
      }).parse(request.body);

      let settings = await Settings.findOne();
      if (!settings) {
        settings = new Settings();
      }

      const oldSettings = JSON.parse(JSON.stringify(settings));

      if (maintenance_mode !== undefined) settings.maintenance_mode = maintenance_mode;
      if (maintenance_message !== undefined) settings.maintenance_message = maintenance_message;
      if (allow_registration !== undefined) settings.allow_registration = allow_registration;
      if (min_withdrawal_amount !== undefined) settings.min_withdrawal_amount = min_withdrawal_amount;
      if (platform_fee_percent !== undefined) settings.platform_fee_percent = platform_fee_percent;
      if (subscription_mode !== undefined) settings.subscription_mode = subscription_mode;

      await settings.save();
      invalidateMaintenanceCache();
      
      await logActivity(request, 'update_system_settings', settings._id, 'settings', {
        changed_fields: Object.keys(request.body as any)
      });

      return settings;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
