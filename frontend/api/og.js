/**
 * Server-rendered link previews for shared pages.
 *
 * The app is a client-rendered SPA: every route resolves to the same
 * index.html, whose Open Graph tags describe Aicon X the product. Link-preview
 * crawlers (WhatsApp, Messenger, Twitter, Slack, ...) do not run JavaScript, so
 * a shared post has always previewed as the site logo and the site tagline no
 * matter which post it was.
 *
 * vercel.json rewrites those crawlers -- and only those crawlers -- here. A
 * real visitor never reaches this function; they get the SPA exactly as before,
 * so nothing in the app's runtime path changes. This function looks the item up
 * in the API and returns a small document whose <head> describes that one item.
 *
 * Search engines are deliberately NOT routed here. They render JavaScript, so
 * they get the SPA and read the tags Seo.jsx sets from the same descriptions
 * (src/lib/previewMeta.js) -- and serving a search engine a different document
 * than humans get is the shape of thing search engines penalise.
 */

import {
  SITE_NAME,
  SITE_URL,
  FALLBACK,
  describePost,
  describeProduct,
  describeStore,
  postPath,
  productPath,
  pruneJsonLd,
} from '../src/lib/previewMeta.js';

const API_BASE = (process.env.OG_API_BASE || 'https://aiconxbackend.onrender.com/api').replace(/\/+$/, '');

// The backend sleeps on idle and a cold start can run past a crawler's own
// patience. Losing the race is survivable -- we fall back to the generic Aicon X
// card, which is what the crawler would have shown anyway -- but hanging is not,
// because a timed-out fetch means no preview at all rather than a plain one.
const FETCH_TIMEOUT_MS = 5000;

// Ids and slugs are interpolated into an upstream URL, so they are constrained
// to what those identifiers can actually contain rather than merely escaped.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SLUG_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // Unreachable, slow, or malformed upstream all mean the same thing here:
    // describe the site instead of the item.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Keyed by the `page` the rewrite matched, so a route and its preview stay
 * described in one place. `key` names the query parameter the identifier
 * arrives in, which is `slug` for the handle-based store route and `id`
 * everywhere else.
 */
const SOURCES = {
  postdetail: {
    key: 'id',
    path: (id) => `/posts/${encodeURIComponent(id)}`,
    canonical: postPath,
    describe: describePost,
  },
  productdetail: {
    key: 'id',
    path: (id) => `/products/${encodeURIComponent(id)}`,
    canonical: productPath,
    describe: describeProduct,
  },
  storedetail: {
    key: 'id',
    path: (id) => `/stores/${encodeURIComponent(id)}`,
    canonical: (id) => `/storedetail?id=${encodeURIComponent(id)}`,
    describe: describeStore,
  },
  // /stores/:identifier resolves a slug or an id, so the handle route needs no
  // lookup of its own -- only a different canonical form to point back at.
  store: {
    key: 'slug',
    path: (slug) => `/stores/${encodeURIComponent(slug)}`,
    canonical: (slug) => `/store/${encodeURIComponent(slug)}`,
    describe: describeStore,
  },
};

const GENERIC = {
  title: `${SITE_NAME} — Social Commerce & AI-Powered Shopping`,
  description:
    'Discover products, follow stores, connect with communities, and shop smarter with AI on Aicon X.',
  image: FALLBACK,
  type: 'website',
  extra: [],
  jsonLd: null,
};

