/**
 * Manual check: does the image sourcing return photos that match the product?
 * Run with: npx tsx verify-images.ts   (from backend/)
 */
import { searchProductImages, searchStockImages, inferSubject, placeholderImage } from './src/services/imageSearchService';

// Titles chosen to exercise the tricky cases: exact model names, brand-free
// marketing names, and words that used to false-positive by substring.
const SUBJECT_CASES: Array<[string, string, string]> = [
  ['Samsung Galaxy S23 Ultra', 'electronics', 'smartphone'],
  ['Galaxy Tab S9 FE', 'electronics', 'tablet computer'],
  ['Apple Watch Series 9', 'electronics', 'smartwatch'],
  ['Handwoven Agaseke Basket', 'handmade', 'woven basket craft'],
  ['Roasted Potatoes Seasoning 200g', 'food', 'spices seasoning'],
  ['Gold Hoop Earrings', 'fashion', 'jewelry necklace'],
  ['Electric Oven 45L', 'home', 'microwave oven'],
  ['Queen Size Bed Frame', 'home', 'bed bedroom'],
  ['Silk Scarf', 'fashion', 'scarf'],
  ['Mystery Novel Paperback', 'books', 'stacked books'],
];

const PRODUCT_CASES: Array<[string, string]> = [
  ['Samsung Galaxy S23 Ultra', 'electronics'],
  ['Apple iPhone 14 Pro Max', 'electronics'],
  ['OPPO Find X6 Pro', 'electronics'],
  ['Kigali Sunrise Arabica Coffee Beans 500g', 'food'],
  ['Amara Silk Wrap Dress', 'fashion'],
  ['Handwoven Agaseke Basket', 'handmade'],
];

async function main() {
  let failures = 0;
  console.log('=== subject inference ===');
  for (const [title, category, expected] of SUBJECT_CASES) {
    const actual = inferSubject(title, category);
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${title.padEnd(34)} -> ${actual}${ok ? '' : `   (expected ${expected})`}`);
  }

  console.log('\n=== product photo search ===');
  const started = Date.now();
  const results = await Promise.all(PRODUCT_CASES.map(([t, c]) => searchProductImages(t, c)));
  PRODUCT_CASES.forEach(([title, category], i) => {
    const urls = results[i];
    console.log(`\n${title}  [${category}] -> ${inferSubject(title, category)}`);
    if (urls[0].startsWith('data:')) console.log('    PLACEHOLDER ONLY');
    urls.slice(0, 3).forEach((u) => console.log(`    ${u.startsWith('data:') ? '[placeholder]' : u.slice(0, 105)}`));
  });
  console.log(`\n  ${PRODUCT_CASES.length} products sourced in parallel in ${Date.now() - started}ms`);

  console.log('\n=== storefront hero for "build a smartphone store" ===');
  const hint = inferSubject('build a smartphone store', 'electronics') || undefined;
  const hero = await searchStockImages('Tuyi Phones', 1, 'electronics', hint);
  console.log(`  hint=${hint}  ->  ${hero[0]?.slice(0, 105)}`);

  const ph = placeholderImage('Samsung Galaxy S23 Ultra', 'electronics');
  console.log(`\nplaceholder length: ${ph.length} chars (schema cap 2000)`);
  console.log(failures === 0 ? '\nAll subject assertions passed.' : `\n${failures} subject assertion(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
