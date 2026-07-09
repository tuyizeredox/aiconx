import React from "react";
import { useTranslation } from "react-i18next";

export default function SizeSelector({ sizes, value, onChange }) {
  const { t } = useTranslation();

  if (!sizes || sizes.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("product.size")}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => {
          const isSelected = value === size;
          return (
            <button
              key={size}
              type="button"
              onClick={() => onChange(size)}
              className={`min-w-[2.75rem] h-10 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                isSelected
                  ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              {size}
            </button>
          );
        })}
      </div>
      {!value && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{t("product.selectSizePrompt")}</p>
      )}
    </div>
  );
}
