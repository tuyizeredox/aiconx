import React, { useMemo } from "react";
import { productsAPI } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import { Sparkles, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import FeedProductTile from "./FeedProductTile";
import { rankProducts, getTasteProfile } from "@/lib/personalization";

/**
 * The feed's "picked for you" rail.
 *
 * Signed-in shoppers get the server's recommendations; everyone else gets
 * what is actually selling. Both are then re-ordered against the taste
 * signals collected on this device, which is what makes the rail useful on a
 * first visit — before the account has any history to recommend from.
 */
export default function RecommendedSection({ currentUser }) {
  const { t } = useTranslation();
  const signedIn = !!currentUser?.username;

  const { data: response, isLoading } = useQuery({
    queryKey: ["recommendedProducts", currentUser?.username || "guest"],
    queryFn: () => (signedIn
      ? productsAPI.getRecommendations(16)
      : productsAPI.list({ status: "active", sort: "-sales_count", limit: 16 })),
    staleTime: 5 * 60 * 1000,
  });

  const products = useMemo(
    () => rankProducts(response?.data || []).slice(0, 10),
    [response]
  );

  const personalized = signedIn || getTasteProfile().hasSignal;

  if (products.length === 0 && !isLoading) return null;

  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3">
        <h2 className="text-[17px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Sparkles className="w-[18px] h-[18px] text-orange-500" />
          {personalized ? t("home.recommendedForYou") : t("home.popularNow")}
        </h2>
        <Link
          to={createPageUrl("Marketplace")}
          className="shrink-0 text-[13px] font-semibold text-slate-500 dark:text-ink-400 flex items-center"
        >
          {t("home.seeAll")} <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Contained to the same gutter as everything else on the screen rather
          than bled to the display edge — one set of vertical lines down the
          whole feed. */}
      <div className="overflow-x-auto overscroll-x-contain hide-scrollbar snap-x">
        <div className="inline-flex gap-3">
          {isLoading
            ? Array(4).fill(0).map((_, i) => (
                <div key={"rec-sk-" + i} className="w-40 shrink-0"><ProductSkeleton /></div>
              ))
            : products.map((product) => (
                <FeedProductTile key={product.id || product._id} product={product} />
              ))}
        </div>
      </div>
    </section>
  );
}
