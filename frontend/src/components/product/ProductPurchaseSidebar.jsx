import React from "react";
import { useTranslation } from "react-i18next";
import {
  Truck, MapPin, ShieldCheck, RotateCcw, Lock, Headphones, Store as StoreIcon, PackageCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";

function Card({ children }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
      {children}
    </div>
  );
}

function Guarantee({ icon: Icon, title, body }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{title}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

/**
 * The right-hand rail on the product page: how it gets to you, how you pay,
 * and what protects the purchase.
 *
 * Every delivery claim here comes from the seller's own delivery settings —
 * the block is skipped entirely when a store hasn't configured any, rather
 * than showing a promise ("arrives tomorrow", "free shipping") that nobody
 * has actually committed to.
 */
export default function ProductPurchaseSidebar({ store, returnWindowDays = 7 }) {
  const { t } = useTranslation();
  const delivery = store?.delivery_settings;

  const methods = [
    delivery?.shipping_enabled && t("product.methodShipping"),
    delivery?.delivery_enabled && t("product.methodDelivery"),
    delivery?.pickup_enabled && t("product.methodPickup"),
  ].filter(Boolean);

  const freeAbove = delivery?.free_delivery_above;
  const deliveryFee = delivery?.delivery_fee;
  const city = store?.location?.city;

  const hasDeliveryInfo = !!(delivery?.delivery_time_est || methods.length > 0 || freeAbove > 0 || city);

  return (
    <div className="space-y-3">
      {hasDeliveryInfo && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t("product.delivery")}</h3>
          </div>

          {delivery?.delivery_time_est && (
            <div className="mb-3">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("product.getItBy")}</p>
              <p className="text-base font-bold text-green-600 dark:text-green-500">{delivery.delivery_time_est}</p>
            </div>
          )}

          {methods.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 flex items-start gap-1.5">
              <PackageCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
              <span>{methods.join(" · ")}</span>
            </p>
          )}

          {city && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2.5">
              <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              {t("product.shipsFrom", { city })}
            </p>
          )}

          {freeAbove > 0 ? (
            <div className="bg-green-50 dark:bg-green-950/50 rounded-xl px-3 py-2.5">
              <p className="text-xs font-bold text-green-800 dark:text-green-400">{t("product.freeDelivery")}</p>
              <p className="text-[11px] text-green-700 dark:text-green-500">
                {t("product.freeDeliveryAbove", { amount: formatCurrency(freeAbove) })}
              </p>
            </div>
          ) : deliveryFee > 0 ? (
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {t("product.deliveryFee", { amount: formatCurrency(deliveryFee) })}
              </p>
            </div>
          ) : null}
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-slate-700 dark:text-slate-200" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t("product.secureCheckout")}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map(method => (
            <div
              key={method.id}
              title={method.label}
              className="h-9 min-w-[56px] px-2 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden"
            >
              {method.logo ? (
                <img src={method.logo} alt={method.label} className="max-h-6 max-w-[52px] object-contain" />
              ) : (
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {method.emoji} {t("product.cardPayment")}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2.5">{t("product.securePaymentNote")}</p>
      </Card>

      <Card>
        <div className="space-y-3.5">
          <Guarantee
            icon={RotateCcw}
            title={t("product.easyReturnsTitle", { days: returnWindowDays })}
            body={t("product.easyReturnsBody")}
          />
          <Guarantee
            icon={ShieldCheck}
            title={t("product.buyerProtection")}
            body={t("product.buyerProtectionBody")}
          />
          {store?.is_verified && (
            <Guarantee
              icon={StoreIcon}
              title={t("product.verifiedSellerTitle")}
              body={t("product.verifiedSellerBody")}
            />
          )}
          <Guarantee
            icon={Headphones}
            title={t("product.supportTitle")}
            body={t("product.supportBody")}
          />
        </div>
      </Card>
    </div>
  );
}
