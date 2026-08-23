/**
 * Client-side personalization signals.
 *
 * The feed gets more useful the more the shopper uses the app, and none of
 * that requires a round trip: every meaningful action (viewing a product,
 * saving one, searching, tapping a category, following a creator) is recorded
 * locally and decayed over time, then read back as a small "taste profile"
 * the feed uses to order categories, weight rails and pick a price band.
 *
 * Deliberately local-first:
 *  - it works for signed-out visitors, who are exactly the people whose feed
 *    has nothing else to go on;
 *  - it never blocks a render on a network call;
 *  - server-side recommendations (productsAPI.getRecommendations) still lead
 *    for signed-in users — these signals refine the ordering around them.
 *
 * Nothing here is authoritative. Treat a missing/corrupt profile as "no
 * preferences yet" and fall back to the generic feed.
 */

const STORAGE_KEY = "iqon_taste_v1";
const MAX_RECENT = 40;
const MAX_SEARCHES = 12;

// A signal's weight halves roughly every two weeks, so last month's browsing
// never outranks what the shopper cares about today.
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

// How much each kind of interaction says about intent. A purchase is a far
// stronger statement than a glance at a product page.
const ACTION_WEIGHTS = {
  view: 1,
  search: 2,
  category: 2,
  like: 3,
  save: 4,
  cart: 5,
  purchase: 8,
};

const emptyProfile = () => ({
  categories: {},   // category -> { score, at }
  recentProducts: [], // [{ id, category, price, store_id, at }]
  searches: [],     // [{ q, at }]
  prices: [],       // recent prices the shopper engaged with
  updated_at: 0,
});

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyProfile();
    return { ...emptyProfile(), ...parsed };
  } catch {
    // Private mode, cleared storage, or a shape from an older build — all of
    // these just mean "no preferences yet".
    return emptyProfile();
  }
}

function write(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("taste:updated"));
  } catch {
    // Storage full or unavailable: personalization is a bonus, never a blocker.
  }
}

function decay(score, at, now) {
  if (!Number.isFinite(score) || !Number.isFinite(at)) return 0;
  const age = Math.max(0, now - at);
  return score * Math.pow(0.5, age / HALF_LIFE_MS);
}

/**
 * Record one interaction.
 *
 * @param {"view"|"search"|"category"|"like"|"save"|"cart"|"purchase"} action
 * @param {object} payload - { category, price, id, store_id, query }
 */
export function recordSignal(action, payload = {}) {
  const weight = ACTION_WEIGHTS[action];
  if (!weight) return;

  const now = Date.now();
  const profile = read();

  const category = (payload.category || "").toLowerCase().trim();
  if (category) {
    const prev = profile.categories[category];
    const carried = prev ? decay(prev.score, prev.at, now) : 0;
    profile.categories[category] = { score: carried + weight, at: now };
  }

  const price = Number(payload.price);
  if (Number.isFinite(price) && price > 0) {
    profile.prices = [price, ...profile.prices].slice(0, MAX_RECENT);
  }

  if (payload.id) {
    profile.recentProducts = [
      { id: String(payload.id), category, price: Number.isFinite(price) ? price : null, store_id: payload.store_id || null, at: now },
      ...profile.recentProducts.filter(p => p.id !== String(payload.id)),
    ].slice(0, MAX_RECENT);
  }

  const query = (payload.query || "").trim();
  if (query) {
    profile.searches = [
      { q: query, at: now },
      ...profile.searches.filter(s => s.q.toLowerCase() !== query.toLowerCase()),
    ].slice(0, MAX_SEARCHES);
  }

  profile.updated_at = now;
  write(profile);
}

/**
 * The shopper's taste profile, with every score decayed to "now".
 *
 * @returns {{
 *   topCategories: string[],
 *   priceBand: { min: number, max: number } | null,
 *   recentProductIds: string[],
 *   recentSearches: string[],
 *   hasSignal: boolean,
 * }}
 */
export function getTasteProfile() {
  const now = Date.now();
  const profile = read();

  const scored = Object.entries(profile.categories)
    .map(([category, { score, at }]) => ({ category, score: decay(score, at, now) }))
    .filter(c => c.score > 0.15) // drop signals that have effectively expired
    .sort((a, b) => b.score - a.score);

  // A price band from the middle of what they actually engage with, widened
  // generously — this nudges the ordering, it must never hide the catalogue.
  let priceBand = null;
  const prices = profile.prices.filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (prices.length >= 4) {
    const q1 = prices[Math.floor(prices.length * 0.25)];
    const q3 = prices[Math.floor(prices.length * 0.75)];
    priceBand = { min: Math.max(0, Math.round(q1 * 0.5)), max: Math.round(q3 * 2) };
  }

  return {
    topCategories: scored.slice(0, 5).map(c => c.category),
    priceBand,
    recentProductIds: profile.recentProducts.map(p => p.id),
    recentSearches: profile.searches.map(s => s.q),
    hasSignal: scored.length > 0 || prices.length > 0,
  };
}

/**
 * Orders a list of category descriptors so the ones the shopper actually
 * engages with sit first, while keeping the full set (and the pinned entries
 * a caller marks with `pinned`) exactly where the design expects them.
 */
export function orderByTaste(items, getKey) {
  const { topCategories } = getTasteProfile();
  if (topCategories.length === 0) return items;

  const rank = new Map(topCategories.map((c, i) => [c, i]));
  const pinned = items.filter(i => i.pinned);
  const rest = items.filter(i => !i.pinned);

  rest.sort((a, b) => {
    const ra = rank.has(getKey(a)) ? rank.get(getKey(a)) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(getKey(b)) ? rank.get(getKey(b)) : Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });

  return [...pinned, ...rest];
}

/**
 * Scores a product against the taste profile so mixed feeds can lead with the
 * items most likely to be relevant. Returns 0 for an unknown product rather
 * than excluding it — the feed stays complete, it just reorders.
 */
export function scoreProduct(product, profile = getTasteProfile()) {
  if (!product) return 0;
  let score = 0;

  const category = (product.category || "").toLowerCase();
  const categoryRank = profile.topCategories.indexOf(category);
  if (categoryRank >= 0) score += (profile.topCategories.length - categoryRank) * 2;

  if (profile.priceBand && Number.isFinite(product.price)) {
    if (product.price >= profile.priceBand.min && product.price <= profile.priceBand.max) score += 2;
  }

  const haystack = `${product.title || ""} ${(product.tags || []).join(" ")}`.toLowerCase();
  if (profile.recentSearches.some(q => haystack.includes(q.toLowerCase()))) score += 3;

  // Something already opened is the least interesting thing to show again.
  if (profile.recentProductIds.includes(String(product.id || product._id))) score -= 4;

  return score;
}

/** Sorts products by taste, leaving the server's ordering as the tiebreak. */
export function rankProducts(products = []) {
  const profile = getTasteProfile();
  if (!profile.hasSignal) return products;
  return products
    .map((p, i) => ({ p, i, s: scoreProduct(p, profile) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .map(x => x.p);
}
