import React from "react";
import { productsAPI } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "@/components/shared/ProductCard";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import { Sparkles, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function RecommendedSection({ currentUser }) {
  const { t } = useTranslation();
  const { data: recommendedResponse, isLoading } = useQuery({
    queryKey: ["recommendedProducts", currentUser?.username],
    queryFn: () => productsAPI.getRecommendations(8),
    enabled: !!currentUser?.username,
    staleTime: 300000, // 5 minutes
  });

  const products = recommendedResponse?.data || [];

  if (!currentUser || (products.length === 0 && !isLoading)) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          {t("home.recommendedForYou")}
        </h2>
        <Link to={createPageUrl("Marketplace")} className="text-xs text-orange-600 font-medium flex items-center gap-0.5">
          {t("home.seeAll")} <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="overflow-x-auto -mx-4 px-4 hide-scrollbar">
        <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
{isLoading
             ? Array(4).fill(0).map((_, i) => <div key={`rec-skeleton-${i}`} className="w-44 shrink-0"><ProductSkeleton /></div>)
             : products.slice(0, 8).map((product, idx) => (
               <div key={product.id || product._id || `rec-${idx}`} className="w-44 shrink-0">
                 <ProductCard product={product} compact currentUser={currentUser} />
               </div>
             ))}
        </div>
      </div>
    </div>
  );
}