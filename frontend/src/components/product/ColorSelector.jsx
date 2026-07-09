import React from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

const FALLBACK_SWATCH = "#cbd5e1";

export default function ColorSelector({ colors, value, onChange }) {
  const { t } = useTranslation();

  if (!colors || colors.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("product.color")}
        </span>
        {value && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{value}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((color) => {
          const isSelected = value === color.name;
          return (
            <button
              key={color.name}
              type="button"
              onClick={() => onChange(color.name)}
              title={color.name}
              className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? "border-orange-500 ring-2 ring-orange-100 dark:ring-orange-900/40 scale-110"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
              style={color.image ? undefined : { backgroundColor: color.hex || FALLBACK_SWATCH }}
            >
              {color.image && (
                <img src={color.image} alt={color.name} className="w-full h-full rounded-full object-cover" />
              )}
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Check className={`w-4 h-4 drop-shadow ${color.image ? "text-white" : "text-white mix-blend-difference"}`} />
                </span>
              )}
              <span className="sr-only">{color.name}</span>
            </button>
          );
        })}
      </div>
      {!value && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{t("product.selectColorPrompt")}</p>
      )}
    </div>
  );
}
