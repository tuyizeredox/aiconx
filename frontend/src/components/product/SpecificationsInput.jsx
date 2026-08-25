import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const MAX_SPECS = 25;

/** Name/value rows rendered as the spec table on the product page. */
export default function SpecificationsInput({ specifications = [], onChange }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const add = () => {
    const trimmedName = name.trim();
    const trimmedValue = value.trim();
    if (!trimmedName || !trimmedValue || specifications.length >= MAX_SPECS) return;
    if (specifications.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) return;
    onChange([...specifications, { name: trimmedName, value: trimmedValue }]);
    setName("");
    setValue("");
  };

  return (
    <div>
      <label className="text-sm font-medium text-slate-700 dark:text-ink-300 mb-1.5 block">
        {t("store.productSpecifications")}
      </label>
      <p className="text-xs text-slate-400 dark:text-ink-500 mb-2">{t("store.productSpecificationsHint")}</p>

      {specifications.length > 0 && (
        <div className="rounded-xl border border-slate-100 dark:border-ink-700 divide-y divide-slate-100 dark:divide-ink-700 mb-2.5 overflow-hidden">
          {specifications.map((spec, idx) => (
            <div key={`${spec.name}-${idx}`} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-ink-400 w-1/3 min-w-0 truncate">{spec.name}</span>
              <span className="text-sm text-slate-800 dark:text-ink-200 flex-1 min-w-0 truncate">{spec.value}</span>
              <button
                type="button"
                onClick={() => onChange(specifications.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                aria-label={t("common.delete")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder={t("store.specNamePlaceholder")}
          value={name}
          maxLength={60}
          disabled={specifications.length >= MAX_SPECS}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="w-1/3 shrink-0"
        />
        <Input
          placeholder={t("store.specValuePlaceholder")}
          value={value}
          maxLength={200}
          disabled={specifications.length >= MAX_SPECS}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={!name.trim() || !value.trim() || specifications.length >= MAX_SPECS}
          className="shrink-0 rounded-xl"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
