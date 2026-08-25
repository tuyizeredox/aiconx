import axios from 'axios';

/**
 * Coarse IP -> coordinates lookup, used as the *fallback* for a store whose
 * owner never dropped a map pin.
 *
 * This is city-level data. Providers resolve an address to the registrant's
 * exchange or the ISP's regional PoP, which in practice lands anywhere from a
 * few hundred metres to tens of kilometres from the person holding the phone,
 * and a VPN or a mobile carrier's national gateway can put it in the wrong
 * city entirely. Everything it returns is therefore stamped with
 * `accuracy_km`, and callers are expected to present it as an approximate
 * area rather than as an address. A vendor-supplied pin always wins.
 */

export interface IpLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  /** Radius, in km, within which the real location plausibly sits. */
  accuracy_km: number;
}

// `{ip}` is substituted with the address being looked up. The default needs no
// API key and speaks HTTPS; the parser below is deliberately tolerant so this
// can be pointed at ip-api, ipapi.co or ipinfo without a code change.
const PROVIDER_URL = process.env.GEOIP_PROVIDER_URL || 'https://ipwho.is/{ip}';

// Providers don't report a confidence radius, so this is the honest stand-in:
// the distance within which a city-level answer is usually right.
const DEFAULT_ACCURACY_KM = Number(process.env.GEOIP_ACCURACY_KM) || 25;

const REQUEST_TIMEOUT_MS = 4000;

// Two vendors signing up from the same office shouldn't cost two lookups, and
// free tiers are rate limited per minute. Failures are cached too, briefly, so
// an outage can't turn every store save into a 4-second stall.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

const cache = new Map<string, { value: IpLocation | null; expires: number }>();

function cacheGet(ip: string): { value: IpLocation | null } | undefined {
  const hit = cache.get(ip);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(ip);
    return undefined;
  }
  return hit;
}

function cacheSet(ip: string, value: IpLocation | null) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Map iterates in insertion order, so the first key is the oldest.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(ip, { value, expires: Date.now() + (value ? CACHE_TTL_MS : FAILURE_TTL_MS) });
}

/**
 * Strips the IPv4-mapped IPv6 form (`::ffff:196.12.0.1`) that Node hands back
 * on dual-stack sockets, and drops any zone index or port.
 */
export function normalizeIp(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let ip = raw.trim();
  if (!ip) return null;
  if (ip.startsWith('[')) ip = ip.slice(1, ip.indexOf(']') > 0 ? ip.indexOf(']') : undefined);
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) ip = mapped[1];
  const zone = ip.indexOf('%');
  if (zone > 0) ip = ip.slice(0, zone);
  return ip || null;
}

/**
 * Addresses that no geolocation provider can say anything useful about: a
 * developer on localhost, a container on a bridge network, a phone on the
 * office LAN reaching a server on the same LAN, or a carrier-grade NAT range.
 */
export function isPublicIp(raw?: string | null): boolean {
  const ip = normalizeIp(raw);
  if (!ip) return false;

  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = v4.slice(1).map(Number);
    if (v4.slice(1).some((part) => Number(part) > 255)) return false;
    if (a === 0 || a === 10 || a === 127) return false;             // this-network, private, loopback
    if (a === 169 && b === 254) return false;                        // link-local
    if (a === 172 && b >= 16 && b <= 31) return false;               // private
    if (a === 192 && b === 168) return false;                        // private
    if (a === 100 && b >= 64 && b <= 127) return false;              // carrier-grade NAT
    if (a === 192 && b === 0) return false;                          // IETF protocol assignments
    if (a === 198 && (b === 18 || b === 19)) return false;           // benchmarking
    if (a >= 224) return false;                                      // multicast and reserved
    return true;
  }

  // IPv6: loopback, unspecified, unique-local (fc00::/7) and link-local
  // (fe80::/10) are all unresolvable.
  const lower = ip.toLowerCase();
  if (!lower.includes(':')) return false;
  if (lower === '::1' || lower === '::') return false;
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return false;
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return false;
  return true;
}

const num = (value: any): number | null => {
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};

/**
 * Pulls coordinates out of whichever provider is configured. The major free
 * services all use slightly different key names, and several answer failures
 * with HTTP 200 and a `success: false` body rather than an error status.
 */
function parseProviderResponse(data: any): IpLocation | null {
  if (!data || typeof data !== 'object') return null;
  if (data.success === false || data.status === 'fail' || data.error) return null;

  let lat = num(data.latitude ?? data.lat);
  let lng = num(data.longitude ?? data.lon ?? data.lng);

  // ipinfo.io returns a single "loc": "-1.9536,30.0606" field.
  if ((lat === null || lng === null) && typeof data.loc === 'string') {
    const [rawLat, rawLng] = data.loc.split(',');
    lat = num(rawLat);
    lng = num(rawLng);
  }

  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // 0,0 is in the Gulf of Guinea and is what several providers return in place
  // of "unknown".
  if (lat === 0 && lng === 0) return null;

  const city = typeof data.city === 'string' && data.city.trim() ? data.city.trim() : undefined;
  const countryRaw = data.country_name ?? data.country;
  const country = typeof countryRaw === 'string' && countryRaw.trim() ? countryRaw.trim() : undefined;

  return {
    lat,
    lng,
    city,
    country,
    accuracy_km: num(data.accuracy_radius) ?? DEFAULT_ACCURACY_KM,
  };
}

/**
 * Best-effort lookup. Never throws and never rejects: a store save must not
 * fail because a third-party geolocation service was slow or down, so every
 * failure path returns null and the store simply keeps whatever location it
 * already had.
 */
export async function locateIp(rawIp?: string | null, log?: { warn: Function; debug?: Function }): Promise<IpLocation | null> {
  const ip = normalizeIp(rawIp);
  if (!ip || !isPublicIp(ip)) return null;

  const cached = cacheGet(ip);
  if (cached) return cached.value;

  try {
    const url = PROVIDER_URL.includes('{ip}')
      ? PROVIDER_URL.replace('{ip}', encodeURIComponent(ip))
      : `${PROVIDER_URL.replace(/\/$/, '')}/${encodeURIComponent(ip)}`;

    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        Accept: 'application/json',
        ...(process.env.GEOIP_API_KEY ? { Authorization: `Bearer ${process.env.GEOIP_API_KEY}` } : {}),
      },
      // A provider answering 404 for an unknown address is a normal outcome,
      // not an exception to unwind.
      validateStatus: (status) => status < 500,
    });

    const location = parseProviderResponse(response.data);
    cacheSet(ip, location);
    return location;
  } catch (error: any) {
    log?.warn?.({ err: error?.message }, 'geoip lookup failed');
    cacheSet(ip, null);
    return null;
  }
}
