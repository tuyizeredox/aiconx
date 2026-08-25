import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, ImagePlay, ShoppingBag, Store, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authLink } from "./authLink";

const AVATARS = [
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=100&h=100&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=100&h=100&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=100&h=100&fit=crop&q=80",
  "https://images.unsplash.com/photo-1611432579699-484f7990b127?w=100&h=100&fit=crop&q=80",
];

// Tailwind can't compile a class name built at runtime, so the column counts are
// spelled out for the JIT compiler to pick up.
const GRID_COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

export default function Hero({ stats, avgRating }) {
  const { t } = useTranslation();

  // A counter reading "0 Posts Shared" reads as a dead platform rather than a new
  // one, so empty totals are dropped. If nothing has a real number behind it yet,
  // the card falls back to what the platform *does* rather than inventing figures.
  const statItems = [
    { icon: ImagePlay, value: stats.postsTotal, label: t("landing.hero.statPosts") },
    { icon: ShoppingBag, value: stats.productsTotal, label: t("landing.hero.statProducts") },
    { icon: Store, value: stats.storesTotal, label: t("landing.hero.statStores") },
    { icon: Star, value: stats.reviewsTotal, label: t("landing.hero.statReviews") },
  ].filter((s) => s.value > 0);

  const featureItems = [
    { icon: ImagePlay, label: t("landing.hero.featurePost") },
    { icon: ShoppingBag, label: t("landing.hero.featureShop") },
    { icon: Store, label: t("landing.hero.featureSell") },
    { icon: Users, label: t("landing.hero.featureCommunity") },
  ];

  const showStats = statItems.length > 0;
  const cardItems = showStats ? statItems : featureItems;

  return (
    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-orange-50 via-white to-orange-50/60 dark:from-ink-900 dark:via-ink-950 dark:to-ink-900 border border-orange-100/80 dark:border-ink-800 pb-5 sm:pb-8 lg:pb-10">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center p-5 sm:p-10 lg:p-14">
        {/* Left: copy */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wide mb-5">
            <Store className="w-3.5 h-3.5" />
            {t("landing.hero.badge")}
          </div>

          {/* The lines are separate blocks, so the spaces below collapse visually but
              keep the h1's text content readable as one sentence — that string is what
              search snippets, link previews, screen readers and copy-paste all use, and
              without them it runs together as "Discover. Share.Shop. Sell.All in one place." */}
          <h1 className="text-[2.1rem] leading-[1.1] sm:text-[2.9rem] sm:leading-[1.06] lg:text-[3.2rem] font-black tracking-tight mb-4">
            <span className="text-slate-900 dark:text-white block">{t("landing.hero.titleLine1")}</span>{" "}
            <span className="text-orange-500 block">{t("landing.hero.titleLine2")}</span>{" "}
            <span className="text-slate-400 dark:text-ink-500 block text-[1.35rem] sm:text-[1.8rem] lg:text-[2rem] mt-1">
              {t("landing.hero.titleLine3")}
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-ink-400 max-w-md mb-7">
            {t("landing.hero.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-8">
            <Link {...authLink("/")} className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-12 px-6 gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform">
                {t("landing.hero.ctaJoin")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#trending" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-12 px-6 font-bold rounded-xl border-2 border-slate-200 dark:border-ink-700 text-slate-900 dark:text-white hover:border-orange-400 hover:text-orange-600 active:scale-[0.98] transition-transform"
              >
                {t("landing.hero.ctaShop")}
              </Button>
            </a>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex -space-x-3 shrink-0">
              {AVATARS.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-white dark:ring-ink-950"
                />
              ))}
            </div>
            <div>
              {avgRating > 0 && (
                <div className="flex items-center gap-0.5 mb-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-ink-700"}`}
                    />
                  ))}
                  <span className="text-xs font-bold text-slate-700 dark:text-ink-300 ml-1">{avgRating.toFixed(1)}</span>
                </div>
              )}
              <p className="text-xs font-medium text-slate-500 dark:text-ink-400">{t("landing.hero.trustFallback")}</p>
            </div>
          </div>
        </div>

        {/* Right: image + floating stats */}
        <div className="relative">
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden aspect-[4/3] lg:aspect-square shadow-xl shadow-slate-900/10 dark:shadow-black/40">
            <img
              src="https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=1200&q=80"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>

          {/* Sits under the image on mobile so it never covers the photo; floats over it on desktop. */}
          <div
            className={`mt-3 lg:mt-0 lg:absolute lg:left-6 lg:right-6 lg:-bottom-8 bg-white dark:bg-ink-900 rounded-2xl shadow-xl border border-slate-100 dark:border-ink-800 p-3 sm:p-4 grid ${GRID_COLS[cardItems.length]} gap-1.5 sm:gap-3`}
          >
            {cardItems.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <Icon className="w-4 h-4" />
                </div>
                {showStats && (
                  <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-none">
                    {value.toLocaleString()}
                  </p>
                )}
                <p
                  className={`text-[10px] leading-tight font-semibold ${
                    showStats ? "text-slate-500 dark:text-ink-400" : "text-slate-700 dark:text-ink-300"
                  }`}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
