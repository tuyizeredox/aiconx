import React from "react";
import { useTranslation } from "react-i18next";

export default function OptionSelector({ options, values, onChange }) {
  const { t } = useTranslation();

  if (!options || options.length === 0) return null;

  return (
    <div className="space-y-5 mb-6">
      {options.map((option) => (
        <div key={option.name}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {option.name}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {option.values.map((val) => {
              const isSelected = values[option.name] === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChange(option.name, val)}
                  className={`h-10 px-3.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    isSelected
                      ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
          {!values[option.name] && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              {t("product.selectOptionPrompt", { option: option.name })}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