function renderHtml(meta, { shareUrl, canonicalUrl }) {
  const tags = [
    ['name', 'description', meta.description],
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:type', meta.type],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['property', 'og:url', shareUrl],
    ['property', 'og:locale', 'en_US'],
    ['property', 'og:image', meta.image.url],
    ['property', 'og:image:secure_url', meta.image.url],
    ['property', 'og:image:alt', meta.title],
    // Several crawlers lay the card out before the image has finished
    // downloading, and fall back to the small format when they have nothing to
    // size it by. Only stated when we know it (see previewImage).
    ['property', 'og:image:width', meta.image.width ? String(meta.image.width) : null],
    ['property', 'og:image:height', meta.image.height ? String(meta.image.height) : null],
    // A square image in the wide card is cropped through the middle, which is
    // exactly how a logo ends up looking like a mistake.
    ['name', 'twitter:card', meta.image.square ? 'summary' : 'summary_large_image'],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
    ['name', 'twitter:image', meta.image.url],
    ['name', 'twitter:image:alt', meta.title],
    ['name', 'theme-color', '#f97316'],
    ...meta.extra.map(([property, content]) => ['property', property, content]),
  ]
    .filter(([, , content]) => content)
    .map(([attr, key, content]) => `    <meta ${attr}="${escapeHtml(key)}" content="${escapeHtml(content)}" />`)
    .join('\n');

  const jsonLd = pruneJsonLd(meta.jsonLd);
  // </script> inside a JSON string would close this block early; escaping the
  // slash keeps the JSON valid and the document intact.
  const structuredData = jsonLd
    ? `\n    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';

  // The body exists for the rare human who arrives with a crawler-shaped user
  // agent. It links onward rather than redirecting: a redirect back to the same
  // URL would be matched by the same rule and loop.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(meta.title)} — ${SITE_NAME}</title>
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
${tags}${structuredData}
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif">
    <main style="max-width:34rem;padding:2rem;text-align:center">
      <img src="${escapeHtml(meta.image.url)}" alt="" style="width:100%;border-radius:14px;margin-bottom:1.5rem" />
      <h1 style="font-size:1.25rem;margin:0 0 .5rem">${escapeHtml(meta.title)}</h1>
      <p style="margin:0 0 1.5rem;color:#cbd5e1">${escapeHtml(meta.description)}</p>
      <a href="${escapeHtml(shareUrl)}" style="display:inline-block;padding:.75rem 1.5rem;border-radius:999px;background:#f97316;color:#fff;font-weight:600;text-decoration:none">Open in ${SITE_NAME}</a>
    </main>
  </body>
</html>
`;
}

export default async function handler(req, res) {
  const requestUrl = new URL(req.url || '/', `https://${req.headers?.host || 'www.aiconx.net'}`);
  const params = requestUrl.searchParams;

  const page = params.get('page') || '';
  const source = Object.prototype.hasOwnProperty.call(SOURCES, page) ? SOURCES[page] : null;
  const key = source ? params.get(source.key) : null;
  const pattern = source?.key === 'slug' ? SLUG_PATTERN : ID_PATTERN;

  const matched = Boolean(source && key && pattern.test(key));

  let meta = GENERIC;
  let canonicalPath = '/';

  if (matched) {
    canonicalPath = source.canonical(key);
    const item = await fetchJson(source.path(key));
    if (item && !item.error) {
      try {
        meta = source.describe(item, { url: canonicalPath });
      } catch {
        // A malformed record is not worth failing the preview over.
        meta = GENERIC;
      }
    }
  }

  // og:url is where a click on the card lands, so it carries the rest of the
  // query the sharer actually sent -- `ref` on a product link is the affiliate
  // attribution, and dropping it here would quietly cost them the commission
  // that sharing the link was supposed to earn.
  const [basePath, baseQuery] = canonicalPath.split('?');
  const shareParams = new URLSearchParams(baseQuery || '');
  if (matched) {
    for (const [name, value] of params) {
      // `page` and `slug` are ours, from the rewrite, not the sharer's.
      if (name === 'page' || name === 'slug' || shareParams.has(name)) continue;
      shareParams.append(name, value);
    }
  }
  const query = shareParams.toString();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Crawlers re-scrape the same link every time it is forwarded, so the second
  // share of a popular post is served from the edge without touching the API.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  res.status(200).send(
    renderHtml(meta, {
      shareUrl: `${SITE_URL}${basePath}${query ? `?${query}` : ''}`,
      canonicalUrl: `${SITE_URL}${canonicalPath}`,
    })
  );
}
