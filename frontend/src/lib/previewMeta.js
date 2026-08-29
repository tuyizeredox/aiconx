/**
 * How a post, product or store describes itself to anything that is not the
 * app: link-preview crawlers, search engines, and the browser tab.
 *
 * This module is deliberately dependency-free and framework-free, because it
 * has two very different callers and both need the same answer:
 *
 *   - api/og.js, the serverless function that renders the <head> a social
 *     crawler scrapes (WhatsApp, Messenger, Slack, ...), which never runs the
 *     app's JavaScript.
 *   - components/shared/Seo.jsx, which sets the same tags client-side for
 *     search engines, since those do render the SPA.
 *
 * Describing an item twice is how the card in a WhatsApp thread ends up saying
 * something different from the page it opens, so it is described once here.
 */

export const SITE_NAME = 'Aicon X';
export const SITE_URL = 'https://www.aiconx.net';
export const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;

// The house image is square, so it gets the small card. Claiming the wide
// format for it is how a fallback ends up letterboxed or centre-cropped.
export const FALLBACK = { url: FALLBACK_IMAGE, width: 1024, height: 1024, square: true };

/** Post bodies carry newlines and emoji; a meta tag holds a single line. */
export function clean(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

export function truncate(value, max) {
  const text = clean(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const kept = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${kept.replace(/[\s,.;:!?-]+$/, '')}…`;
}

export function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

/**
 * Normalises a media URL into something a preview crawler will actually accept.
 *
 * WhatsApp in particular drops images over roughly 600KB and ignores ones it
 * considers too small, so an untouched 4MB portrait upload previews as no image
 * at all. Cloudinary can hand back a correctly sized JPEG from the same asset,
 * which is the difference between a card with a picture and a card without one.
 * Anything not on Cloudinary (S3 originals) is passed through as-is.
 *
 * Returns the dimensions only when we dictated them. A crawler that is told a
 * size lays the card out before the image has downloaded, so a declared size
 * that turns out to be wrong is worse than declaring none at all.
 */
export function previewImage(url) {
  if (!isHttpUrl(url)) return null;
  if (!url.includes('res.cloudinary.com')) return { url, width: null, height: null };

  // A Cloudinary video delivers its poster frame by asking for a still format.
  const isVideo = url.includes('/video/upload/');
  const source = isVideo ? url.replace(/\.(mp4|mov|webm|m3u8)(\?.*)?$/i, '.jpg') : url;

  return {
    url: source.replace('/upload/', '/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto:good/'),
    width: 1200,
    height: 630,
  };
}

function absolute(path) {
  return path.startsWith('http') ? path : `${SITE_URL}${path}`;
}

function idOf(item) {
  return item?.id || item?._id || null;
}

export function postPath(id) {
  return `/postdetail?id=${encodeURIComponent(id)}`;
}

export function productPath(id) {
  return `/productdetail?id=${encodeURIComponent(id)}`;
}

export function storePath(store) {
  const slug = typeof store === 'object' ? store?.slug : null;
  if (slug) return `/store/${encodeURIComponent(slug)}`;
  const id = typeof store === 'object' ? idOf(store) : store;
  return id ? `/storedetail?id=${encodeURIComponent(id)}` : '/marketplace';
}

function authorLabel(post) {
  return clean(post.author_name) || (post.author_username ? `@${post.author_username}` : SITE_NAME);
}

/**
 * A post has no title of its own, so one is made from what it actually is.
 * The body is the post's name when it has one; otherwise the card says who
 * posted and what kind of thing it is, which still beats a bare site name.
 */
export function describePost(post, { url } = {}) {
  const author = authorLabel(post);
  const body = clean(post.content);
  const media = (Array.isArray(post.media_urls) ? post.media_urls : []).filter(isHttpUrl);
  const thumbs = (Array.isArray(post.thumbnail_urls) ? post.thumbnail_urls : []).filter(isHttpUrl);
  const isVideo = post.media_type === 'video';

  let title;
  if (body) {
    title = truncate(body, 90);
  } else if (isVideo) {
    title = `${author} shared a video`;
  } else if (media.length) {
    title = `${author} shared ${media.length > 1 ? `${media.length} photos` : 'a photo'}`;
  } else {
    title = `${author} on ${SITE_NAME}`;
  }

  // A long body is worth continuing into the description; a short one has
  // already been said in full by the title, so the byline is the useful line.
  const description = body.length > 90 ? truncate(body, 200) : `Post by ${author} on ${SITE_NAME}`;

  // For a video the poster frame is the thumbnail, never the .mp4 itself -- a
  // crawler handed a video URL as og:image renders a blank card.
  const image = isVideo
    ? previewImage(thumbs[0] || media[0])
    : previewImage(media[0] || thumbs[0]);

  const canonical = absolute(url || postPath(idOf(post) || ''));
  const published = post.created_at ? new Date(post.created_at).toISOString() : null;

  return {
    title,
    description,
    // Falling back to the author's avatar keeps a text-only post recognisably
    // *someone's* post rather than an anonymous house card.
    image: image || previewImage(post.author_avatar) || FALLBACK,
    type: 'article',
    extra: [
      ['article:author', author],
      ['article:published_time', published],
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SocialMediaPosting',
      headline: truncate(body || title, 110),
      articleBody: body || undefined,
      url: canonical,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      datePublished: published || undefined,
      dateModified: post.updated_at ? new Date(post.updated_at).toISOString() : published || undefined,
      author: {
        '@type': 'Person',
        name: author,
        url: post.author_username
          ? `${SITE_URL}/profile?username=${encodeURIComponent(post.author_username)}`
          : undefined,
      },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        logo: { '@type': 'ImageObject', url: FALLBACK_IMAGE },
      },
      image: media.length ? media : undefined,
      // Engagement counts are what tell a search engine which of a thousand
      // near-identical posts is the one worth showing.
      interactionStatistic: [
        ['https://schema.org/LikeAction', post.likes_count],
        ['https://schema.org/CommentAction', post.comments_count],
        ['https://schema.org/ShareAction', post.shares_count],
      ]
        .filter(([, count]) => Number(count) > 0)
        .map(([type, count]) => ({
          '@type': 'InteractionCounter',
          interactionType: type,
          userInteractionCount: Number(count),
        })),
    },
  };
}

export function describeProduct(product, { url, store } = {}) {
  const images = (Array.isArray(product.images) ? product.images : []).filter(isHttpUrl);
  const image = previewImage(images[0]);
  const price = Number(product.price);
  const hasPrice = Number.isFinite(price) && price > 0;
  const currency = clean(product.currency) || 'RWF';
  const priceLabel = hasPrice ? `${currency} ${price.toLocaleString('en-US')}` : null;
  const name = clean(product.title) || 'Product';
  const summary = clean(product.description);
  const sellerName = clean(store?.name) || clean(product.vendor_username);

  // Price first: it is the fact a shopper scanning a result page is looking
  // for, and search engines surface it in the snippet.
  const description =
    [priceLabel, summary ? truncate(summary, 160) : null].filter(Boolean).join(' · ') ||
    `Available now on ${SITE_NAME}`;

  const canonical = absolute(url || productPath(idOf(product) || ''));
  const inStock = product.status === 'active' && (product.stock === undefined || product.stock === null || Number(product.stock) > 0);
  const rating = Number(product.rating_avg);
  const reviewCount = Number(product.reviews_count ?? product.rating_count);

  return {
    title: name,
    description,
    image: image || FALLBACK,
    type: 'product',
    extra: hasPrice
      ? [
          ['product:price:amount', String(price)],
          ['product:price:currency', currency],
          ['og:availability', inStock ? 'in stock' : 'out of stock'],
        ]
      : [],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description: summary || description,
      image: images.length ? images : undefined,
      sku: idOf(product) || undefined,
      category: clean(product.category) || undefined,
      brand: sellerName ? { '@type': 'Brand', name: sellerName } : undefined,
      offers: hasPrice
        ? {
            '@type': 'Offer',
            url: canonical,
            price: String(price),
            priceCurrency: currency,
            availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: sellerName ? { '@type': 'Organization', name: sellerName } : undefined,
          }
        : undefined,
      // Rich-result stars, but only where there is a real rating behind them:
      // an invented aggregateRating is a structured-data violation.
      aggregateRating:
        Number.isFinite(rating) && rating > 0 && Number.isFinite(reviewCount) && reviewCount > 0
          ? {
              '@type': 'AggregateRating',
              ratingValue: Number(rating.toFixed(2)),
              reviewCount,
            }
          : undefined,
    },
  };
}

export function describeStore(store, { url } = {}) {
  const image = previewImage(store.banner_url) || previewImage(store.logo_url);
  const summary = clean(store.description);
  const name = clean(store.name) || 'Store';
  const canonical = absolute(url || storePath(store));
  const rating = Number(store.rating_avg);
  const reviewCount = Number(store.reviews_count ?? store.rating_count);

  return {
    title: name,
    description: summary ? truncate(summary, 200) : `Shop ${name} on ${SITE_NAME}`,
    image: image || FALLBACK,
    type: 'website',
    extra: [],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'OnlineStore',
      name,
      description: summary || undefined,
      url: canonical,
      image: isHttpUrl(store.banner_url) ? store.banner_url : undefined,
      logo: isHttpUrl(store.logo_url) ? store.logo_url : undefined,
      address: store.location?.city
        ? {
            '@type': 'PostalAddress',
            addressLocality: clean(store.location.city),
            addressCountry: clean(store.location.country) || undefined,
          }
        : undefined,
      aggregateRating:
        Number.isFinite(rating) && rating > 0 && Number.isFinite(reviewCount) && reviewCount > 0
          ? { '@type': 'AggregateRating', ratingValue: Number(rating.toFixed(2)), reviewCount }
          : undefined,
    },
  };
}

/** Drops undefined/empty members so the emitted JSON-LD carries no dead keys. */
export function pruneJsonLd(value) {
  if (Array.isArray(value)) {
    const items = value.map(pruneJsonLd).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      const pruned = pruneJsonLd(raw);
      if (pruned !== undefined) out[key] = pruned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value === undefined || value === null || value === '' ? undefined : value;
}
