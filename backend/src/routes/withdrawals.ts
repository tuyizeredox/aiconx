import { FastifyInstance } from 'fastify';
import { Withdrawal, IWithdrawal } from '../models/Withdrawal';
import { Order } from '../models/Order';

export async function withdrawalRoutes(fastify: FastifyInstance) {
  // Get withdrawals for a vendor by username
  fastify.get('/vendor/username/:username', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { username } = request.params as { username: string };
      const query = request.query as any;
      const { status, sort = '-created_at', limit = 20, skip = 0 } = query;
      const user = request.user as any;

      // Check if user owns the vendor account
      if (user.username !== username) {
        return reply.code(403).send({ error: 'You can only view your own withdrawals' });
      }

      // Build filter object
      const filter: any = { vendor_username: username };
      if (status) filter.status = status;

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const withdrawals = await Withdrawal
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Withdrawal.countDocuments(filter);

      // Calculate totals
      const totals = await Withdrawal.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            total_amount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      const stats = totals.reduce((acc, stat) => {
        acc[stat._id] = {
          total_amount: stat.total_amount,
          count: stat.count
        };
        return acc;
      }, {} as Record<string, any>);

      return reply.send({
        withdrawals,
        stats,
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

  // Get withdrawals for a vendor by username
  fastify.get('/vendor/:vendorUsername', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { vendorUsername } = request.params as { vendorUsername: string };
      const query = request.query as any;
      const { status, sort = '-created_at', limit = 20, skip = 0 } = query;
      const user = request.user as any;

      // Check if user owns the vendor account
      if (user.username !== vendorUsername.toLowerCase()) {
        return reply.code(403).send({ error: 'You can only view your own withdrawals' });
      }

      // Build filter object
      const filter: any = { vendor_username: vendorUsername.toLowerCase() };
      if (status) filter.status = status;

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const withdrawals = await Withdrawal
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Withdrawal.countDocuments(filter);

      // Calculate totals
      const totals = await Withdrawal.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            total_amount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      const stats = totals.reduce((acc, stat) => {
        acc[stat._id] = {
          total_amount: stat.total_amount,
          count: stat.count
        };
        return acc;
      }, {} as Record<string, any>);

      return reply.send({
        withdrawals,
        stats,
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

  // List withdrawals with filtering (admin endpoint)
  fastify.get('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        vendor_username,
        store_id,
        status,
        min_amount,
        max_amount,
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (vendor_username) filter.vendor_username = vendor_username.toLowerCase();
      if (store_id) filter.store_id = store_id;
      if (status) filter.status = status;
      if (min_amount !== undefined) filter.amount = { ...filter.amount, $gte: parseFloat(min_amount) };
      if (max_amount !== undefined) filter.amount = { ...filter.amount, $lte: parseFloat(max_amount) };

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const withdrawals = await Withdrawal
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Withdrawal.countDocuments(filter);

      return reply.send({
        withdrawals,
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

  // Get withdrawal by ID
  fastify.get('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const withdrawal = await Withdrawal.findById(id);

      if (!withdrawal) {
        return reply.code(404).send({ error: 'Withdrawal not found' });
      }

      // Check if user owns the withdrawal or is admin
      if (withdrawal.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only view your own withdrawals' });
      }

      return reply.send(withdrawal);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create withdrawal request
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IWithdrawal>;
      const user = request.user as any;

      // Validate required fields
      if (!body.amount) {
        return reply.code(400).send({ error: 'Missing required field: amount' });
      }

      if (body.amount < 20) {
        return reply.code(400).send({ error: 'Minimum withdrawal amount is $20' });
      }

      if (!body.payment_method) {
        body.payment_method = 'bank_transfer';
      }

      if (body.payment_method === 'bank_transfer') {
        if (!body.bank_account_name) {
          return reply.code(400).send({ error: 'Missing required field: bank_account_name' });
        }
        if (!body.bank_account_number) {
          return reply.code(400).send({ error: 'Missing required field: bank_account_number' });
        }
        if (!body.bank_name) {
          return reply.code(400).send({ error: 'Missing required field: bank_name' });
        }
      } else if (body.payment_method === 'paypal') {
        if (!body.paypal_email) {
          return reply.code(400).send({ error: 'Missing required field: paypal_email' });
        }
        } else if (body.payment_method === 'mobile_money') {
          if (!body.mobile_money_number) {
            return reply.code(400).send({ error: 'Missing required field: mobile_money_number' });
          }
        } else if (body.payment_method === 'itecpay') {
          // For ITEC Pay, we might need a bank account or email
          // We'll assume for now it uses the same fields as bank_transfer if it's a payout
          if (!body.bank_account_number || !body.bank_name) {
            return reply.code(400).send({ error: 'Missing required bank details for ITEC Pay payout' });
          }
        }

      // Set vendor_username from authenticated user
      body.vendor_username = user.username;
      body.status = 'pending';

      // Validate balance
      const PAYOUT_RATE = 0.9;
      
      const paidOrders = await Order.find({ 
        vendor_username: user.username, 
        payment_status: 'paid' 
      });
      
      const totalEarned = (paidOrders as any[]).reduce((s, o) => s + (o.total || 0), 0) * PAYOUT_RATE;
      
      const previousWithdrawals = await Withdrawal.find({ 
        vendor_username: user.username 
      });
      
      const totalWithdrawn = previousWithdrawals
        .filter(w => w.status === 'completed')
        .reduce((s, w) => s + (w.amount || 0), 0);
        
      const pendingWithdrawals = previousWithdrawals
        .filter(w => (w.status as string) === 'pending' || (w.status as string) === 'processing')
        .reduce((s, w) => s + (w.amount || 0), 0);
        
      const availableBalance = Math.max(0, totalEarned - totalWithdrawn - pendingWithdrawals);
      
      if (body.amount > availableBalance) {
        return reply.code(400).send({ 
          error: 'Insufficient balance', 
          details: { available: availableBalance, requested: body.amount } 
        });
      }

      const withdrawal = new Withdrawal(body);
      await withdrawal.save();

      return reply.code(201).send(withdrawal);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update withdrawal status (admin/vendor endpoint)
  fastify.put('/:id/status', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status, notes } = request.body as { status: string; notes?: string };
      const user = request.user as any;

      // Validate status
      const validStatuses = ['pending', 'processing', 'completed', 'rejected'];
      if (!validStatuses.includes(status)) {
        return reply.code(400).send({ error: 'Invalid status. Must be pending, processing, completed, or rejected' });
      }

      const withdrawal = await Withdrawal.findById(id);

      if (!withdrawal) {
        return reply.code(404).send({ error: 'Withdrawal not found' });
      }

      // Check if user owns the withdrawal (vendors can only cancel their own pending withdrawals)
      if (withdrawal.vendor_username === user.username) {
        if (status !== 'rejected' || withdrawal.status !== 'pending') {
          return reply.code(403).send({ error: 'Vendors can only cancel their own pending withdrawals' });
        }
      }
      // TODO: Add admin check for other status changes

      withdrawal.status = status as any;
      if (notes) withdrawal.notes = notes;

      if (status === 'completed' || status === 'rejected') {
        withdrawal.processed_at = new Date();
      }

      await withdrawal.save();

      return reply.send(withdrawal);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update withdrawal
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IWithdrawal>;
      const user = request.user as any;

      const withdrawal = await Withdrawal.findById(id);

      if (!withdrawal) {
        return reply.code(404).send({ error: 'Withdrawal not found' });
      }

      // Check if user owns the withdrawal
      if (withdrawal.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only update your own withdrawals' });
      }

      // Only allow updates for pending withdrawals
      if (withdrawal.status !== 'pending') {
        return reply.code(400).send({ error: 'Can only update pending withdrawals' });
      }

      // Update allowed fields
      const allowedUpdates = [
        'amount',
        'payment_method',
        'bank_account_name',
        'bank_account_number',
        'bank_name',
        'routing_number',
        'paypal_email',
        'mobile_money_number'
      ];

      allowedUpdates.forEach(field => {
        const key = field as keyof IWithdrawal;
        if (body[key] !== undefined) {
          (withdrawal as any)[key] = body[key];
        }
      });

      // Validate amount if being updated
      if (body.amount !== undefined && body.amount < 20) {
        return reply.code(400).send({ error: 'Minimum withdrawal amount is $20' });
      }

      await withdrawal.save();

      return reply.send(withdrawal);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete withdrawal
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const withdrawal = await Withdrawal.findById(id);

      if (!withdrawal) {
        return reply.code(404).send({ error: 'Withdrawal not found' });
      }

      // Check if user owns the withdrawal
      if (withdrawal.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only delete your own withdrawals' });
      }

      // Only allow deletion of pending withdrawals
      if (withdrawal.status !== 'pending') {
        return reply.code(400).send({ error: 'Can only delete pending withdrawals' });
      }

      await Withdrawal.findByIdAndDelete(id);

      return reply.send({ message: 'Withdrawal deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get withdrawal statistics
  fastify.get('/stats/overview', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { vendor_username, store_id } = query;

      const matchFilter: any = {};
      if (vendor_username) matchFilter.vendor_username = vendor_username;
      if (store_id) matchFilter.store_id = store_id;

      const stats = await Withdrawal.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$status',
            total_amount: { $sum: '$amount' },
            count: { $sum: 1 },
            avg_amount: { $avg: '$amount' }
          }
        }
      ]);

      const totalStats = await Withdrawal.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            total_withdrawals: { $sum: 1 },
            total_amount_all: { $sum: '$amount' },
            avg_processing_time: {
              $avg: {
                $cond: {
                  if: { $ne: ['$processed_at', null] },
                  then: { $subtract: ['$processed_at', '$created_at'] },
                  else: null
                }
              }
            }
          }
        }
      ]);

      const statusBreakdown = stats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          total_amount: stat.total_amount,
          avg_amount: Math.round(stat.avg_amount * 100) / 100
        };
        return acc;
      }, {} as Record<string, any>);

      const overall = totalStats[0] || {
        total_withdrawals: 0,
        total_amount_all: 0,
        avg_processing_time: null
      };

      return reply.send({
        status_breakdown: statusBreakdown,
        overall: {
          total_withdrawals: overall.total_withdrawals,
          total_amount: overall.total_amount_all,
          avg_processing_time_days: overall.avg_processing_time
            ? Math.round(overall.avg_processing_time / (1000 * 60 * 60 * 24) * 100) / 100
            : null
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}