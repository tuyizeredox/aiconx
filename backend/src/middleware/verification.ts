import { FastifyRequest, FastifyReply } from 'fastify';
import { Store } from '../models/Store';

/**
 * Blocks product creation until the seller's store has passed identity verification.
 * Applied only to product creation — editing/deleting existing products is untouched.
 */
export async function checkStoreVerified(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const store = await Store.findOne({ owner_username: user.username.toLowerCase() }).select('verification_status');

    if (!store) {
      return reply.code(404).send({ error: 'You need to create a store before adding products.' });
    }

    if (store.verification_status !== 'approved') {
      return reply.code(403).send({
        error: 'Store not verified',
        message: 'Your store must be verified before you can add products. Submit your identity verification from your store page.',
        verification_status: store.verification_status,
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during verification check' });
  }
}
