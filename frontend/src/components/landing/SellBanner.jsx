import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authLink } from "./authLink";

export default function SellBanner() {
  const { t } = useTranslation();

  return (
    <section
      id="sell"
      className="scroll-mt-20 relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-orange-50 to-orange-100/70 dark:from-orange-500/10 dark:to-orange-500/5 border border-orange-100 dark:border-orange-500/20 p-6 sm:p-10"
    >
      <div className="grid md:grid-cols-[1.3fr_1fr] gap-8 items-center">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2 leading-tight">
            {t("landing.sell.title")}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-ink-400 mb-5 max-w-md">
            {t("landing.sell.subtitle")}
          </p>
          <Link {...authLink("/mystore")} className="block sm:inline-block">
            <Button className="w-full sm:w-auto h-12 px-6 gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform">
              {t("landing.sell.cta")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="relative hidden sm:block">
          <div className="rounded-2xl overflow-hidden aspect-[4/3] shadow-lg">
            <img
              src="https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=900&q=80"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -top-3 -left-3 bg-white dark:bg-ink-900 rounded-xl shadow-lg border border-slate-100 dark:border-ink-800 px-3 py-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-ink-200">{t("landing.sell.badgeFree")}</span>
          </div>
          <div className="absolute -bottom-3 -right-3 bg-white dark:bg-ink-900 rounded-xl shadow-lg border border-slate-100 dark:border-ink-800 px-3 py-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-ink-200">{t("landing.sell.badgeNoCode")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
