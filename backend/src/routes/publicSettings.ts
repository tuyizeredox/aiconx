import { FastifyInstance } from 'fastify';
import { Settings } from '../models/Settings';

// Unauthenticated, deliberately NOT exempted from the checkMaintenance hook
// (unlike /api/health or /api/admin) — the frontend relies on that: it polls
// this route while showing the maintenance screen, and a 200 response here is
// what tells it maintenance has ended and it's safe to reload.
export async function publicSettingsRoutes(fastify: FastifyInstance) {
  fastify.get('/public', async (_request, reply) => {
    const settings = await Settings.findOne().select('maintenance_mode allow_registration').lean();
    return {
      maintenance_mode: settings?.maintenance_mode ?? false,
      allow_registration: settings?.allow_registration ?? true,
    };
  });
}
