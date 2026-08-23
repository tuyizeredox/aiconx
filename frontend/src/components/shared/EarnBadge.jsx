import React from "react";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/utils";

/**
 * "Earn 1,800" — what this product pays whoever shares it.
 *
 * Kept to one number. The percentage, the link, the dashboard and the payout
 * schedule are all real, and all of them belong somewhere else: on a product
 * card the only question worth answering is "is this worth sharing?".
 *
 * Renders nothing when there is nothing to earn, so callers can drop it in
 * unconditionally.
 */
export default function EarnBadge({ amount, size = "sm", className = "" }) {
  const { t } = useTranslation();
  if (!amount || amount <= 0) return null;

  const sizes = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-[11px] px-2 py-1 gap-1.5",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 ${sizes[size] || sizes.sm} ${className}`}
      title={t("affiliate.earnPerSaleTitle", { amount: formatCurrency(amount) })}
    >
      {t("affiliate.earnAmount", { amount: formatCurrency(amount) })}
    </span>
  );
}
