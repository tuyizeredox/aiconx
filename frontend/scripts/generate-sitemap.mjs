/**
 * Writes dist/sitemap.xml after the Vite build.
 *
 * The production site is served as static files, so there is no request-time
 * runtime to generate a sitemap on demand — but a sitemap listing only six
 * marketing pages leaves every product, post and store undiscoverable, since
 * nothing outside the app links to /productdetail?id=<ObjectId>. Building it
 * at deploy time gets the whole catalogue listed and refreshes it on every
 * deploy, which is the closest a static host gets to a live sitemap.
 *
 * Never fails the build: an unreachable backend falls back to the static
 * pages, so a deploy during a backend outage ships a thin sitemap rather than
 * no sitemap and a red build.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildSitemap } from '../src/lib/sitemap.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../dist/sitemap.xml');

const API_BASE = (process.env.SITEMAP_API_BASE || process.env.VITE_API_URL || 'https://aiconxbackend.onrender.com/api')
  .replace(/\/+$/, '');

// The backend may be cold at deploy time; worth waiting out a spin-up rather
// than shipping a sitemap missing the entire catalogue.
const TIMEOUT_MS = 60000;

async function fetchInventory() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/sitemap/urls`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      console.warn(`[sitemap] ${API_BASE}/sitemap/urls responded ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`[sitemap] could not reach ${API_BASE}: ${error.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const inventory = await fetchInventory();
const xml = buildSitemap(inventory);

await writeFile(OUT, xml, 'utf8');

const counts = inventory
  ? `${inventory.stores?.length || 0} stores, ${inventory.products?.length || 0} products, ${inventory.posts?.length || 0} posts`
  : 'static pages only (backend unreachable)';
console.log(`[sitemap] wrote ${OUT} — ${counts}`);
