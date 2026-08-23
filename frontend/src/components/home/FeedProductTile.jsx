import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import { recordSignal } from "@/lib/personalization";
import { estimateEarnings } from "@/lib/affiliate";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import EarnBadge from "@/components/shared/EarnBadge";
import { useAuth } from "@/lib/AuthContext";

/**
 * A product as it appears inside the feed.
 *
 * The whole tile is the tap target and it goes straight to the product page —
 * Feed → Product → Buy. No hover toolbar, no badges beyond a discount, no
 * secondary buttons: in a feed the only decision worth offering is "do I want
 * to look at this?".
 *
 * `distanceKm` is rendered only when the shopper has shared their location and
 * the shop actually published coordinates, so the line never appears empty.
 */
export default function FeedProductTile({ product, distanceKm = null, width = "w-40", showShop = true }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { isSubscriptionEnforced } = usePlatformSettings();
  if (!product) return null;

  const earnings = estimateEarnings(product, {
    subscriptionEnforced: isSubscriptionEnforced,
    viewerUsername: currentUser?.username,
  });

  const id = product.id || product._id;
  const soldOut = product.status === "sold_out" || product.inventory_count === 0;
  const discount = product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;

  return (
    <Link
      to={createPageUrl("ProductDetail") + "?id=" + id}
      onClick={() => recordSignal("view", {
        id,
        category: product.category,
        price: product.price,
        store_id: product.store_id,
      })}
      className={`group block shrink-0 snap-start ${width}`}
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img
          src={product.images?.[0] || "https://placehold.co/600x600/f1f5f9/94a3b8?text=+"}
          alt={product.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {discount > 0 && !soldOut && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-red-500 text-white text-[11px] font-bold">
            -{discount}%
          </span>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-slate-900/45 flex items-center justify-center">
            <span className="text-white text-[11px] font-bold uppercase tracking-wide">
              {t("product.outOfStock")}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2.5">
        <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100 leading-snug line-clamp-1">
          {product.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <p className="text-[15px] font-bold text-slate-900 dark:text-white">
            {formatCurrency(product.price)}
          </p>
          <EarnBadge amount={earnings?.amount} />
        </div>
        {showShop && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {product.store_name || t("home.shopLabel")}
            {distanceKm != null && (
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {" · "}
                <MapPin className="inline w-3 h-3 -mt-0.5" /> {t("home.kmAway", { km: distanceKm })}
              </span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}
