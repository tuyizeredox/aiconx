import axios from 'axios';

/**
 * Sources real photos for AI-generated storefront drafts and product proposals.
 *
 * The hard requirement is *relevance*: a photo attached to "Samsung Galaxy S23
 * Ultra" has to look like that phone, not like a random landscape. Two things
 * make that work:
 *
 * 1. A provider chain that always has a keyless option. Wikimedia Commons and
 *    Openverse need no API key and index photos by their real subject, so a
 *    deployment with no keys configured still gets on-topic photos. Unsplash
 *    (UNSPLASH_ACCESS_KEY) and Pexels (PEXELS_API_KEY) are used when available
 *    for nicer stock photography.
 * 2. A relevance check on every result. Each provider returns the photo's own
 *    metadata (alt text, title, tags) and a hit is only accepted if it actually
 *    mentions what we searched for. Non-matching hits are discarded and the
 *    query is broadened step by step ("samsung galaxy s23 ultra" → "samsung
 *    smartphone" → "smartphone" → "consumer electronics").
 *
 * If nothing relevant is found we return a generated placeholder rather than an
 * unrelated photo — a labelled tile is honest, a random mountain on a phone
 * listing is not. LLM-invented image URLs are never trusted; they reliably
 * 404.
 */

const UNSPLASH_SEARCH_URL = 'https://api.unsplash.com/search/photos';
const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';
const OPENVERSE_SEARCH_URL = 'https://api.openverse.org/v1/images/';
const WIKIMEDIA_API_URL = 'https://commons.wikimedia.org/w/api.php';

const REQUEST_TIMEOUT_MS = 6000;
// Upper bound on time spent sourcing one photo, so a slow provider can't stall
// storefront generation. Once exceeded we stop trying and return a placeholder.
const SEARCH_BUDGET_MS = 12000;
const USER_AGENT = 'Vetora-Storefront/1.0 (marketplace storefront image sourcing)';

export type ImageOrientation = 'landscape' | 'square';

interface ImageHit {
  url: string;
  /** The photo's own description/title/tags — what the relevance check reads. */
  text: string;
}

interface ProviderFn {
  (query: string, count: number, orientation: ImageOrientation): Promise<ImageHit[]>;
}

// ---------------------------------------------------------------------------
// Subject inference
// ---------------------------------------------------------------------------

/**
 * Maps words that appear in product titles to the plain-English subject a photo
 * library actually indexes. "OPPO Find X6 Pro" means nothing to Unsplash;
 * "smartphone" means exactly the right thing.
 *
 * Keywords match whole words only (plus a simple plural), and the longest
 * matching keyword wins — so "Apple Watch" resolves to smartwatch rather than
 * wristwatch, and "Handwoven Basket" is not read as an oven.
 */
