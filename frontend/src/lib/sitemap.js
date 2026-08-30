/**
 * Builds the sitemap XML from the URL inventory the backend reports
 * (GET /api/sitemap/urls).
 *
 * Kept separate from any one runtime because the sitemap has to be produced
 * wherever the frontend happens to be served from: at build time by
 * scripts/generate-sitemap.mjs for a static host, or per request by
 * api/sitemap.js where a serverless runtime is available.
 */

import { SITE_URL, postPath, productPath, storePath } from './previewMeta.js';

// Pages that exist regardless of what is in the database. Everything else on
// the site is either private or behind a sign-in, and listing those would just
// spend crawl budget on redirects to /login.
export const STATIC_PAGES = [
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
  if (lastmod) parts.push(`    <lastmod>${escapeXml(String(lastmod).slice(0, 10))}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

/**
 * `inventory` is the backend's response, or null when it could not be reached
 * — in which case the result is the static pages alone, which is thin but
 * still a valid sitemap rather than a missing one.
 */
export function buildSitemap(inventory) {
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

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
}
