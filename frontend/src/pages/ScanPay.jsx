import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, Minus, Plus, Smartphone, ShieldCheck, CheckCircle2, XCircle,
  PackageX, ArrowRight, Store as StoreIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { qrPayAPI } from "@/api/apiClient";
import Seo from "@/components/shared/Seo";
import { useTranslation } from "react-i18next";

/**
 * The page a shopper lands on after scanning the QR code stuck on a physical
 * product. It is the whole purchase: see the item, type a phone number, approve
 * the prompt, done. No account, no cart, no address — they are already holding
 * the thing they are paying for.
 *
 * Built phone-first and deliberately short, because it is only ever opened on a
 * phone camera, usually while standing in a shop.
 */

const PROVIDERS = [
  { id: "mtn", label: "MTN MoMo", accent: "bg-yellow-400 text-yellow-950" },
  { id: "airtel", label: "Airtel Money", accent: "bg-red-500 text-white" },
];

// The gateway prompt sits on the shopper's phone for a while; poll gently and
// give up at roughly the same point checkout does.
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 150000;

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="text-center mb-5">
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-ink-500">
        Aicon X
      </span>
    </div>
  );
}

export default function ScanPay() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("p");

  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState("mtn");
  const [starting, setStarting] = useState(false);
  const [payment, setPayment] = useState(null); // { order_id, reference, total }
  const [phase, setPhase] = useState("form");   // form | waiting | paid | failed
  const [failure, setFailure] = useState("");
  const [receipt, setReceipt] = useState(null);

  const timers = useRef({ poll: null, timeout: null });

  const { data: product, isLoading, isError, error } = useQuery({
    queryKey: ["scanPayProduct", productId],
    queryFn: () => qrPayAPI.getProduct(productId),
    enabled: !!productId,
    retry: false,
  });

  const maxQuantity = product?.max_quantity ?? null;
  const total = useMemo(
    () => (product ? product.price * quantity : 0),
    [product, quantity]
  );

  const clearTimers = () => {
    if (timers.current.poll) clearInterval(timers.current.poll);
    if (timers.current.timeout) clearTimeout(timers.current.timeout);
    timers.current = { poll: null, timeout: null };
  };

  useEffect(() => clearTimers, []);

  // Poll the gateway while the shopper approves the prompt on their phone.
  useEffect(() => {
    if (phase !== "waiting" || !payment) return;

    const check = async () => {
      try {
        const res = await qrPayAPI.checkStatus(payment.order_id, payment.reference);

        if (res.status === "paid") {
          clearTimers();
          setReceipt(res);
          setPhase("paid");
        } else if (res.status === "failed") {
          clearTimers();
          setFailure(res.message || t("scanPay.paymentFailed"));
          setPhase("failed");
        }
      } catch (err) {
        clearTimers();
        setFailure(err.message || t("scanPay.paymentFailed"));
        setPhase("failed");
      }
    };

    timers.current.poll = setInterval(check, POLL_INTERVAL_MS);
    timers.current.timeout = setTimeout(() => {
      clearTimers();
      setFailure(t("scanPay.timedOut"));
      setPhase("failed");
    }, POLL_TIMEOUT_MS);

    return clearTimers;
  }, [phase, payment, t]);

  const startPayment = async () => {
    if (!phone.trim()) {
      setFailure(t("scanPay.phoneRequired"));
      return;
    }

    setStarting(true);
    setFailure("");
    setPayment(null);
    setReceipt(null);
    try {
      const res = await qrPayAPI.startPayment({
        product_id: productId,
        quantity,
        phone: phone.trim(),
        provider,
      });
      setPayment(res);
      setPhase("waiting");
    } catch (err) {
      setFailure(err.message || t("scanPay.couldNotStart"));
    } finally {
      setStarting(false);
    }
  };

  if (!productId) {
    return (
      <Shell>
        <BrandMark />
        <div className="bg-white dark:bg-ink-800 rounded-2xl border border-slate-100 dark:border-ink-700 p-8 text-center">
          <PackageX className="w-8 h-8 mx-auto text-slate-300 dark:text-ink-600" />
          <p className="mt-3 text-sm text-slate-500 dark:text-ink-400">{t("scanPay.noCode")}</p>
        </div>
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <Shell>
        <div className="py-24 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
        </div>
      </Shell>
    );
  }

  if (isError || !product) {
    return (
      <Shell>
        <BrandMark />
        <div className="bg-white dark:bg-ink-800 rounded-2xl border border-slate-100 dark:border-ink-700 p-8 text-center">
          <PackageX className="w-8 h-8 mx-auto text-slate-300 dark:text-ink-600" />
          <p className="mt-3 text-sm text-slate-500 dark:text-ink-400">
            {error?.message || t("scanPay.notFound")}
          </p>
        </div>
      </Shell>
    );
  }

  // --- Paid -----------------------------------------------------------------
  if (phase === "paid") {
    return (
      <Shell>
        <Seo title={t("scanPay.paidTitle")} path="/pay" noindex />
        <BrandMark />
        <div className="bg-white dark:bg-ink-800 rounded-2xl border border-slate-100 dark:border-ink-700 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
            {t("scanPay.paidTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-ink-400">
            {t("scanPay.paidBody", { store: product.store_name })}
          </p>

          <div className="mt-5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-100 dark:border-ink-700 p-4 text-left space-y-2">
            <Row label={t("scanPay.item")} value={`${product.title} × ${receipt?.quantity || quantity}`} />
            <Row label={t("scanPay.amountPaid")} value={formatCurrency(receipt?.total ?? total)} strong />
            <Row label={t("scanPay.reference")} value={String(receipt?.order_id || "").slice(-8).toUpperCase()} mono />
            <Row label={t("scanPay.status")} value={t("scanPay.delivered")} />
          </div>

          <p className="mt-4 text-xs text-slate-400 dark:text-ink-500">
            {t("scanPay.keepReceipt")}
          </p>

          {product.store_slug && (
            <Link
              to={`/store/${product.store_slug}`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              {t("scanPay.visitStore")} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </Shell>
    );
  }

  // --- Waiting on the mobile money prompt -----------------------------------
  if (phase === "waiting") {
    return (
      <Shell>
        <Seo title={t("scanPay.waitingTitle")} path="/pay" noindex />
        <BrandMark />
        <div className="bg-white dark:bg-ink-800 rounded-2xl border border-slate-100 dark:border-ink-700 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center mx-auto">
            <Smartphone className="w-7 h-7 text-orange-500 animate-pulse" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
            {t("scanPay.waitingTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-ink-400 leading-relaxed">
            {t("scanPay.waitingBody", { phone: payment?.phone || phone, amount: formatCurrency(payment?.total ?? total) })}
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-ink-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {t("scanPay.waitingHint")}
          </div>
        </div>
      </Shell>
    );
  }

  // --- Form / failed --------------------------------------------------------
  return (
    <Shell>
      <Seo title={t("scanPay.title", { product: product.title })} path="/pay" noindex />
      <BrandMark />

      <div className="bg-white dark:bg-ink-800 rounded-2xl border border-slate-100 dark:border-ink-700 overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-ink-700">
          <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-ink-700 overflow-hidden shrink-0">
            {product.image && <img src={product.image} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
              {product.title}
            </h1>
            <p className="text-base font-bold text-orange-600 mt-0.5">{formatCurrency(product.price)}</p>
            {product.store_name && (
              <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-ink-500 mt-0.5 truncate">
                <StoreIcon className="w-3 h-3 shrink-0" /> {product.store_name}
              </p>
            )}
          </div>
        </div>

        {!product.available ? (
          <div className="p-8 text-center">
            <PackageX className="w-8 h-8 mx-auto text-slate-300 dark:text-ink-600" />
            <p className="mt-3 text-sm text-slate-500 dark:text-ink-400">{t("scanPay.unavailable")}</p>
          </div>
        ) : (
          <div className="p-4 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t("scanPay.quantity")}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-ink-600 flex items-center justify-center text-slate-500 disabled:opacity-40"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-slate-900 dark:text-white">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => (maxQuantity ? Math.min(maxQuantity, q + 1) : q + 1))}
                  disabled={!!maxQuantity && quantity >= maxQuantity}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-ink-600 flex items-center justify-center text-slate-500 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                {t("scanPay.payWith")}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      provider === p.id
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                        : "border-slate-200 dark:border-ink-600 hover:border-slate-300"
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-md ${p.accent} text-[9px] font-black flex items-center justify-center`}>
                      {p.id === "mtn" ? "M" : "A"}
                    </span>
                    <span className="block mt-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="scanpay-phone" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                {t("scanPay.yourNumber")}
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="scanpay-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0788 123 456"
                  className="pl-9 h-12 rounded-xl text-base"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 dark:text-ink-500">
                {t("scanPay.numberHint")}
              </p>
            </div>

            {failure && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 px-3 py-2.5">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">{failure}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 dark:text-ink-400">{t("scanPay.total")}</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(total)}</span>
            </div>

            <Button
              onClick={startPayment}
              disabled={starting}
              className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-base font-semibold"
            >
              {starting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("scanPay.starting")}</>
                : payment ? t("scanPay.tryAgain") : t("scanPay.payNow")}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-ink-500">
              <ShieldCheck className="w-3.5 h-3.5" /> {t("scanPay.secureNote")}
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Row({ label, value, strong, mono }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500 dark:text-ink-400 shrink-0">{label}</span>
      <span
        className={`text-xs text-right truncate ${mono ? "font-mono" : ""} ${
          strong ? "font-bold text-slate-900 dark:text-white" : "text-slate-700 dark:text-ink-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
