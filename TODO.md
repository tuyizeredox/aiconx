# Landing Page Fixes

## Done
- ✅ Fixed `useBackLink` import in ProductDetail.jsx
- ✅ **Fix 1**: Hero headline no longer runs together as "Discover. Share.Shop. Sell.All in one place."
  (the three lines already rendered correctly — the defect was in the h1's *text content*, which is
  what search snippets, link previews, screen readers and copy-paste use)
- ✅ **Fix 2**: SEO title — already correct. `Seo.jsx` appends " — Aicon X" to every page title.
- ✅ **Fix 3**: Zero-value stats are dropped in Hero.jsx; when none have real numbers the card falls
  back to a feature strip (Share posts / Shop the feed / Open a free store / Join communities)
- ✅ **Fix 4**: Empty state in SocialFeed.jsx ("What's happening")
- ✅ **Fix 5**: Empty state in TrendingProducts.jsx ("Trending Today")
- ✅ **Fix 6**: `SiteFooter.jsx` — brand, platform/account/legal columns, support mailto, copyright
- ✅ **Fix 7**: Footer wired into LandingPage.jsx (MobileTabBar clearance moved onto it)
- ✅ Extra: same empty-state treatment for Popular Stores, Community Activity and the catalogue;
  the literal "0 products" counter is hidden until there is at least one

## Later changes
- ✅ Catalogue shows 10 products with a "Show N more" button instead of all 24
- ✅ Product cards link straight to `/productdetail` (already a public route) — guests reach a
  product without a sign-up wall; they only hit login at checkout
- ✅ "One app, two worlds" compacted to one line per step (desktop 330px → 119px)
- ✅ Removed the "What's happening" feed section and the "Community Activity" section
  - `SocialFeed.jsx` deleted (orphaned) — restore with
    `git checkout HEAD -- frontend/src/components/landing/SocialFeed.jsx`
  - `CommunitySection.jsx` is now just Popular Stores, full width
  - dead queries removed (landingFeedPosts, landingRecentProducts, landingRecentReviews) and the
    `landing.feed` / `landing.activity` translation blocks dropped from en + rw
  - `#feed` and `#community` anchors repointed to `#trending` / `#catalogue` in the header nav,
    hero CTA, MobileTabBar and footer — no dangling in-page anchors remain

## Open decisions
- **App store badges** — `SiteFooter.jsx` renders them from `VITE_PLAY_STORE_URL` /
  `VITE_APP_STORE_URL`. Neither is set, so no badge shows. Set `VITE_PLAY_STORE_URL` once the
  Android app (`com.aiconx.app`) is live on Play. There is no iOS project yet, so the App Store
  badge stays hidden until one exists.
  Badges are currently text+icon, not Google/Apple's official badge artwork — swap in the official
  assets (self-hosted, per their brand guidelines) before launch.
- **Support address** — footer uses `support@iqon.ai`, copied from Support.jsx, but the site is
  branded Aicon X on aiconx.net. Pick one and make it consistent.
- **Seeding content** — the empty states are honest placeholders. To make the page feel alive,
  post real content from accounts you control rather than fabricating users/posts/reviews;
  fake reviews in particular are illegal under the FTC's 2024 rule (and EU equivalents).
