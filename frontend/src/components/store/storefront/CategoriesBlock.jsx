import React from "react";
import { useTranslation } from "react-i18next";

export default function CategoriesBlock({ block, products = [] }) {
  const { t } = useTranslation();
  const data = block?.data || {};
  const { title } = data;

  const categories = React.useMemo(() => {
    const counts = new Map();
    products.forEach((p) => {
      if (!p.category) return;
      counts.set(p.category, (counts.get(p.category) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [products]);

  if (!categories.length) return null;

  return (
    <div className="w-full">
      {title && (
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6">{title}</h2>
      )}
      <div className="flex flex-wrap gap-3">
        {categories.map((c) => (
          <div
            key={c.name}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold capitalize text-slate-700 dark:text-slate-200"
          >
            {t(`explore.cat.${c.name}`, c.name)}
            <span className="ml-1.5 text-slate-400 dark:text-slate-500 font-normal">({c.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
