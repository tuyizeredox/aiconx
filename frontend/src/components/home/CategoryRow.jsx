import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { MapPin, Sparkles, UserCheck, LayoutGrid } from "lucide-react";
import { createPageUrl } from "@/lib/utils";
import { orderByTaste, recordSignal } from "@/lib/personalization";

/**
 * The one filter row on the home screen.
 *
 * Kept deliberately short: the chips a shopper actually reaches for, in the
 * order their own behaviour suggests. Everything else (the full category
 * list, price filters, facets) lives behind "More", in Discover — putting it
 * here would turn the first screen into a settings page.
 *
 * Chip kinds:
 *   feed     - a way of ordering the social feed (For you / Following)
 *   nearby   - products from physical shops around the shopper
 *   category - a product category, shown as a clean grid
 */
export const FEED_CHIPS = [
  { id: "for_you", kind: "feed", tKey: "home.forYou", icon: Sparkles, pinned: true },
  { id: "nearby", kind: "nearby", tKey: "home.nearby", icon: MapPin, pinned: true },
  { id: "following", kind: "feed", tKey: "home.following", icon: UserCheck, pinned: true },
  { id: "fashion", kind: "category", tKey: "explore.cat.fashion", category: "fashion" },
  // "Shoes" isn't a category of its own in the catalogue, so it matches on
  // title/tags instead — shoppers think in products, not in our taxonomy.
  { id: "shoes", kind: "category", tKey: "home.cat.shoes", search: "shoes" },
  { id: "beauty", kind: "category", tKey: "explore.cat.beauty", category: "beauty" },
  { id: "electronics", kind: "category", tKey: "explore.cat.electronics", category: "electronics" },
];

export default function CategoryRow({ active, onChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scrollerRef = useRef(null);
  const activeRef = useRef(null);
  const [atEnd, setAtEnd] = useState(false);

  // The categories a shopper keeps opening drift toward the front of the row,
  // while the three pinned chips hold their position so the feed never moves
  // out from under them.
  const chips = useMemo(() => orderByTaste(FEED_CHIPS, (c) => c.category || c.id), []);

  // The right edge only fades while there is more row to reach — a permanent
  // fade would read as a rendering artefact once the row is fully scrolled.
  const syncEdge = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    syncEdge();
    window.addEventListener("resize", syncEdge);
    return () => window.removeEventListener("resize", syncEdge);
  }, [syncEdge, chips]);

  // Keep the selected chip in view — after a reorder, or when the row is
  // restored mid-scroll, the active chip should never be off-screen.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active?.id]);

  const select = (chip) => {
    if (chip.category || chip.search) {
      recordSignal("category", { category: chip.category || chip.id });
    }
    onChange(chip);
  };

  // The selected chip carries the brand colour rather than a black/white
  // inversion: it sits inside the app bar now, where inverting it would make
  // the chip read as a second surface instead of a selection.
  const chipClass = (isActive) =>
    "snap-start shrink-0 flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 " +
    (isActive
      ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm shadow-orange-500/30"
      : "bg-slate-100 text-slate-600 active:bg-slate-200 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-ink-300 dark:hover:bg-white/[0.1]");

  return (
    <div
      ref={scrollerRef}
      onScroll={syncEdge}
      className={`overflow-x-auto overscroll-x-contain hide-scrollbar snap-x ${atEnd ? "fade-edge-none" : "fade-edge-r"}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* The row is deliberately NOT bled to the screen edge: it shares the
          search bar's gutter above it, so both start and end on the same two
          vertical lines. A chip clipped mid-glyph at the edge of the display
          reads as a rendering fault; clipped at the gutter, with the fade, it
          reads as a row that continues. */}
      <div className="inline-flex items-center gap-2">
        {chips.map((chip) => {
          const isActive = active?.id === chip.id;
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              ref={isActive ? activeRef : null}
              onClick={() => select(chip)}
              aria-pressed={isActive}
              className={chipClass(isActive)}
            >
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              {t(chip.tKey)}
            </button>
          );
        })}

        <button onClick={() => navigate(createPageUrl("Explore"))} className={chipClass(false)}>
          <LayoutGrid className="w-4 h-4 shrink-0" />
          {t("home.more")}
        </button>
      </div>
    </div>
  );
}
