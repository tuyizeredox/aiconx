import React, { useState } from "react";
import { useLang } from "@/components/providers/LanguageContext";
import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function LanguagePicker({ compact = false }) {
  const [open, setOpen] = useState(false);
  const { lang, setLang, SUPPORTED_LANGS, currentLangInfo } = useLang() || {};

  if (!SUPPORTED_LANGS) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm text-slate-600 dark:text-slate-400 font-medium ${compact && "justify-center w-full"}`}
        title="Change language"
      >
        <span className="text-base">{currentLangInfo?.flag}</span>
        {!compact && <span className="hidden sm:inline text-xs">{currentLangInfo?.label}</span>}
        {!compact && <ChevronDown className="w-3 h-3 text-slate-400" />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-50 min-w-[160px]"
            >
              {SUPPORTED_LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${lang === l.code ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  <span className="text-base">{l.flag}</span>
                  <span className="flex-1 text-left">{l.label}</span>
                  {lang === l.code && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}