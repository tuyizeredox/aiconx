import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function ColorInput({ colors = [], onChange }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#f97316");

  const addColor = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (colors.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...colors, { name: trimmed, hex }]);
    setName("");
  };

  const removeColor = (idx) => {
    onChange(colors.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
        {t("store.productColors")}
      </label>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{t("store.productColorsHint")}</p>

      {colors.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {colors.map((c, i) => (
            <span
              key={`${c.name}-${i}`}
              className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <span className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: c.hex }} />
              {c.name}
              <button
                type="button"
                onClick={() => removeColor(i)}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0 bg-transparent p-0.5"
        />
        <Input
          placeholder={t("store.colorNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addColor(); } }}
        />
        <Button type="button" variant="outline" onClick={addColor} disabled={!name.trim()} className="shrink-0 rounded-xl">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
