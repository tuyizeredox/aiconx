import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ImagePlay, Users, ShoppingBag } from "lucide-react";

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

export default function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section>
      <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-5">{t("landing.how.title")}</h2>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 items-stretch">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const colors = COLOR_CLASSES[step.color];
          return (
            <React.Fragment key={step.n}>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5">
                <div className="relative w-11 h-11 mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors.icon}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className={`absolute -top-2 -left-2 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${colors.badge}`}>
                    {step.n}
                  </div>
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">{t(`landing.how.${step.titleKey}`)}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t(`landing.how.${step.descKey}`)}</p>
              </div>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="hidden md:block w-6 h-6 text-slate-300 dark:text-slate-700 self-center" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}
