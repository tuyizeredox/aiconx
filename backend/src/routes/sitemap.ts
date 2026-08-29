import { FastifyInstance } from 'fastify';
import { Product } from '../models/Product';
import { Post } from '../models/Post';
import { Store } from '../models/Store';

/**
 * The URL inventory behind /sitemap.xml.
 *
 * The sitemap itself is rendered by the frontend (frontend/api/sitemap.js),
 * which is what owns the public URL shapes; this route's job is only to say
 * which items exist, are public, and when each last changed. It returns
 * identifiers and timestamps rather than documents, so a sitemap covering
 * thousands of products costs one lean indexed read per collection.
 *
 * Unauthenticated by design: a sitemap lists exactly what an anonymous visitor
 * is allowed to see, which is the same set these filters select.
 */

// The sitemap protocol caps a single file at 50,000 URLs. Staying well under
// it keeps the response small enough to cache whole and leaves headroom for
// the static pages the renderer adds.
const DEFAULT_LIMIT = 5000;
const MAX_LIMIT = 20000;

function parseLimit(raw: unknown): number {
  const parsed = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function sitemapRoutes(fastify: FastifyInstance) {
  fastify.get('/urls', async (request, reply) => {
    try {
      const limit = parseLimit((request.query as any)?.limit);

      // Newest-first, so that when a catalogue outgrows the cap it is the
      // stalest entries that fall off rather than the freshest.
      const [products, posts, stores] = await Promise.all([
        Product.find({ status: 'active' })
          .select('_id updated_at')
          .sort({ updated_at: -1 })
          .limit(limit)
          .lean(),
        Post.find({ visibility: 'public', is_active: { $ne: false } })
          .select('_id updated_at')
          .sort({ updated_at: -1 })
          .limit(limit)
          .lean(),
        Store.find({ status: 'active' })
          .select('_id slug updated_at')
          .sort({ updated_at: -1 })
          .limit(limit)
          .lean(),
      ]);

      const stamp = (value: any) => (value ? new Date(value).toISOString() : null);

      // A short shared cache window: the sitemap is re-rendered from this on
      // demand, and a crawler asking twice in a minute should not cost two
      // full scans.
      reply.header('Cache-Control', 'public, max-age=0, s-maxage=1800, stale-while-revalidate=86400');

      return {
        generated_at: new Date().toISOString(),
        limit,
        products: products.map((p: any) => ({ id: String(p._id), updated_at: stamp(p.updated_at) })),
        posts: posts.map((p: any) => ({ id: String(p._id), updated_at: stamp(p.updated_at) })),
        stores: stores.map((s: any) => ({
          id: String(s._id),
          slug: s.slug || null,
          updated_at: stamp(s.updated_at),
        })),
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
