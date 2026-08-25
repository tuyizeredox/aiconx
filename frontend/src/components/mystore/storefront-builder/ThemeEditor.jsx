import React from "react";
import { Input } from "@/components/ui/input";

function ColorField({ label, value, defaultValue, onChange }) {
  const hex = value || defaultValue;
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-500 dark:text-ink-400 block">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-slate-200 dark:border-ink-700 cursor-pointer shrink-0 bg-transparent p-0.5"
        />
        <Input value={hex} onChange={(e) => onChange(e.target.value)} className="font-mono text-sm" maxLength={7} />
      </div>
    </div>
  );
}

export default function ThemeEditor({ theme = {}, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <ColorField
        label="Primary color"
        value={theme.primary_color}
        defaultValue="#ea580c"
        onChange={(v) => onChange({ ...theme, primary_color: v })}
      />
      <ColorField
        label="Accent color"
        value={theme.accent_color}
        defaultValue="#f97316"
        onChange={(v) => onChange({ ...theme, accent_color: v })}
      />
    </div>
  );
}
