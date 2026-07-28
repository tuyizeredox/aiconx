import React from "react";
import { productsAPI } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "@/components/shared/ProductCard";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import { useTranslation } from "react-i18next";
import { Zap } from "lucide-react";

export default function SimilarProducts({ product }) {
  const { t } = useTranslation();
  const { data: similar = [], isLoading } = useQuery({
    queryKey: ["similarProducts", product?.id, product?.category],
    queryFn: async () => {
      const res = await productsAPI.list({ category: product.category, status: "active", limit: 10, order: "desc", orderBy: "sales_count" });
      return res.data || [];
    },
    enabled: !!product?.category,
    staleTime: 120000,
    select: (data) => data.filter(p => (p.id || p._id) !== (product?.id || product?._id)).slice(0, 6),
  });

  const { data: sameStore = [] } = useQuery({
    queryKey: ["sameStoreProducts", product?.store_id],
    queryFn: async () => {
      const res = await productsAPI.list({ store_id: product.store_id, status: "active", limit: 8, order: "desc", orderBy: "sales_count" });
      return res.data || [];
    },
    enabled: !!product?.store_id,
    staleTime: 120000,
    select: (data) => data.filter(p => (p.id || p._id) !== (product?.id || product?._id)).slice(0, 4),
  });

  const combined = React.useMemo(() => {
    const seen = new Set();
    return [...similar, ...sameStore].filter(p => {
      const pid = p.id || p._id;
      if (!pid || seen.has(pid)) return false;
      seen.add(pid);
      return true;
    }).slice(0, 6);
  }, [similar, sameStore]);

  if (!isLoading && combined.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-amber-500 shrink-0" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">{t("product.youMightAlsoLike")}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        {isLoading
          ? Array(6).fill(0).map((_, i) => <ProductSkeleton key={`skeleton-${i}`} />)
          : combined.map(p => <ProductCard key={p.id || p._id} product={p} compact />)
        }
      </div>
    </div>
  );
}
