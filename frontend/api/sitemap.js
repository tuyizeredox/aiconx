/**
 * /sitemap.xml, rendered from what the catalogue actually holds.
 *
 * The file this replaces listed six static pages, so every product, post and
 * store on the site was left to be found by chance — a search engine has no
 * way to discover /productdetail?id=<ObjectId> on its own, because nothing
 * link-crawlable points at it from outside the app.
 *
 * The backend supplies ids and timestamps only (GET /api/sitemap/urls); the
 * URL shapes live here, next to the routes and the rest of the public-facing
 * metadata.
 */

import { SITE_URL, postPath, productPath, storePath } from '../src/lib/previewMeta.js';

const API_BASE = (process.env.OG_API_BASE || 'https://aiconxbackend.onrender.com/api').replace(/\/+$/, '');

// Generous compared with the preview function's budget: a sitemap fetch is a
// crawler being patient on purpose, and an empty sitemap is worse than a slow
// one. Still bounded, so a sleeping backend cannot hold the request open.
const FETCH_TIMEOUT_MS = 12000;

// Pages that exist regardless of what is in the database. Everything else on
// the site is either private or behind a sign-in, and listing those would just
// spend crawl budget on redirects to /login.
const STATIC_PAGES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/register', changefreq: 'monthly', priority: '0.7' },
  { path: '/login', changefreq: 'monthly', priority: '0.5' },
  { path: '/community-guidelines', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ path, lastmod, changefreq, priority }) {
  const parts = [`    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

async function fetchUrls() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/sitemap/urls`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  const inventory = await fetchUrls();

  const entries = STATIC_PAGES.map(urlEntry);

  // Stores rank above products: a store page is the hub that links onward to
  // its whole catalogue, so it is the more valuable thing to have crawled.
  for (const store of inventory?.stores || []) {
    entries.push(
      urlEntry({
        path: storePath(store.slug ? { slug: store.slug } : store.id),
        lastmod: store.updated_at,
        changefreq: 'weekly',
        priority: '0.8',
      })
    );
  }

  for (const product of inventory?.products || []) {
    entries.push(
      urlEntry({
        path: productPath(product.id),
        lastmod: product.updated_at,
        changefreq: 'weekly',
        priority: '0.7',
      })
    );
  }

  // Posts change after publication far less than a listing does, and there are
  // many more of them, so they get the lower priority and the slower cadence.
  for (const post of inventory?.posts || []) {
    entries.push(
      urlEntry({
        path: postPath(post.id),
        lastmod: post.updated_at,
        changefreq: 'monthly',
        priority: '0.5',
      })
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Missing the backend leaves only the static pages, which is a thin but
  // still-valid sitemap. Cached briefly so a crawler re-asking soon gets a
  // complete one rather than having the gap frozen in for the full window.
  res.setHeader(
    'Cache-Control',
    inventory
      ? 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
      : 'public, max-age=0, s-maxage=60'
  );
  res.status(200).send(xml);
}
