/**
 * End-to-end check of the storefront draft round trip.
 *
 * Start the API first (`npm run dev`), then: npx tsx verify-storefront-draft.ts
 *
 * Creates a throwaway store + pro subscription, drives the real HTTP endpoints
 * with a signed token, and deletes everything in `finally`.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { Store } from './src/models/Store';
import { VendorSubscription } from './src/models/VendorSubscription';

const API = process.env.VERIFY_API_URL || 'http://localhost:4000/api';
const USERNAME = `zz_drafttest_${Date.now()}`;

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ok    ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail !== undefined ? `  -> ${JSON.stringify(detail)}` : ''}`); }
}

const block = (type: string, data: Record<string, unknown>) => ({
  id: randomUUID(), type, visible: true, style: {}, data: { type, ...data },
});

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const token = jwt.sign(
    { userId: new mongoose.Types.ObjectId().toString(), email: `${USERNAME}@example.test`, username: USERNAME, role: 'user' },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );

  const store = await Store.create({
    name: 'Draft Verification Store',
    owner_username: USERNAME,
    owner_name: 'Draft Tester',
    category: 'electronics',
    status: 'active',
  });
  const storeId = store._id.toString();
  await VendorSubscription.create({ vendor_username: USERNAME, plan: 'pro', status: 'active', expires_at: null });

  const authed = (body: unknown) => ({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  try {
    // --- 1. Autosave writes a draft, leaving the live config untouched -------
    const draft = {
      theme: { primary_color: '#0ea5e9' },
      blocks: [block('hero', { headline: 'Smartphones, unlocked', height: 'tall' })],
      generated_by_ai: true,
    };
    const saveRes = await fetch(`${API}/stores/${storeId}`, authed({ storefront_draft: draft }));
    check('PATCH storefront_draft accepted', saveRes.status === 200, saveRes.status);

    let doc = await Store.findById(storeId).lean();
    check('draft persisted', doc?.storefront_draft?.blocks?.length === 1, doc?.storefront_draft);
    check('draft is stamped with updated_at', !!doc?.storefront_draft?.updated_at);
    check('draft marked as AI-generated', doc?.storefront_draft?.generated_by_ai === true);
    check('live storefront_config untouched', doc?.storefront_config === undefined, doc?.storefront_config);

    // --- 2. The draft is the owner's alone ----------------------------------
    const ownerView = await (await fetch(`${API}/stores/${storeId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    check('owner sees their draft', !!ownerView?.storefront_draft, Object.keys(ownerView || {}).includes('storefront_draft'));

    for (const [label, url] of [
      ['GET /stores/:id', `${API}/stores/${storeId}`],
      ['GET /stores/owner/username/:username', `${API}/stores/owner/username/${USERNAME}`],
      ['GET /stores/owner/:identifier', `${API}/stores/owner/${USERNAME}`],
    ] as const) {
      const anon = await (await fetch(url)).json();
      check(`${label} hides the draft from the public`, anon?.storefront_draft === undefined, anon?.storefront_draft);
    }

    // --- 3. Invalid drafts are rejected -------------------------------------
    const badColor = await fetch(`${API}/stores/${storeId}`, authed({ storefront_draft: { ...draft, theme: { primary_color: '#ea5' } } }));
    check('partial hex colour rejected', badColor.status === 400, badColor.status);
    const badBlock = await fetch(`${API}/stores/${storeId}`, authed({ storefront_draft: { blocks: [block('hero', { bogus_field: 1 })] } }));
    check('unknown block field rejected', badBlock.status === 400, badBlock.status);

    // --- 4. Relative CTA links are stripped from drafts too -----------------
    await fetch(`${API}/stores/${storeId}`, authed({
      storefront_draft: { blocks: [block('hero', { headline: 'Hi', cta_link: '/shop' })] },
    }));
    doc = await Store.findById(storeId).lean();
    check('relative cta_link sanitized in draft', doc?.storefront_draft?.blocks?.[0]?.data?.cta_link === '', doc?.storefront_draft?.blocks?.[0]?.data);

    // Put the good draft back for the publish step.
    await fetch(`${API}/stores/${storeId}`, authed({ storefront_draft: draft }));

    // --- 5. Publishing promotes the draft and clears it ---------------------
    const publishRes = await fetch(`${API}/stores/${storeId}`, authed({
      storefront_config: { enabled: true, theme: draft.theme, blocks: draft.blocks },
      storefront_draft: null,
    }));
    check('publish accepted', publishRes.status === 200, publishRes.status);

    doc = await Store.findById(storeId).lean();
    check('published config written', doc?.storefront_config?.enabled === true && doc?.storefront_config?.blocks?.length === 1);
    check('draft cleared on publish ($unset on a Mixed path)', doc?.storefront_draft === undefined, doc?.storefront_draft);

    // --- 6. A draft on top of a published storefront stays unpublished ------
    await fetch(`${API}/stores/${storeId}`, authed({
      storefront_draft: { blocks: [block('hero', { headline: 'Reworked headline' })] },
    }));
    doc = await Store.findById(storeId).lean();
    check('live layout unchanged while drafting', doc?.storefront_config?.blocks?.[0]?.data?.headline === 'Smartphones, unlocked', doc?.storefront_config?.blocks?.[0]?.data);
    check('new draft stored alongside it', doc?.storefront_draft?.blocks?.[0]?.data?.headline === 'Reworked headline');

    // --- 7. Discarding a draft leaves the published layout alone ------------
    await fetch(`${API}/stores/${storeId}`, authed({ storefront_draft: null }));
    doc = await Store.findById(storeId).lean();
    check('draft discarded', doc?.storefront_draft === undefined);
    check('published layout survived the discard', doc?.storefront_config?.blocks?.length === 1);

    // --- 8. Draft saves are gated by plan exactly like publishing -----------
    // Only meaningful when the platform has subscription_mode on; with it off
    // every vendor is treated as elite, so the gate is expected to pass through.
    await VendorSubscription.deleteMany({ vendor_username: USERNAME });
    const settings = await mongoose.connection.collection('settings').findOne({});
    const subscriptionMode = !!settings?.subscription_mode;

    const freeDraft = await fetch(`${API}/stores/${storeId}`, authed({ storefront_draft: draft }));
    check(
      subscriptionMode
        ? 'free plan blocked from saving a draft'
        : 'draft save allowed (subscription_mode off — all vendors are elite)',
      freeDraft.status === (subscriptionMode ? 403 : 200),
      freeDraft.status
    );
    // Discarding must never be blocked, so a downgraded vendor can still clean up.
    const freeDiscard = await fetch(`${API}/stores/${storeId}`, authed({ storefront_draft: null }));
    check('discard allowed regardless of plan', freeDiscard.status === 200, freeDiscard.status);
  } finally {
    await Store.deleteOne({ _id: storeId });
    await VendorSubscription.deleteMany({ vendor_username: USERNAME });
    await mongoose.disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
