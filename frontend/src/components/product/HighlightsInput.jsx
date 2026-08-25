import React, { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const MAX_HIGHLIGHTS = 12;

/** Short selling points shown as a checklist at the top of the product page. */
export default function HighlightsInput({ highlights = [], onChange }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed || highlights.length >= MAX_HIGHLIGHTS) return;
    if (highlights.some(h => h.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...highlights, trimmed]);
    setDraft("");
  };

  return (
    <div>
      <label className="text-sm font-medium text-slate-700 dark:text-ink-300 mb-1.5 block">
        {t("store.productHighlights")}
      </label>
      <p className="text-xs text-slate-400 dark:text-ink-500 mb-2">{t("store.productHighlightsHint")}</p>

      {highlights.length > 0 && (
        <div className="space-y-1.5 mb-2.5">
          {highlights.map((highlight, idx) => (
            <div
              key={`${highlight}-${idx}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-100 dark:border-ink-700"
            >
              <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <span className="text-sm text-slate-700 dark:text-ink-200 flex-1 min-w-0 truncate">{highlight}</span>
              <button
                type="button"
                onClick={() => onChange(highlights.filter((_, i) => i !== idx))}
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
          placeholder={t("store.highlightPlaceholder")}
          value={draft}
          maxLength={120}
          disabled={highlights.length >= MAX_HIGHLIGHTS}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={!draft.trim() || highlights.length >= MAX_HIGHLIGHTS}
          className="shrink-0 rounded-xl"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
