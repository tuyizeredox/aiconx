// Remembers where the visitor just came from, inside the app.
//
// The standalone shop pages (product, store, cart) render outside the sidebar
// layout, so their header's back arrow is the only way out — and sending it to
// the marketplace every time throws away the visitor's place when they arrived
// from a store page, the feed or search results. The History API can't be read
// backwards, so the previous entry is recorded here as navigation happens.
//
// Module scope, not sessionStorage: this only ever describes the current tab's
// live history stack, which a reload resets anyway.

let previousEntry = null;
let currentEntry = null;

const asEntry = (location) => ({
  pathname: location.pathname,
  search: location.search || "",
  key: `${location.pathname}${location.search || ""}`,
});

// Called on every location change (see ScrollToTop, which already runs there).
export function recordNavigation(location) {
  const entry = asEntry(location);
  if (currentEntry?.key === entry.key) return; // re-render, not a navigation
  previousEntry = currentEntry;
  currentEntry = entry;
}

// The entry immediately before the current one, or null on a fresh page load
// (deep link, shared link, new tab) where there is nowhere in-app to go back to.
export function getPreviousEntry() {
  return previousEntry;
}