const SUBJECT_RULES: Array<{ subject: string; keywords: string[] }> = [
  // Electronics
  { subject: 'smartphone', keywords: ['smartphone', 'iphone', 'samsung galaxy', 'galaxy', 'pixel', 'oneplus', 'xiaomi', 'redmi', 'oppo', 'vivo', 'huawei', 'tecno', 'infinix', 'itel', 'realme', 'nokia', 'motorola', 'mobile phone', 'cell phone', 'phone'] },
  { subject: 'laptop computer', keywords: ['macbook', 'laptop', 'thinkpad', 'chromebook', 'ultrabook', 'ideapad', 'vivobook', 'notebook pc'] },
  { subject: 'tablet computer', keywords: ['ipad', 'tablet', 'galaxy tab'] },
  { subject: 'wireless earbuds', keywords: ['earbud', 'airpod', 'earphone', 'buds'] },
  { subject: 'headphones', keywords: ['headphone', 'headset'] },
  { subject: 'smartwatch', keywords: ['smartwatch', 'smart watch', 'fitness tracker', 'apple watch', 'fitbit'] },
  { subject: 'television screen', keywords: ['television', 'smart tv', 'tv', 'oled', 'qled'] },
  { subject: 'photo camera', keywords: ['camera', 'dslr', 'gopro', 'mirrorless', 'camcorder'] },
  { subject: 'bluetooth speaker', keywords: ['speaker', 'soundbar', 'boombox'] },
  { subject: 'phone charger', keywords: ['power bank', 'powerbank', 'charger', 'charging cable', 'adapter'] },
  { subject: 'game console controller', keywords: ['playstation', 'xbox', 'nintendo', 'game console', 'gamepad', 'controller'] },
  { subject: 'computer keyboard', keywords: ['keyboard'] },
  { subject: 'computer mouse', keywords: ['mouse', 'trackpad'] },
  { subject: 'computer monitor', keywords: ['monitor', 'display screen'] },
  { subject: 'printer', keywords: ['printer', 'scanner'] },
  { subject: 'router wifi', keywords: ['router', 'modem', 'wifi'] },
  { subject: 'refrigerator', keywords: ['fridge', 'refrigerator', 'freezer'] },
  { subject: 'microwave oven', keywords: ['microwave', 'oven', 'air fryer', 'blender', 'kettle', 'toaster'] },
  { subject: 'phone case', keywords: ['phone case', 'screen protector'] },

  // Fashion
  { subject: 'sneakers shoes', keywords: ['sneaker', 'trainer', 'running shoe', 'shoe'] },
  { subject: 'leather boots', keywords: ['boot'] },
  { subject: 'sandals', keywords: ['sandal', 'flip flop', 'slipper'] },
  { subject: 'high heels', keywords: ['heel', 'stiletto', 'pump'] },
  { subject: 'dress fashion', keywords: ['dress', 'gown'] },
  { subject: 'shirt clothing', keywords: ['shirt', 'blouse', 'tee', 't-shirt', 'polo'] },
  { subject: 'jacket coat', keywords: ['jacket', 'coat', 'blazer', 'hoodie', 'sweater'] },
  { subject: 'jeans trousers', keywords: ['jean', 'trouser', 'pants', 'chino', 'short'] },
  { subject: 'skirt fashion', keywords: ['skirt'] },
  { subject: 'african print fabric', keywords: ['kitenge', 'ankara', 'kente', 'african print'] },
  { subject: 'handbag', keywords: ['handbag', 'purse', 'tote', 'clutch'] },
  { subject: 'backpack', keywords: ['backpack', 'rucksack', 'satchel'] },
  { subject: 'suitcase luggage', keywords: ['suitcase', 'luggage'] },
  { subject: 'sunglasses', keywords: ['sunglass', 'eyewear', 'glasses'] },
  { subject: 'wristwatch', keywords: ['watch'] },
  { subject: 'jewelry necklace', keywords: ['necklace', 'jewelry', 'jewellery', 'pendant', 'bracelet', 'earring', 'ring'] },
  { subject: 'hat cap', keywords: ['hat', 'cap', 'beanie'] },
  { subject: 'belt leather', keywords: ['belt'] },
  { subject: 'scarf', keywords: ['scarf', 'shawl'] },
  { subject: 'socks', keywords: ['sock'] },

  // Beauty
  { subject: 'skincare serum bottle', keywords: ['serum', 'moisturizer', 'moisturiser', 'face cream', 'toner', 'cleanser', 'skincare'] },
  { subject: 'lipstick makeup', keywords: ['lipstick', 'lip gloss', 'lip balm'] },
  { subject: 'makeup cosmetics', keywords: ['mascara', 'foundation', 'eyeshadow', 'concealer', 'blush', 'makeup', 'nail polish'] },
  { subject: 'perfume bottle', keywords: ['perfume', 'fragrance', 'cologne', 'body spray'] },
  { subject: 'shampoo bottle', keywords: ['shampoo', 'conditioner', 'hair oil', 'hair cream'] },
  { subject: 'soap bar', keywords: ['soap', 'body wash', 'shower gel'] },
  { subject: 'sunscreen lotion', keywords: ['sunscreen', 'spf', 'body lotion', 'lotion'] },

  // Home
  { subject: 'sofa couch', keywords: ['sofa', 'couch', 'settee'] },
  { subject: 'armchair', keywords: ['armchair', 'chair', 'stool'] },
  { subject: 'wooden table', keywords: ['table', 'desk'] },
  { subject: 'bed bedroom', keywords: ['bed', 'mattress', 'headboard'] },
  { subject: 'bedding sheets', keywords: ['bedsheet', 'bed sheet', 'duvet', 'pillow', 'blanket', 'towel'] },
  { subject: 'table lamp', keywords: ['lamp', 'lantern', 'light fixture', 'chandelier'] },
  { subject: 'area rug', keywords: ['rug', 'carpet', 'mat'] },
  { subject: 'curtains window', keywords: ['curtain', 'drape', 'blind'] },
  { subject: 'cookware pots', keywords: ['cookware', 'pot', 'pan', 'saucepan', 'skillet', 'cutlery', 'utensil'] },
  { subject: 'ceramic mug', keywords: ['mug', 'cup', 'tumbler', 'flask'] },
  { subject: 'dinner plates', keywords: ['plate', 'bowl', 'dinnerware', 'crockery'] },
  { subject: 'storage basket', keywords: ['basket', 'storage box', 'organizer', 'shelf'] },
  { subject: 'houseplant pot', keywords: ['plant', 'planter', 'vase'] },
  { subject: 'scented candle', keywords: ['candle', 'diffuser', 'incense'] },
  { subject: 'wall clock', keywords: ['clock'] },
  // Not bare "frame" — that reads "bed frame" and "phone frame" as wall art.
  { subject: 'wall art frame', keywords: ['wall art', 'picture frame', 'photo frame', 'mirror'] },

  // Sports
  { subject: 'football soccer ball', keywords: ['football', 'soccer'] },
  { subject: 'basketball', keywords: ['basketball'] },
  { subject: 'yoga mat', keywords: ['yoga', 'pilates', 'exercise mat'] },
  { subject: 'dumbbell gym weights', keywords: ['dumbbell', 'barbell', 'kettlebell', 'weight plate', 'gym equipment'] },
  { subject: 'bicycle', keywords: ['bicycle', 'bike', 'cycling'] },
  { subject: 'water bottle', keywords: ['water bottle'] },
  { subject: 'tennis racket', keywords: ['tennis', 'racket', 'racquet', 'badminton'] },
  { subject: 'camping tent', keywords: ['tent', 'camping', 'sleeping bag'] },

  // Food
  { subject: 'coffee beans', keywords: ['coffee', 'espresso', 'arabica'] },
  { subject: 'tea leaves', keywords: ['tea', 'chai'] },
  { subject: 'honey jar', keywords: ['honey'] },
  { subject: 'chocolate bar', keywords: ['chocolate', 'cocoa'] },
  { subject: 'spices seasoning', keywords: ['spice', 'pepper', 'chili', 'seasoning', 'masala'] },
  { subject: 'fresh bread bakery', keywords: ['bread', 'bakery', 'pastry', 'croissant', 'cake', 'cookie', 'biscuit'] },
  { subject: 'fresh fruit', keywords: ['fruit', 'banana', 'mango', 'avocado', 'pineapple', 'berry'] },
  { subject: 'fresh vegetables', keywords: ['vegetable', 'tomato', 'potato', 'onion', 'salad'] },
  { subject: 'rice grains', keywords: ['rice', 'beans', 'maize', 'flour', 'cereal'] },
  { subject: 'cooking oil bottle', keywords: ['cooking oil', 'olive oil', 'vinegar', 'sauce'] },
  { subject: 'juice drink bottle', keywords: ['juice', 'smoothie', 'soda', 'drink', 'beverage', 'wine', 'beer'] },
  { subject: 'peanut butter jar', keywords: ['peanut', 'jam', 'butter'] },

  // Art / books / handmade
  { subject: 'canvas painting', keywords: ['painting', 'canvas', 'artwork', 'portrait', 'landscape art'] },
  { subject: 'art print poster', keywords: ['print', 'poster', 'illustration'] },
  { subject: 'sculpture statue', keywords: ['sculpture', 'statue', 'carving', 'figurine'] },
  { subject: 'pottery ceramics', keywords: ['pottery', 'ceramic', 'clay'] },
  { subject: 'woven basket craft', keywords: ['woven', 'weaving', 'agaseke', 'raffia', 'wicker'] },
  { subject: 'handmade craft', keywords: ['handmade', 'handcrafted', 'artisan', 'crochet', 'knitted', 'beaded'] },
  { subject: 'stacked books', keywords: ['book', 'novel', 'paperback', 'hardcover'] },
  { subject: 'notebook stationery', keywords: ['notebook', 'journal', 'diary', 'stationery', 'pen', 'pencil'] },
  { subject: 'toys for kids', keywords: ['toy', 'puzzle', 'doll', 'lego'] },
  { subject: 'baby products', keywords: ['baby', 'diaper', 'stroller', 'nappy'] },
];

