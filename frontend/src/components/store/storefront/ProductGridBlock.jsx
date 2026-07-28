import React from "react";
import { useTranslation } from "react-i18next";
import ProductCard from "@/components/shared/ProductCard";

const COLUMN_CLASSES = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

export default function ProductGridBlock({ block, products = [], currentUser }) {
  const { t } = useTranslation();
  const data = block?.data || {};
  const { title, mode = "newest", product_ids = [], category, columns = "4" } = data;

  let items = products;
  if (mode === "curated" && product_ids.length) {
    const byId = new Map(products.map((p) => [String(p.id || p._id), p]));
    items = product_ids.map((id) => byId.get(String(id))).filter(Boolean);
  } else if (mode === "category" && category) {
    items = products.filter((p) => p.category === category);
  } else if (mode === "best_selling") {
    items = [...products].sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
  } else {
    items = [...products].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  items = items.slice(0, 12);

  return (
    <div className="w-full">
      {title && (
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6">{title}</h2>
      )}
      {items.length ? (
        <div className={`grid ${COLUMN_CLASSES[columns] || COLUMN_CLASSES[4]} gap-3 lg:gap-4`}>
          {items.map((p, idx) => (
            <ProductCard key={p.id || p._id || `sfp-${idx}`} product={p} currentUser={currentUser} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          {t("storeDetail.noProductsYet")}
        </div>
      )}
    </div>
  );
}
