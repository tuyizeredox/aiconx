import React from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, Shirt, Laptop, Home, Sparkles, Dumbbell, UtensilsCrossed, Palette } from "lucide-react";

const CATEGORIES = [
  { value: "all", icon: LayoutGrid, labelKey: "explore.cat.all" },
  { value: "fashion", icon: Shirt, labelKey: "explore.cat.fashion" },
  { value: "electronics", icon: Laptop, labelKey: "explore.cat.electronics" },
  { value: "home", icon: Home, labelKey: "explore.cat.home" },
  { value: "beauty", icon: Sparkles, labelKey: "explore.cat.beauty" },
  { value: "sports", icon: Dumbbell, labelKey: "explore.cat.sports" },
  { value: "food", icon: UtensilsCrossed, labelKey: "explore.cat.food" },
  { value: "art", icon: Palette, labelKey: "explore.cat.art" },
];

export default function CategoryPills({ value, onChange }) {
  const { t } = useTranslation();

  return (
    <section>
      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-3">{t("landing.categories.title")}</h2>
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-4 px-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = value === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => onChange(cat.value)}
              className={`flex items-center gap-1.5 shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors active:scale-[0.95] ${
                active
                  ? "bg-orange-600 border-orange-600 text-white"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-orange-300 hover:text-orange-600"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(cat.labelKey)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
