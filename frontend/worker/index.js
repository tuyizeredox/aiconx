/**
 * Link previews at the edge.
 *
 * www.aiconx.net is a static build of a client-rendered SPA: every route
 * resolves to the same index.html, whose Open Graph tags describe Aicon X the
 * product. Link-preview crawlers (WhatsApp, Messenger, Slack, ...) do not run
 * JavaScript, so a shared post previewed as the site logo and the site tagline
 * no matter which post it was. A static host cannot serve those crawlers
 * something different, because it cannot branch on the user agent — so this
 * Worker, which already sits in front of the origin, does it instead.
 *
 * Everything that is not a preview crawler on a shareable route is passed
 * straight through to the origin untouched, so for real visitors this Worker
 * is a no-op. Search engines are deliberately passed through too: they render
 * JavaScript and read the tags Seo.jsx sets from these same descriptions, and
 * serving a search engine a different document than humans get is the shape of
 * thing search engines penalise.
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

const DEFAULT_API_BASE = 'https://aiconxbackend.onrender.com/api';

// The backend sleeps on idle and a cold start can run past a crawler's own
// patience. Losing the race is survivable -- we fall back to the generic Aicon X
// card, which is what the crawler would have shown anyway -- but hanging is not,
// because a timed-out fetch means no preview at all rather than a plain one.
const FETCH_TIMEOUT_MS = 5000;

/**
 * Only the crawlers that build link previews. Search engines are absent on
 * purpose (see the file comment), and so is anything that renders pages for a
 * human, since those must reach the real app.
 */
const PREVIEW_CRAWLER =
  /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|slackbot|slack-imgproxy|telegrambot|discordbot|pinterest|redditbot|skypeuripreview|microsoftpreview|vkshare|viber|snapchat|mastodon|bluesky|bskylink|applebot|iframely|embedly|quora link preview|xing-contenttabreceiver|nuzzel|flipboard|w3c_validator/i;

// Ids and slugs are interpolated into an upstream URL, so they are constrained
// to what those identifiers can actually contain rather than merely escaped.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SLUG_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;

/**
 * Maps a shareable URL onto the API record behind it and the canonical form to
 * point back at. `/stores/:identifier` resolves a slug or an id, which is why
 * both store routes read from it.
 */
function matchRoute(url) {
  const path = url.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  const query = url.searchParams;

  if (path === '/postdetail') {
    const id = query.get('id');
    if (!ID_PATTERN.test(id || '')) return null;
    return { api: `/posts/${encodeURIComponent(id)}`, canonical: postPath(id), describe: describePost };
  }

  if (path === '/productdetail') {
    const id = query.get('id');
    if (!ID_PATTERN.test(id || '')) return null;
    return { api: `/products/${encodeURIComponent(id)}`, canonical: productPath(id), describe: describeProduct };
  }

  if (path === '/storedetail') {
    const id = query.get('id');
    if (!ID_PATTERN.test(id || '')) return null;
    return {
      api: `/stores/${encodeURIComponent(id)}`,
      canonical: `/storedetail?id=${encodeURIComponent(id)}`,
      describe: describeStore,
    };
  }

  // Legacy notification links, kept working because they are already out in
  // the wild (see LegacyProductRedirect in App.jsx).
  const legacyProduct = path.match(/^\/product\/([^/]+)$/);
  if (legacyProduct) {
    const id = decodeURIComponent(legacyProduct[1]);
    if (!ID_PATTERN.test(id)) return null;
    return { api: `/products/${encodeURIComponent(id)}`, canonical: productPath(id), describe: describeProduct };
  }

  const storeSlug = path.match(/^\/store\/([^/]+)$/);
  if (storeSlug) {
    const slug = decodeURIComponent(storeSlug[1]);
    if (!SLUG_PATTERN.test(slug)) return null;
    return {
      api: `/stores/${encodeURIComponent(slug)}`,
      canonical: `/store/${encodeURIComponent(slug)}`,
      describe: describeStore,
    };
  }

  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchJson(apiBase, path) {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // Unreachable, slow, or malformed upstream all mean the same thing here:
    // describe the site instead of the item.
    return null;
  }
}

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
  // A "</script>" inside a JSON string would close this block early; escaping
  // the angle bracket keeps the JSON valid and the document intact.
  const structuredData = jsonLd
    ? `\n    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';

  // The body exists for the rare human who arrives with a crawler-shaped user
  // agent. It links onward rather than redirecting: a redirect back to the same
  // URL would be matched by this same Worker and loop.
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

async function renderPreview(request, url, route, apiBase) {
  const item = await fetchJson(apiBase, route.api);

  let meta = GENERIC;
  if (item && !item.error) {
    try {
      meta = route.describe(item, { url: route.canonical });
    } catch {
      // A malformed record is not worth failing the preview over.
      meta = GENERIC;
    }
  }

  // og:url is where a click on the card lands, so it carries the rest of the
  // query the sharer actually sent -- `ref` on a product link is the affiliate
  // attribution, and dropping it here would quietly cost them the commission
  // that sharing the link was supposed to earn.
  const [basePath, baseQuery] = route.canonical.split('?');
  const shareParams = new URLSearchParams(baseQuery || '');
  for (const [name, value] of url.searchParams) {
    if (shareParams.has(name)) continue;
    shareParams.append(name, value);
  }
  const query = shareParams.toString();

  const html = renderHtml(meta, {
    shareUrl: `${SITE_URL}${basePath}${query ? `?${query}` : ''}`,
    canonicalUrl: `${SITE_URL}${route.canonical}`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Deliberately uncacheable. This response is chosen by user agent, and
      // one URL serves two different documents; letting the edge cache this
      // one risks handing the crawler's page to a real visitor. Preview
      // scrapes are rare and the platforms cache the card their own side, so
      // there is nothing to gain here and a broken page to lose.
      'cache-control': 'no-store',
      'x-preview-render': 'worker',
    },
  });
}

export default {
  async fetch(request, env) {
    try {
      const userAgent = request.headers.get('user-agent') || '';
      if (!PREVIEW_CRAWLER.test(userAgent)) return fetch(request);

      const url = new URL(request.url);
      const route = matchRoute(url);
      if (!route) return fetch(request);

      return await renderPreview(request, url, route, (env?.OG_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, ''));
    } catch {
      // This Worker sits in front of the whole site. Any fault in it must cost
      // a rich preview, never a page — so every unexpected failure falls back
      // to exactly what the origin would have served.
      return fetch(request);
    }
  },
};
