import React from "react";
import { useTranslation } from "react-i18next";
import { X, MapPin } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/**
 * A readable summary of everything currently narrowing the results, each chip
 * removable on its own. Without this, filters set in a collapsed mobile drawer
 * (or left over from a previous session's URL) are invisible, and an empty
 * result set looks like a broken marketplace rather than a narrow search.
 */
export default function ActiveFilterChips({ values, onChange, onClear, nearby }) {
  const { t } = useTranslation();

  const chips = [];

  if (values.search) {
    chips.push({
      key: "search",
      label: `"${values.search}"`,
      onRemove: () => onChange({ search: "" }),
    });
  }

  if (values.category) {
    chips.push({
      key: "category",
      label: t(`shop.category_${values.category}`),
      onRemove: () => onChange({ category: "" }),
    });
  }

  if (values.minPrice || values.maxPrice) {
    const min = values.minPrice ? formatCurrency(Number(values.minPrice)) : null;
    const max = values.maxPrice ? formatCurrency(Number(values.maxPrice)) : null;
    chips.push({
      key: "price",
      label: min && max ? `${min} – ${max}` : min ? t("shop.fromPrice", { price: min }) : t("shop.upToPrice", { price: max }),
      onRemove: () => onChange({ minPrice: "", maxPrice: "" }),
    });
  }

  if (values.rating) {
    chips.push({
      key: "rating",
      label: t("shop.ratingChip", { rating: values.rating }),
      onRemove: () => onChange({ rating: "" }),
    });
  }

  if (values.inStock) {
    chips.push({ key: "inStock", label: t("shop.inStockOnly"), onRemove: () => onChange({ inStock: false }) });
  }

  if (values.onSale) {
    chips.push({ key: "onSale", label: t("shop.onSaleOnly"), onRemove: () => onChange({ onSale: false }) });
  }

  if (nearby?.active) {
    chips.push({
      key: "nearby",
      icon: MapPin,
      label: t("shop.withinKm", { km: nearby.radius }),
      onRemove: () => nearby.onToggle(false),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {chips.map(({ key, label, icon: Icon, onRemove }) => (
        <button
          key={key}
          onClick={onRemove}
          className="group inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-red-200 dark:hover:border-red-900 hover:text-red-600 transition-colors max-w-[220px]"
        >
          {Icon && <Icon className="w-3 h-3 text-orange-500 group-hover:text-red-500 shrink-0" />}
          <span className="truncate">{label}</span>
          <X className="w-3 h-3 text-slate-400 group-hover:text-red-500 shrink-0" />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          onClick={onClear}
          className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-orange-600 transition-colors px-1"
        >
          {t("shop.clearAll")}
        </button>
      )}
    </div>
  );
}
