import React, { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

function OptionGroupValueInput({ group, onAddValue }) {
  const [value, setValue] = useState("");
  const add = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (group.values.some(v => v.toLowerCase() === trimmed.toLowerCase())) return;
    onAddValue(trimmed);
    setValue("");
  };
  return (
    <div className="flex gap-2">
      <Input
        placeholder="Add a value (e.g. Cotton)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        className="h-9 text-sm"
      />
      <Button type="button" size="sm" variant="outline" onClick={add} disabled={!value.trim()} className="shrink-0 rounded-lg h-9">
        <Plus className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export default function CustomOptionsInput({ options = [], onChange }) {
  const { t } = useTranslation();
  const [newGroupName, setNewGroupName] = useState("");

  const addGroup = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    if (options.some(o => o.name.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...options, { name: trimmed, values: [] }]);
    setNewGroupName("");
  };

  const removeGroup = (idx) => {
    onChange(options.filter((_, i) => i !== idx));
  };

  const addValueToGroup = (idx, val) => {
    const next = [...options];
    next[idx] = { ...next[idx], values: [...next[idx].values, val] };
    onChange(next);
  };

  const removeValueFromGroup = (idx, valIdx) => {
    const next = [...options];
    next[idx] = { ...next[idx], values: next[idx].values.filter((_, i) => i !== valIdx) };
    onChange(next);
  };

  return (
    <div>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
        {t("store.productCustomOptions")}
      </label>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{t("store.productCustomOptionsHint")}</p>

      {options.length > 0 && (
        <div className="space-y-3 mb-3">
          {options.map((group, idx) => (
            <div key={`${group.name}-${idx}`} className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{group.name}</span>
                <button
                  type="button"
                  onClick={() => removeGroup(idx)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {group.values.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {group.values.map((v, vi) => (
                    <span
                      key={`${v}-${vi}`}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                    >
                      {v}
                      <button
                        type="button"
                        onClick={() => removeValueFromGroup(idx, vi)}
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <OptionGroupValueInput group={group} onAddValue={(val) => addValueToGroup(idx, val)} />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder={t("store.optionGroupNamePlaceholder")}
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGroup(); } }}
        />
        <Button type="button" variant="outline" onClick={addGroup} disabled={!newGroupName.trim()} className="shrink-0 rounded-xl">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
