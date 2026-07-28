import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared "nothing here yet" panel for the landing page sections.
 *
 * A brand-new platform legitimately has empty sections, and a bare "0" or a grey
 * one-liner reads as broken rather than new. This gives every empty section the
 * same shape as a populated one — so the page keeps its rhythm — and turns the
 * gap into the next thing the visitor can do.
 *
 * `variant="subtle"` is for the narrower side-column sections.
 */
export default function EmptyState({ icon: Icon, title, description, cta, to, variant = "default" }) {
  const subtle = variant === "subtle";

  return (
    <div
      className={`flex flex-col items-center text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-5 ${
        subtle ? "gap-2 py-8" : "gap-3 py-10"
      }`}
    >
      <div
        className={`rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500 ${
          subtle ? "w-11 h-11" : "w-12 h-12"
        }`}
      >
        <Icon className={subtle ? "w-5 h-5" : "w-6 h-6"} />
      </div>

      <div>
        <p className={`font-bold text-slate-900 dark:text-white ${subtle ? "text-sm" : "text-sm sm:text-base"}`}>
          {title}
        </p>
        <p
          className={`text-slate-500 dark:text-slate-400 mt-1 mx-auto ${
            subtle ? "text-xs max-w-xs" : "text-xs sm:text-sm max-w-sm"
          }`}
        >
          {description}
        </p>
      </div>

      {cta && to && (
        <Link {...to} className="mt-1">
          {subtle ? (
            <span className="inline-block text-xs font-bold text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 rounded-lg px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
              {cta}
            </span>
          ) : (
            <Button className="h-10 px-5 gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-md shadow-orange-500/20 active:scale-[0.98] transition-transform">
              {cta}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </Link>
      )}
    </div>
  );
}
