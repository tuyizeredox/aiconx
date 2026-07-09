import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { itecPayService } from '../services/itecPayService';
import { Order } from '../models/Order';
import { VendorSubscription } from '../models/VendorSubscription';
import { getPlanPrice } from '../utils/planPricing';

const initializePaymentSchema = z.object({
  amount: z.number().min(1).optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  order_id: z.string(),
  currency: z.string().optional(),
  payment_method: z.enum(['card', 'mobile_money', 'mtn', 'airtel', 'spenn']).default('card'),
});

export async function paymentRoutes(fastify: FastifyInstance) {
  // Initialize ITEC Pay payment
  fastify.post('/itecpay/initialize', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { email, phone, order_id, currency, payment_method } = initializePaymentSchema.parse(request.body);
      const user = request.user as any;

      let totalAmount: number;

      // Subscription payments use a "SUB-" prefixed ID and don't map to Order documents
      const isSubscriptionPayment = order_id.split(',').every(id => id.trim().startsWith('SUB-'));

      if (isSubscriptionPayment) {
        // The amount charged for a subscription upgrade must come from the server's
        // own record of what that plan costs — never from client input. Otherwise a
        // caller could initialize a real payment flow for a trivial amount and still
        // have the full plan activated once the (genuinely successful, just tiny)
        // payment clears.
        const subIds = order_id.split(',').map(id => id.trim().replace(/^SUB-/, ''));
        const subscriptions = await VendorSubscription.find({ _id: { $in: subIds } });

        if (subscriptions.length !== subIds.length) {
          return reply.code(404).send({ error: 'Subscription not found' });
        }

        totalAmount = 0;
        for (const sub of subscriptions) {
          if (sub.vendor_username !== user.username) {
            return reply.code(403).send({ error: 'You can only pay for your own subscription' });
          }
          if (!sub.pending_plan) {
            return reply.code(400).send({ error: 'Subscription has no pending upgrade awaiting payment' });
          }
          totalAmount += sub.pending_amount ?? await getPlanPrice(
            sub.pending_plan,
            (sub.pending_billing_cycle || sub.billing_cycle) as 'monthly' | 'annual'
          );
        }

        if (totalAmount <= 0) {
          return reply.code(400).send({ error: 'Invalid subscription amount' });
        }
      } else {
        // Calculate total from all orders (comma-separated IDs)
        const orderIds = order_id.split(',').map(id => id.trim());
        const orders = await Order.find({ _id: { $in: orderIds } });

        if (orders.length !== new Set(orderIds).size) {
          return reply.code(404).send({ error: 'Orders not found' });
        }

        for (const order of orders) {
          if (order.buyer_username !== user.username) {
            return reply.code(403).send({ error: 'You can only pay for your own orders' });
          }
        }

        totalAmount = orders.reduce((sum, order) => sum + order.total, 0);
      }

      // Determine provider for mobile money
      let provider: 'mtn' | 'airtel' | 'spenn' | 'card' = 'card';
      if (payment_method === 'mobile_money' || payment_method === 'mtn') {
        provider = 'mtn';
      } else if (payment_method === 'airtel') {
        provider = 'airtel';
      } else if (payment_method === 'spenn') {
        provider = 'spenn';
      }

      // Use the unified initialize method
      const paymentData = await itecPayService.initializeTransaction(
        email,
        totalAmount,
        order_id,
        currency,
        [provider],
        phone
      );

      // Persist payment_method on subscription so verify-payment can use the right provider
      if (isSubscriptionPayment) {
        const subIds = order_id.split(',').map(id => id.trim().replace(/^SUB-/, ''));
        await VendorSubscription.updateMany(
          { _id: { $in: subIds } },
          { $set: { payment_method: provider } }
        );
      }

      return {
        status: true,
        message: "Payment initialized",
        data: paymentData.data
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        error: 'Failed to initialize payment',
        message: error.message,
        details: error.details
      });
    }
  });

