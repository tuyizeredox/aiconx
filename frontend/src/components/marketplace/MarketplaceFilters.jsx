import React from "react";
import { useTranslation } from "react-i18next";
import {
  MapPin, Star, Tag, Package, SlidersHorizontal, Loader2, AlertCircle, RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export const CATEGORY_KEYS = [
  "fashion", "electronics", "home", "beauty", "sports", "food", "art", "books", "handmade", "other",
];

const RATING_OPTIONS = [4, 3, 2];

function Section({ icon: Icon, title, children, action }) {
  return (
    <div className="py-4 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * The marketplace filter panel. Rendered twice — as the sticky desktop column
 * and inside the mobile drawer — from a single definition so the two can never
 * drift apart. Purely controlled: every change is reported upward via onChange
 * so the page owns the state (and keeps it in the URL).
 */
export default function MarketplaceFilters({
  values,
  onChange,
  onClear,
  facets,
  activeCount = 0,
  nearby,
}) {
  const { t } = useTranslation();

  const categoryCounts = React.useMemo(() => {
    const map = new Map();
    (facets?.categories || []).forEach(c => map.set(c.category, c.count));
    return map;
  }, [facets]);

  // Categories that actually have products under the current filters come
  // first (with their counts); the rest stay visible but muted so the taxonomy
  // is still discoverable rather than silently disappearing.
  const orderedCategories = React.useMemo(() => {
    return [...CATEGORY_KEYS].sort((a, b) => (categoryCounts.get(b) || 0) - (categoryCounts.get(a) || 0));
  }, [categoryCounts]);

  const nearbyStatusLine = () => {
    if (!nearby.enabled) return t("shop.nearbyHint");
    switch (nearby.status) {
      case "locating":
        return t("shop.nearbyLocating");
      case "denied":
        return t("shop.nearbyDenied");
      case "unavailable":
        return t("shop.nearbyUnsupported");
      case "error":
        return t("shop.nearbyFailed");
      case "ready":
        return nearby.isLoading
          ? t("shop.nearbySearching")
          : t("shop.nearbyFound", { count: nearby.storeCount || 0, radius: nearby.radius });
      default:
        return t("shop.nearbyHint");
    }
  };

  const nearbyFailed = ["denied", "unavailable", "error"].includes(nearby.status);

  return (
    <div className="divide-y-0">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-orange-500" />
          {t("shop.filters")}
          {activeCount > 0 && (
            <span className="text-[10px] font-black text-white bg-orange-600 rounded-full px-1.5 py-0.5">{activeCount}</span>
          )}
        </h2>
        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-orange-600 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> {t("shop.clearAll")}
          </button>
        )}
      </div>

      {/* Near me — first because it's the filter that changes results the most */}
      <Section icon={MapPin} title={t("shop.nearMe")}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("shop.shopNearMe")}</p>
          <Switch checked={nearby.enabled} onCheckedChange={nearby.onToggle} />
        </div>
        <p className={`text-xs leading-relaxed flex items-start gap-1.5 ${
          nearbyFailed ? "text-amber-600 dark:text-amber-500" : "text-slate-500 dark:text-slate-400"
        }`}>
          {nearby.status === "locating" && nearby.enabled && <Loader2 className="w-3 h-3 animate-spin shrink-0 mt-0.5" />}
          {nearbyFailed && nearby.enabled && <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />}
          <span>{nearbyStatusLine()}</span>
        </p>

        {nearby.enabled && nearbyFailed && (
          <Button
            size="sm"
            variant="outline"
            onClick={nearby.onRetry}
            className="mt-2.5 h-8 rounded-xl text-xs w-full"
          >
            {t("shop.tryAgain")}
          </Button>
        )}

        {nearby.enabled && nearby.status === "ready" && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("shop.searchRadius")}</span>
              <span className="text-xs font-bold text-orange-600">{t("shop.kmValue", { km: nearby.radius })}</span>
            </div>
            <Slider
              value={[nearby.radius]}
              onValueChange={([v]) => nearby.onRadiusChange(v)}
              min={1}
              max={100}
              step={1}
            />
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
              <span>{t("shop.kmValue", { km: 1 })}</span>
              <span>{t("shop.kmValue", { km: 100 })}</span>
            </div>
          </div>
        )}
      </Section>

      {/* Category */}
      <Section icon={Package} title={t("shop.category")}>
        <div className="space-y-0.5 max-h-64 overflow-y-auto -mr-1 pr-1">
          <button
            onClick={() => onChange({ category: "" })}
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-sm transition-colors ${
              !values.category
                ? "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-400 font-semibold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <span>{t("shop.allCategories")}</span>
          </button>
          {orderedCategories.map(key => {
            const count = categoryCounts.get(key);
            const selected = values.category === key;
            return (
              <button
                key={key}
                onClick={() => onChange({ category: selected ? "" : key })}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-sm transition-colors ${
                  selected
                    ? "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-400 font-semibold"
                    : count
                      ? "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      : "text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <span className="truncate">{t(`shop.category_${key}`)}</span>
                {count > 0 && (
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Price */}
      <Section icon={Tag} title={t("shop.priceRange")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={facets?.price?.min ? String(Math.floor(facets.price.min)) : t("shop.min")}
            value={values.minPrice}
            onChange={(e) => onChange({ minPrice: e.target.value })}
            className="h-9 rounded-xl text-sm"
          />
          <span className="text-slate-300 dark:text-slate-600 shrink-0">–</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={facets?.price?.max ? String(Math.ceil(facets.price.max)) : t("shop.max")}
            value={values.maxPrice}
            onChange={(e) => onChange({ maxPrice: e.target.value })}
            className="h-9 rounded-xl text-sm"
          />
        </div>
      </Section>

      {/* Rating */}
      <Section icon={Star} title={t("shop.rating")}>
        <div className="space-y-0.5">
          {RATING_OPTIONS.map(value => {
            const selected = Number(values.rating) === value;
            return (
              <button
                key={value}
                onClick={() => onChange({ rating: selected ? "" : String(value) })}
                className={`w-full flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm transition-colors ${
                  selected
                    ? "bg-orange-50 dark:bg-orange-950 font-semibold"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {Array(5).fill(0).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i < value ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"}`}
                  />
                ))}
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">{t("shop.andUp")}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Availability */}
      <Section icon={SlidersHorizontal} title={t("shop.availability")}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-300">{t("shop.inStockOnly")}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("shop.inStockHint")}</p>
            </div>
            <Switch checked={values.inStock} onCheckedChange={(v) => onChange({ inStock: v })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-300">{t("shop.onSaleOnly")}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("shop.onSaleHint")}</p>
            </div>
            <Switch checked={values.onSale} onCheckedChange={(v) => onChange({ onSale: v })} />
          </div>
        </div>
      </Section>
    </div>
  );
}
