import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function SizeInput({ sizes = [], onChange }) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  const addSize = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (sizes.some(s => s.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...sizes, trimmed]);
    setValue("");
  };

  const removeSize = (idx) => {
    onChange(sizes.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
        {t("store.productSizes")}
      </label>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{t("store.productSizesHint")}</p>

      {sizes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {sizes.map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              {s}
              <button
                type="button"
                onClick={() => removeSize(i)}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder={t("store.sizeNamePlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(); } }}
        />
        <Button type="button" variant="outline" onClick={addSize} disabled={!value.trim()} className="shrink-0 rounded-xl">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
