import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Store as StoreIcon, BadgeCheck, MapPin, ChevronRight } from "lucide-react";
import { createPageUrl, storeUrl, formatCurrency } from "@/lib/utils";
import { recordSignal } from "@/lib/personalization";
import FeedProductTile from "./FeedProductTile";

/**
 * A shop appearing in the feed the same way a person does.
 *
 * The card adapts to what the shop actually has to show: a single new item
 * gets the full treatment (large image, price, availability, one obvious
 * "View Product"), while several become a rail of tiles with the shop page as
 * the follow-through. Either way there is exactly one primary action.
 */
export default function BusinessProductPost({ store, storeName, products = [], distanceKm = null }) {
  const { t } = useTranslation();
  if (products.length === 0) return null;

  const name = store?.name || storeName || t("home.shopLabel");
  const shopHref = store ? storeUrl(store) : createPageUrl("Marketplace");
  const isSingle = products.length === 1;

  const Header = (
    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
      <Link to={shopHref} className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-ink-800 shrink-0 flex items-center justify-center">
        {store?.logo_url
          ? <img src={store.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <StoreIcon className="w-5 h-5 text-slate-400" />}
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={shopHref} className="flex items-center gap-1 min-w-0">
          <span className="text-[14px] font-bold text-slate-900 dark:text-white truncate">{name}</span>
          {store?.is_verified && <BadgeCheck className="w-4 h-4 text-orange-500 shrink-0" />}
        </Link>
        <p className="text-[12px] text-slate-500 dark:text-ink-400 truncate">
          {t("home.newArrivals")}
          {distanceKm != null && (
            <span> · <MapPin className="inline w-3 h-3 -mt-0.5" /> {t("home.kmAway", { km: distanceKm })}</span>
          )}
        </p>
      </div>
    </div>
  );

  if (isSingle) {
    const p = products[0];
    const id = p.id || p._id;
    const soldOut = p.status === "sold_out" || p.inventory_count === 0;
    const track = () => recordSignal("view", { id, category: p.category, price: p.price, store_id: p.store_id });

    return (
      <article className="bg-white dark:bg-ink-900 rounded-2xl border border-slate-100 dark:border-ink-800 overflow-hidden">
        {Header}
        <Link to={createPageUrl("ProductDetail") + "?id=" + id} onClick={track} className="block">
          <div className="relative aspect-[4/5] bg-slate-100 dark:bg-ink-800">
            <img
              src={p.images?.[0] || "https://placehold.co/800x1000/f1f5f9/94a3b8?text=+"}
              alt={p.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        </Link>

        <div className="p-4">
          <Link to={createPageUrl("ProductDetail") + "?id=" + id} onClick={track} className="block">
            <p className="text-[15px] font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">{p.title}</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(p.price)}</span>
              {p.compare_at_price > p.price && (
                <span className="text-sm text-slate-400 line-through">{formatCurrency(p.compare_at_price)}</span>
              )}
            </div>
            <p className={`text-[12px] mt-1 ${soldOut ? "text-slate-400 dark:text-ink-500" : "text-green-600 dark:text-green-500"}`}>
              {soldOut ? t("product.outOfStock") : t("product.inStock")}
            </p>
          </Link>

          <Link
            to={createPageUrl("ProductDetail") + "?id=" + id}
            onClick={track}
            className="mt-4 flex items-center justify-center h-12 rounded-2xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 text-[15px] font-bold hover:opacity-90 transition-opacity"
          >
            {t("home.viewProduct")}
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="bg-white dark:bg-ink-900 rounded-2xl border border-slate-100 dark:border-ink-800 overflow-hidden">
      {Header}
      <div className="px-4">
        <div className="overflow-x-auto overscroll-x-contain hide-scrollbar snap-x">
          <div className="inline-flex gap-3 pb-1">
            {products.slice(0, 8).map((p) => (
              <FeedProductTile key={p.id || p._id} product={p} distanceKm={distanceKm} showShop={false} />
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 pt-3">
        <Link
          to={shopHref}
          className="flex items-center justify-center gap-1 h-11 rounded-2xl bg-slate-100 dark:bg-ink-800 text-slate-900 dark:text-white text-[14px] font-bold hover:bg-slate-200 dark:hover:bg-ink-700 transition-colors"
        >
          {t("home.viewShop", { name })}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}
