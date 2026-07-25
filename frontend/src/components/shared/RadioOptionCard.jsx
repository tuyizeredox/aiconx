import React from "react";

export default function RadioOptionCard({ selected, disabled, onSelect, icon: Icon, iconImg, iconEmoji, title, subtitle, badge, badgeFree }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect()}
      disabled={disabled}
      className={`relative flex items-center gap-3 p-4 rounded-xl border text-left transition-all w-full ${
        disabled
          ? "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 opacity-60 cursor-not-allowed"
          : selected
          ? "border-orange-500 bg-orange-50/70 dark:bg-orange-900/20 shadow-sm"
          : "border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
      }`}
    >
      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-orange-500" : "border-slate-300 dark:border-slate-600"}`}>
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
      </span>
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${selected ? "bg-white dark:bg-slate-900" : "bg-slate-100 dark:bg-slate-800"}`}>
        {iconImg ? (
          <img src={iconImg} alt="" className="w-6 h-6 object-contain" />
        ) : iconEmoji ? (
          <span className="text-lg">{iconEmoji}</span>
        ) : Icon ? (
          <Icon className={`w-5 h-5 ${selected ? "text-orange-600" : "text-slate-500 dark:text-slate-400"}`} />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold text-sm truncate ${selected ? "text-orange-900 dark:text-orange-300" : "text-slate-900 dark:text-white"}`}>{title}</span>
        {subtitle && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{subtitle}</span>}
      </span>
      {badge && (
        <span className={`text-xs font-semibold shrink-0 ${badgeFree ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>{badge}</span>
      )}
    </button>
  );
}