/** Broad, photo-library-friendly query per store/product category. */
const CATEGORY_QUERY: Record<string, string> = {
  fashion: 'fashion clothing apparel',
  electronics: 'consumer electronics gadget',
  home: 'home decor interior',
  beauty: 'beauty cosmetics products',
  sports: 'sports fitness equipment',
  food: 'food fresh produce',
  art: 'art artwork gallery',
  books: 'books reading',
  handmade: 'handmade artisan craft',
  other: 'retail shop products',
};

/** Background gradient per category for the generated placeholder tile. */
const CATEGORY_GRADIENT: Record<string, [string, string]> = {
  fashion: ['#db2777', '#7c3aed'],
  electronics: ['#0ea5e9', '#4338ca'],
  home: ['#0d9488', '#065f46'],
  beauty: ['#f472b6', '#be185d'],
  sports: ['#16a34a', '#0f766e'],
  food: ['#f59e0b', '#b45309'],
  art: ['#8b5cf6', '#6d28d9'],
  books: ['#334155', '#0f172a'],
  handmade: ['#d97706', '#92400e'],
  other: ['#ea580c', '#c2410c'],
};

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'our', 'new', 'best', 'top',
  'pro', 'max', 'plus', 'ultra', 'mini', 'lite', 'premium', 'quality', 'original', 'official',
  'edition', 'series', 'model', 'version', 'set', 'pack', 'piece', 'pcs', 'size', 'color',
  'colour', 'style', 'design', 'genuine', 'authentic', 'store', 'shop', 'sale', 'buy',
]);

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/** Strips marketing noise so the remaining words describe the physical object. */
function cleanTitle(title: string): string {
  return title
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/[|\-–—,/]/)[0]
    .replace(/\b\d+\s?(gb|tb|mb|ml|kg|g|cm|mm|inch|in|l|oz)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** Whole-word (or simple plural) match, so "handwoven" is not an "oven". */
function matchesKeyword(haystack: string, keyword: string): boolean {
  return new RegExp(`(?:^| )${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es)?(?: |$)`).test(haystack);
}

/**
 * Resolves the plain-English subject of a product title (or a vendor's
 * free-text store description), falling back to the category.
 */
export function inferSubject(text: string, category?: string): string | null {
  const haystack = normalize(text).trim();
  let best: { subject: string; length: number } | null = null;

  for (const rule of SUBJECT_RULES) {
    for (const keyword of rule.keywords) {
      // Longest keyword wins: "apple watch" beats "watch", "galaxy tab" beats
      // "galaxy". Ties keep the earlier (more specific) rule.
      if (keyword.length > (best?.length ?? 0) && matchesKeyword(haystack, keyword.toLowerCase())) {
        best = { subject: rule.subject, length: keyword.length };
      }
    }
  }
  if (best) return best.subject;

  return category && CATEGORY_QUERY[category] ? CATEGORY_QUERY[category] : null;
}

function categoryQuery(category?: string): string {
  return CATEGORY_QUERY[category || 'other'] || CATEGORY_QUERY.other;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
// Commons holds plenty of non-photographic media that would look wrong on a
// product card.
const BAD_FILE_HINT = /logo|icon|map|diagram|chart|flag|coat of arms|signature|screenshot|barcode|\.svg|\.tiff?|\.gif|\.pdf|\.ogv|\.webm/i;

async function unsplashProvider(query: string, count: number, orientation: ImageOrientation): Promise<ImageHit[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!accessKey) return [];
  const res = await axios.get(UNSPLASH_SEARCH_URL, {
    params: {
      query,
      per_page: count,
      orientation: orientation === 'square' ? 'squarish' : 'landscape',
      content_filter: 'high',
    },
    headers: { Authorization: `Client-ID ${accessKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });
  return (res.data?.results || [])
    .map((r: any) => ({
      url: r?.urls?.regular as string,
      text: [r?.alt_description, r?.description, ...(r?.tags || []).map((t: any) => t?.title)]
        .filter(Boolean)
        .join(' '),
    }))
    .filter((h: ImageHit) => !!h.url);
}

async function pexelsProvider(query: string, count: number, orientation: ImageOrientation): Promise<ImageHit[]> {
  const apiKey = process.env.PEXELS_API_KEY?.trim();
  if (!apiKey) return [];
  const res = await axios.get(PEXELS_SEARCH_URL, {
    params: { query, per_page: count, orientation: orientation === 'square' ? 'square' : 'landscape' },
    headers: { Authorization: apiKey },
    timeout: REQUEST_TIMEOUT_MS,
  });
  return (res.data?.photos || [])
    .map((p: any) => ({
      url: (p?.src?.large || p?.src?.medium) as string,
      text: [p?.alt, p?.url].filter(Boolean).join(' '),
    }))
    .filter((h: ImageHit) => !!h.url);
}

/** Keyless CC-licensed image search — the default when no API keys are set. */
async function openverseProvider(query: string, count: number): Promise<ImageHit[]> {
  const res = await axios.get(OPENVERSE_SEARCH_URL, {
    params: { q: query, page_size: Math.min(count, 20), mature: false, license_type: 'commercial' },
    headers: { 'User-Agent': USER_AGENT },
    timeout: REQUEST_TIMEOUT_MS,
  });
  return (res.data?.results || [])
    .map((r: any) => {
      const direct = typeof r?.url === 'string' && r.url.startsWith('https://') && IMAGE_EXT.test(r.url) ? r.url : null;
      return {
        url: (direct || r?.thumbnail) as string,
        text: [r?.title, ...(r?.tags || []).map((t: any) => t?.name)].filter(Boolean).join(' '),
      };
    })
    .filter((h: ImageHit) => !!h.url && h.url.startsWith('https://') && !BAD_FILE_HINT.test(h.text));
}

/**
 * Keyless, and uniquely good at exact product names — Commons has real photos
 * filed under "Samsung Galaxy S23 Ultra" that a stock library does not.
 */
async function wikimediaProvider(query: string, count: number): Promise<ImageHit[]> {
  const res = await axios.get(WIKIMEDIA_API_URL, {
    params: {
      action: 'query',
      format: 'json',
      formatversion: 2,
      generator: 'search',
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: 6,
      gsrlimit: Math.min(count, 10),
      prop: 'imageinfo',
      iiprop: 'url|mime',
      iiurlwidth: 1200,
    },
    headers: { 'User-Agent': USER_AGENT },
    timeout: REQUEST_TIMEOUT_MS,
  });
  const pages = res.data?.query?.pages;
  return (Array.isArray(pages) ? pages : [])
    .map((page: any) => {
      const info = page?.imageinfo?.[0];
      const title = String(page?.title || '').replace(/^File:/i, '');
      return { url: (info?.thumburl || info?.url) as string, text: title, mime: info?.mime as string };
    })
    .filter((h: any) => !!h.url && /^image\/(jpeg|png|webp)$/.test(h.mime || '') && !BAD_FILE_HINT.test(h.text))
    .map(({ url, text }: any) => ({ url, text }));
}

const PROVIDERS: Record<string, ProviderFn> = {
  unsplash: (q, c, o) => unsplashProvider(q, c, o),
  pexels: (q, c, o) => pexelsProvider(q, c, o),
  openverse: (q, c) => openverseProvider(q, c),
  wikimedia: (q, c) => wikimediaProvider(q, c),
};

// ---------------------------------------------------------------------------
// Result cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 400;
const cache = new Map<string, { at: number; hits: ImageHit[] }>();

async function fetchHits(provider: string, query: string, count: number, orientation: ImageOrientation): Promise<ImageHit[]> {
  const key = `${provider}|${orientation}|${query.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.hits;

  let hits: ImageHit[] = [];
  try {
    hits = await PROVIDERS[provider](query, count, orientation);
  } catch {
    // A provider being down, rate-limited or unconfigured just moves us to the
    // next one — never fail storefront generation over a photo.
    hits = [];
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), hits });
  return hits;
}

// ---------------------------------------------------------------------------
// Relevance
// ---------------------------------------------------------------------------

/**
 * How many of the query's meaningful words the photo's own metadata mentions.
 * Substring matching so "smartphone" matches "smartphones" and "phone" matches
 * "smartphone".
 */
function relevanceScore(hit: ImageHit, queryTokens: string[]): number {
  if (!hit.text) return 0;
  const text = normalize(hit.text);
  return queryTokens.reduce((score, token) => (text.includes(token) ? score + 1 : score), 0);
}

/** Best-first ordering of hits that actually match the query. */
function rankRelevant(hits: ImageHit[], query: string, strict: boolean): string[] {
  // Storefront blocks cap image URLs at 2000 chars — a URL we can't store is
  // no use however relevant it is.
  hits = hits.filter((h) => h.url.length <= MAX_IMAGE_URL_LENGTH);
  if (!strict) return hits.map((h) => h.url);
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return hits.map((h) => h.url);
  return hits
    .map((hit) => ({ url: hit.url, score: relevanceScore(hit, queryTokens) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((h) => h.url);
}

// ---------------------------------------------------------------------------
// Placeholder
// ---------------------------------------------------------------------------

/** Storefront blocks cap image URLs at 2000 chars, so the data URI must fit. */
const MAX_IMAGE_URL_LENGTH = 1900;

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string)
  );
}

/**
 * Encodes an SVG for a data URI, touching only the characters that actually
 * break one. Full encodeURIComponent would roughly triple the length and blow
 * the 2000-char cap; attributes are single-quoted in the markup below so
 * double quotes never appear.
 */
function svgToDataUri(svg: string): string {
  const encoded = svg
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/"/g, '%22')
    .replace(/\s+/g, ' ')
    .replace(/ /g, '%20');
  return `data:image/svg+xml,${encoded}`;
}

/** Splits a label into at most `maxLines` lines of roughly `perLine` chars. */
function wrapLabel(label: string, perLine: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of (label || 'Product').trim().split(/\s+/)) {
    if (current && `${current} ${word}`.length > perLine) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) return lines;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current.slice(0, perLine + 6));
  return lines.slice(0, maxLines);
}

/**
 * A labelled tile used when no relevant photo exists. Deliberately not a random
 * stock photo: an unrelated image on a product listing misleads shoppers, and
 * the vendor is about to replace it with their own photo anyway.
 */
export function placeholderImage(label: string, category?: string, size: ImageOrientation = 'square'): string {
  const [from, to] = CATEGORY_GRADIENT[category || 'other'] || CATEGORY_GRADIENT.other;
  const [w, h] = size === 'square' ? [900, 900] : [1200, 800];
  const font = 'Helvetica,Arial,sans-serif';
  const fontSize = Math.round(w / 15);

  const lines = wrapLabel(label, 18, 2);
  const startY = h / 2 - (lines.length - 1) * fontSize * 0.65;
  const text = lines
    .map(
      (line, i) =>
        `<text x='${w / 2}' y='${Math.round(startY + i * fontSize * 1.3)}' font-family='${font}' font-size='${fontSize}' font-weight='600' fill='#fff' text-anchor='middle' dominant-baseline='middle'>${escapeXml(line)}</text>`
    )
    .join('');

  const background =
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs>` +
    `<rect width='${w}' height='${h}' fill='url(#g)'/>`;

  const uri = svgToDataUri(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${background}${text}` +
      `<text x='${w / 2}' y='${h - fontSize}' font-family='${font}' font-size='${Math.round(fontSize * 0.45)}' fill='#fff' fill-opacity='.75' text-anchor='middle'>Add your photo</text></svg>`
  );
  if (uri.length <= MAX_IMAGE_URL_LENGTH) return uri;

  // An unusually long label pushed it over the cap — drop the text entirely
  // rather than emit a URL the storefront schema would reject.
  return svgToDataUri(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${background}</svg>`);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

interface SearchStep {
  query: string;
  /** Providers to try, in order, for this query. */
  providers: string[];
  /** Whether hits must pass the relevance check. Only the broadest step opts out. */
  strict: boolean;
}

/**
 * Runs the query cascade and returns relevant photo URLs, best match first.
 * Callers get a list (not one URL) so a batch can hand different products
 * different photos when they end up sharing a fallback query.
 */
async function runSteps(steps: SearchStep[], count: number, orientation: ImageOrientation): Promise<string[]> {
  const deadline = Date.now() + SEARCH_BUDGET_MS;
  const found: string[] = [];

  for (const step of steps) {
    if (!step.query) continue;
    for (const provider of step.providers) {
      if (Date.now() > deadline) return found;
      const hits = await fetchHits(provider, step.query, Math.max(count, 8), orientation);
      for (const url of rankRelevant(hits, step.query, step.strict)) {
        if (!found.includes(url)) found.push(url);
      }
      if (found.length >= count) return found.slice(0, count);
    }
  }
  return found.slice(0, count);
}

/**
 * Photo candidates for one proposed product, best match first, always ending in
 * a placeholder so callers never have to handle an empty list.
 *
 * @param hint Optional plain-language description of the object from the LLM
 *             (e.g. "black smartphone"), used when the model name alone finds
 *             nothing.
 */
export async function searchProductImages(
  title: string,
  category?: string,
  hint?: string,
  count = 5
): Promise<string[]> {
  const cleaned = cleanTitle(title);
  const subject = inferSubject(`${cleaned} ${hint || ''}`, category);
  const brand = cleaned.split(' ')[0] || '';
  const broad = categoryQuery(category);

  const steps: SearchStep[] = [
    // Exact model name: catalog-style sources index these, stock libraries don't.
    { query: cleaned, providers: ['wikimedia', 'openverse', 'unsplash', 'pexels'], strict: true },
  ];
  if (hint && normalize(hint) !== normalize(cleaned)) {
    steps.push({ query: hint, providers: ['unsplash', 'pexels', 'openverse'], strict: true });
  }
  if (subject) {
    if (brand.length > 2 && !normalize(subject).includes(normalize(brand).trim())) {
      steps.push({ query: `${brand} ${subject}`, providers: ['unsplash', 'pexels', 'openverse'], strict: true });
    }
    steps.push({ query: subject, providers: ['unsplash', 'pexels', 'openverse'], strict: true });
  }
  // Last resort: a category photo, accepted without the relevance check. Still
  // in the right neighbourhood — a clothing rail for a fashion store — where the
  // old behaviour would hand back an arbitrary landscape.
  steps.push({ query: broad, providers: ['unsplash', 'pexels', 'openverse'], strict: false });

  const urls = await runSteps(steps, count, 'square');
  return [...urls, placeholderImage(cleanTitle(title) || 'Product', category, 'square')];
}

/**
 * Photos for storefront layout blocks (hero, image + text, gallery).
 *
 * @param subjectHint What the store actually sells, in plain words — derived
 *                    from the vendor's prompt, not from AI-written marketing
 *                    copy ("Power in your pocket" is a useless search query).
 */
export async function searchStockImages(
  query: string,
  count = 1,
  category = 'other',
  subjectHint?: string
): Promise<string[]> {
  const subject = subjectHint || inferSubject(query, category) || categoryQuery(category);
  const broad = categoryQuery(category);

  const steps: SearchStep[] = [
    { query: subject, providers: ['unsplash', 'pexels', 'openverse'], strict: true },
  ];
  if (normalize(broad) !== normalize(subject)) {
    steps.push({ query: broad, providers: ['unsplash', 'pexels', 'openverse'], strict: true });
  }
  steps.push({ query: broad, providers: ['unsplash', 'pexels', 'openverse'], strict: false });

  const urls = await runSteps(steps, count, 'landscape');
  if (urls.length >= count) return urls.slice(0, count);

  // Top up with placeholders so galleries keep their requested slot count.
  const label = subjectHint || query || 'Featured';
  return [
    ...urls,
    ...Array.from({ length: count - urls.length }, () => placeholderImage(label, category, 'landscape')),
  ];
}
