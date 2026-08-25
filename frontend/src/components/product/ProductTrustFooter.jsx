import React from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, CreditCard, Truck, RotateCcw, Headphones } from "lucide-react";

/**
 * Platform-level reassurance strip at the bottom of the product page. These are
 * Aicon X's own commitments (not per-seller claims), so they're the same on
 * every product.
 */
export default function ProductTrustFooter() {
  const { t } = useTranslation();

  const items = [
    { icon: ShieldCheck, title: t("product.trustGenuineTitle"), body: t("product.trustGenuineBody") },
    { icon: CreditCard, title: t("product.trustPaymentsTitle"), body: t("product.trustPaymentsBody") },
    { icon: Truck, title: t("product.trustDeliveryTitle"), body: t("product.trustDeliveryBody") },
    { icon: RotateCcw, title: t("product.trustReturnsTitle"), body: t("product.trustReturnsBody") },
    { icon: Headphones, title: t("product.trustSupportTitle"), body: t("product.trustSupportBody") },
  ];

  return (
    <section className="bg-white dark:bg-ink-900 rounded-2xl border border-slate-100 dark:border-ink-800 p-4 sm:p-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-start gap-2.5 min-w-0">
            <Icon className="w-5 h-5 text-slate-400 dark:text-ink-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-ink-200 leading-tight">{title}</p>
              <p className="text-[11px] text-slate-400 dark:text-ink-500 leading-relaxed mt-0.5">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