// ITEC Pay Callback Handler
   // For mobile money (api2/pay) and card payments (pesapal)
   fastify.post('/itecpay/callback', async (request, reply) => {
     // Extract secret key from query parameters for security
     const { secret } = request.query as { secret?: string };

     // Get your secret key from environment variables
     const EXPECTED_SECRET_KEY = process.env.ITECPAY_CALLBACK_SECRET || '';

     if (!secret || secret !== EXPECTED_SECRET_KEY) {
       return reply.code(401).send({ error: 'Invalid or missing secret key' });
     }

// Extract callback data from request body
      // Mobile money callback format (from api2/pay):
      // { transaction_id, amount, status }
      // Card callback format (from pesapal):
      // { PCODE, amount, transID }
      const body = request.body as any;

      // Handle both callback formats
      const transactionId = body.transaction_id || body.transID || body.PCODE;
      const amount = body.amount;
      const status = body.status;

     // For Pesapal card payments, we also receive the order reference
     const orderReference = body.reference || body.order_id;
     const reqRef = body.req_ref || body.reqRef || orderReference;

     if (!transactionId || !amount) {
       return reply.code(400).send({
         error: 'Invalid callback data',
         details: 'Missing required fields: transaction_id/amount'
       });
     }

     // A callback with no status must never be treated as a successful payment —
     // that previously defaulted to 'completed' and approved cancelled/incomplete
     // transactions. If the gateway didn't tell us the outcome, we don't assume one.
     if (!status) {
       fastify.log.warn(`ITEC Pay Callback: Missing status for transaction ${transactionId} — not approving without confirmation`);

       if (!reqRef) {
         return reply.code(400).send({ error: 'Invalid callback data', details: 'Missing status and no reference available to verify' });
       }

       // Fall back to asking ITEC Pay directly for the authoritative transaction status
       // rather than trusting an unstated outcome.
       try {
         const provider: 'mtn' | 'airtel' | 'spenn' | 'card' = body.PCODE ? 'card' : (body.provider || 'mtn');
         await itecPayService.verifyPayment(reqRef, provider);
         // verifyPayment throws unless the gateway confirms success, so reaching here means it's genuinely paid.
       } catch (verifyErr: any) {
         fastify.log.warn(`ITEC Pay Callback: Could not confirm success for transaction ${transactionId}: ${verifyErr.message}`);
         return reply.code(200).send({ status: 'ignored', message: 'Payment not confirmed successful' });
       }
     } else {
       const callbackData = {
         transaction_id: transactionId,
         amount: String(amount),
         status
       };

       // Verify the callback data - rejects cancelled/failed/unknown statuses
       const isValid = itecPayService.verifyCallback(callbackData, EXPECTED_SECRET_KEY);

       if (!isValid) {
         return reply.code(200).send({ status: 'ignored', message: 'Payment not successful' });
       }
     }

     try {
       // Use order reference if available, otherwise use transaction ID
       const orderRefForUpdate = orderReference || transactionId;

       // Process successful payment
       await itecPayService.handleSuccessfulPayment(orderRefForUpdate, transactionId, String(amount), fastify.io);

       console.log(`ITEC Pay Callback: Payment processed - transaction_id: ${transactionId}, amount: ${amount}`);

       return reply.code(200).send({ status: 'success' });
     } catch (error: any) {
       fastify.log.error(error);
       return reply.code(500).send({ error: 'Callback processing failed', message: error.message });
     }
   });

  // Poll payment status endpoint. Unlike /itecpay/verify-and-activate flows,
  // this must NOT throw for a 'pending' status — the customer may simply not
  // have approved the prompt yet — so the frontend can tell "still waiting"
  // apart from "genuinely failed" and show the right thing immediately.
  fastify.post('/itecpay/verify', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const body = request.body as { req_ref: string; provider?: string };
      const { req_ref, provider = 'mtn' } = body;

      if (!req_ref) {
        return reply.code(400).send({ error: 'Missing required field: req_ref' });
      }

      const providerValue = provider as 'mtn' | 'airtel' | 'spenn' | 'card';
      const { status, amount } = await itecPayService.checkPaymentStatus(req_ref, providerValue);

      return { status: true, data: { status: status || 'pending', amount } };
    } catch (error: any) {
      fastify.log.error(error);
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        error: 'Failed to verify payment',
        message: error.message
      });
    }
  });
}
