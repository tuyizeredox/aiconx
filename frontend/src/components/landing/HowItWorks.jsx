import React from "react";
import { useTranslation } from "react-i18next";
import { ImagePlay, Users, ShoppingBag } from "lucide-react";

const STEPS = [
  { n: 1, icon: ImagePlay, color: "violet", titleKey: "step1Title", descKey: "step1Desc" },
  { n: 2, icon: Users, color: "orange", titleKey: "step2Title", descKey: "step2Desc" },
  { n: 3, icon: ShoppingBag, color: "emerald", titleKey: "step3Title", descKey: "step3Desc" },
];

const COLOR_CLASSES = {
  orange: { icon: "bg-orange-50 dark:bg-orange-500/10 text-orange-500", badge: "bg-orange-500" },
  violet: { icon: "bg-violet-50 dark:bg-violet-500/10 text-violet-500", badge: "bg-violet-500" },
  emerald: { icon: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500", badge: "bg-emerald-500" },
};

// Deliberately compact: this is orientation copy, not a feature pitch, so it sits
// on one line per step (icon beside the text rather than above it) and stays out
// of the way of the feed and products below.
export default function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section>
      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-3">
        {t("landing.how.title")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const colors = COLOR_CLASSES[step.color];
          return (
            <div
              key={step.n}
              className="flex items-start gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3"
            >
              <div className="relative shrink-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.icon}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div
                  className={`absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${colors.badge}`}
                >
                  {step.n}
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                  {t(`landing.how.${step.titleKey}`)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                  {t(`landing.how.${step.descKey}`)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
