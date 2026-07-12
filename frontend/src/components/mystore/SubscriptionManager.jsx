import React, { useState, useEffect } from "react";
import { vendorSubscriptionsAPI, authAPI, paymentAPI } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Crown, Zap, Star, Check, Globe, TrendingUp, Image, Infinity, Loader2, Shield, BadgeCheck, AlertCircle, Info, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { initializeITECPayPayment } from "@/lib/itecpay";
import { useAuth } from "@/lib/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const DEFAULT_PRICES = {
  free:  { monthly: 0,     annual: 0 },
  pro:   { monthly: 29000, annual: 23000 },
  elite: { monthly: 79000, annual: 63000 },
};

export function getPlanPrices() {
  return DEFAULT_PRICES;
}

const PLANS = [
  {
    id: "free",
    name: "Starter",
    price: 0,
    priceAnnual: 0,
    color: "border-slate-200 dark:border-slate-700",
    headerBg: "bg-slate-50 dark:bg-slate-800/50",
    badge: null,
    icon: Star,
    iconColor: "text-slate-500",
    features: [
      "subscription.freeFeat0",
      "subscription.freeFeat1",
      "subscription.freeFeat2",
      "subscription.freeFeat3",
      "subscription.freeFeat4",
    ],
    limits: { products: 10, images: 5, priority_search: false, custom_domain: false, unlimited_media: false },
  },
  {
    id: "pro",
    name: "Pro",
    price: DEFAULT_PRICES.pro.monthly,
    priceAnnual: DEFAULT_PRICES.pro.annual,
    color: "border-orange-400",
    headerBg: "bg-gradient-to-br from-orange-50 to-orange-50 dark:from-orange-950 dark:to-orange-950",
    badge: "subscription.badgeMostPopular",
    icon: Zap,
    iconColor: "text-orange-600",
    features: [
      "subscription.proFeat0",
      "subscription.proFeat1",
      "subscription.proFeat2",
      "subscription.proFeat3",
      "subscription.proFeat5",
      "subscription.proFeat6",
    ],
    limits: { products: 200, images: 20, priority_search: true, custom_domain: true, unlimited_media: false },
  },
  {
    id: "elite",
    name: "Elite",
    price: DEFAULT_PRICES.elite.monthly,
    priceAnnual: DEFAULT_PRICES.elite.annual,
    color: "border-amber-400",
    headerBg: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950",
    badge: "subscription.badgeBestValue",
    icon: Crown,
    iconColor: "text-amber-600",
    features: [
      "subscription.eliteFeat0",
      "subscription.eliteFeat1",
      "subscription.eliteFeat2",
      "subscription.eliteFeat3",
      "subscription.eliteFeat5",
      "subscription.eliteFeat6",
      "subscription.eliteFeat7",
    ],
    limits: { products: Infinity, images: Infinity, priority_search: true, custom_domain: true, unlimited_media: true },
  },
];

function PlanCard({ plan, currentPlan, onSelect, billing, prices, isPending }) {
  const { t } = useTranslation();
  const planIndex = PLANS.findIndex(p => p.id === plan.id);
  // A subscription still in 'pending' status hasn't been paid for yet, so the vendor
  // hasn't actually gained access to it — treat their real tier as whatever they had before.
  const currentPlanId = currentPlan?.status === "pending" ? "free" : (currentPlan?.plan || "free");
  const currentIndex = PLANS.findIndex(p => p.id === currentPlanId);
  const isActive = currentPlan?.plan === plan.id && currentPlan?.status !== "pending";
  const isUnlocked = planIndex <= currentIndex;
  const isDowngrade = currentPlan && planIndex < PLANS.findIndex(p => p.id === currentPlan.plan);
  const planPrices = prices?.[plan.id];
  const price = billing === "annual" ? (planPrices?.annual ?? plan.priceAnnual) : (planPrices?.monthly ?? plan.price);
  const basePrice = planPrices?.monthly ?? plan.price;
  const baseAnnual = planPrices?.annual ?? plan.priceAnnual;
  const PlanIcon = plan.icon;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`relative min-w-0 rounded-2xl border-2 ${plan.color} ${isActive ? "ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-slate-900" : ""} overflow-hidden flex flex-col h-full`}
    >
      {plan.badge && (
        <div className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${plan.id === "pro" ? "bg-orange-600 text-white" : "bg-amber-500 text-white"}`}>
          {t(plan.badge)}
        </div>
      )}
      <div className={`p-4 sm:p-5 ${plan.headerBg}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 shrink-0 ${plan.id === "free" ? "bg-slate-200 dark:bg-slate-700" : plan.id === "pro" ? "bg-orange-100 dark:bg-orange-900" : "bg-amber-100 dark:bg-amber-900"}`}>
          <PlanIcon className={`w-5 h-5 ${plan.iconColor}`} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
        <div className="flex items-end flex-wrap gap-1 mt-1">
          <span className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white whitespace-nowrap">{formatCurrency(price)}</span>
          <span className="text-slate-500 dark:text-slate-400 text-sm mb-0.5">{t("subscription.perMonth")}</span>
        </div>
        {billing === "annual" && basePrice > 0 && baseAnnual < basePrice && (
          <p className="text-xs text-green-600 font-medium mt-0.5">{t("subscription.savePerYear", { amount: formatCurrency((basePrice - baseAnnual) * 12) })}</p>
        )}
      </div>

      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <ul className="space-y-2.5 flex-1 mb-5">
          {plan.features.map((f, i) => (
            <li key={i} className={`flex items-start gap-2 text-sm ${isUnlocked ? "text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`}>
              {isUnlocked
                ? <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                : <Lock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />}
              <span className="min-w-0 break-words">{t(f)}</span>
            </li>
          ))}
        </ul>

        {isActive ? (
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm font-semibold">
            <BadgeCheck className="w-4 h-4" /> {t("subscription.currentPlan")}
          </div>
        ) : (
          <Button
            onClick={() => onSelect(plan)}
            disabled={isPending}
            className={`w-full rounded-xl ${plan.id === "free" ? "variant-outline border border-slate-200" : plan.id === "pro" ? "bg-orange-600 hover:bg-orange-700" : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"}`}
            variant={plan.id === "free" ? "outline" : "default"}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : !isUnlocked ? <Lock className="w-3.5 h-3.5 mr-1" /> : null}
            {t("subscription.upgradeButton", { action: isDowngrade ? t("subscription.downgrade") : t("subscription.upgrade"), name: plan.name })}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function CustomDomainManager({ subscription, vendorUsername }) {
  const { t } = useTranslation();
  const [domain, setDomain] = useState(subscription?.custom_domain || "");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const canUseDomain = subscription?.plan === "pro" || subscription?.plan === "elite";
  const isElite = subscription?.plan === "elite";

  const save = async () => {
    if (!subscription?.id && !subscription?._id) return;
    setSaving(true);
    try {
      await vendorSubscriptionsAPI.update(subscription.id || subscription._id, { custom_domain: domain });
      queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] });
      toast.success(t("subscription.customDomainSaved"));
    } catch (err) {
      toast.error(err.message || t("subscription.customDomainFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!canUseDomain) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-3">
        <Shield className="w-8 h-8 text-slate-400 dark:text-slate-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("subscription.customDomainTitle")}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("subscription.customDomainUpgradeHint")}</p>
        </div>
        <Badge className="ml-auto bg-orange-600 text-white text-xs">Pro+</Badge>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-5 h-5 text-orange-500" />
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{t("subscription.customDomainTitle")}{isElite && " & SSL"}</h4>
        {subscription?.custom_domain ? (
          <Badge className="ml-auto bg-green-100 text-green-700 border-0 text-xs">{t("subscription.domainActive")}</Badge>
        ) : (
          <Badge className="ml-auto bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-0 text-xs">{t("subscription.domainNotConfigured")}</Badge>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        {t("subscription.domainDescription")}
        {isElite && ` ${t("subscription.domainEliteSSL")}`}
      </p>
      <div className="flex gap-2">
        <Input
          value={domain}
          onChange={e => setDomain(e.target.value)}
          placeholder="shop.yourbrand.com"
          className="rounded-xl text-sm"
        />
        <Button onClick={save} disabled={saving || !domain.trim()} className="bg-orange-600 hover:bg-orange-700 rounded-xl shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
        </Button>
      </div>
      {domain && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Add a CNAME record: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-orange-700 dark:text-orange-400">store.iqon.app</code>
        </p>
      )}
    </div>
  );
}

export default function SubscriptionManager({ store, vendorUsername }) {
  const { t } = useTranslation();
  const [billing, setBilling] = useState("monthly");
  const [payingNow, setPayingNow] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [payStep, setPayStep] = useState("method"); // 'method' | 'phone'
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [cancelDialog, setCancelDialog] = useState({ open: false, type: 'active' });
  const [pendingPayment, setPendingPayment] = useState(null); // { reference, method, amount, status: 'pending' | 'failed' | 'cancelled' }
  const queryClient = useQueryClient();
  const { user, checkUserAuth } = useAuth();

  const { data: plansData } = useQuery({
    queryKey: ["publicPlans"],
    queryFn: () => vendorSubscriptionsAPI.getPlans(),
    staleTime: 5 * 60 * 1000,
  });

  const backendPrices = plansData?.plans
    ? {
        free:  { monthly: plansData.plans.free?.price_monthly  ?? 0,     annual: plansData.plans.free?.price_annual  ?? 0 },
        pro:   { monthly: plansData.plans.pro?.price_monthly   ?? 29000, annual: plansData.plans.pro?.price_annual   ?? 23000 },
        elite: { monthly: plansData.plans.elite?.price_monthly ?? 79000, annual: plansData.plans.elite?.price_annual ?? 63000 },
      }
    : null;

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["vendorSubscription", vendorUsername],
    queryFn: async () => {
      const res = await vendorSubscriptionsAPI.list({ vendor_username: vendorUsername });
      const subs = Array.isArray(res) ? res : (res.data || res.subscriptions || []);
      return subs[0] || null;
    },
    enabled: !!vendorUsername,
  });

  const { mutate: verifyPayment } = useMutation({
    mutationFn: async ({ id, reference }) => {
      return vendorSubscriptionsAPI.verifyPayment(id, reference);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] });
      toast.success(t("subscription.paymentVerified"));
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] });
      toast.error(err?.message || t("subscription.paymentVerificationFailed"));
    },
  });

  const { mutate: cancelSubscription, isPending: isCancelling } = useMutation({
    mutationFn: async (id) => {
      return vendorSubscriptionsAPI.cancel(id);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] });
      toast.success(data?.message || t("subscription.cancelledSuccess"));
      setCancelDialog({ open: false, type: 'active' });
    },
    onError: (err) => {
      toast.error(err?.message || t("subscription.cancelFailed"));
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (plan) => {
      const today = new Date();
      const expires = new Date(today);
      expires.setMonth(expires.getMonth() + (billing === "annual" ? 12 : 1));

      const payload = {
        plan: plan.id,
        billing_cycle: billing,
        store_id: store?.id,
        vendor_username: vendorUsername,
      };

      let sub;
      if (subscription?.id || subscription?._id) {
        sub = await vendorSubscriptionsAPI.update(subscription.id || subscription._id, payload);
      } else {
        sub = await vendorSubscriptionsAPI.create(payload);
      }

      if (plan.id === "free") {
        return { sub, needsPayment: false };
      }

      return { sub, needsPayment: true, plan };
    },
    onSuccess: async (data) => {
      if (!data.needsPayment) {
        toast.success(t("subscription.planUpdated", { plan: data.sub.plan }));
        queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] });
      } else {
        const targetPlanId = data.sub.pending_plan || data.plan.id;
        const targetBillingCycle = data.sub.pending_billing_cycle || billing;
        const targetPlanMeta = PLANS.find(p => p.id === targetPlanId) || data.plan;
        const prices = backendPrices?.[targetPlanId];
        const price = targetBillingCycle === "annual"
          ? (prices?.annual ?? targetPlanMeta.priceAnnual) * 12
          : (prices?.monthly ?? targetPlanMeta.price);

        queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] });
try {
           await initializeITECPayPayment({
             amount: price,
             email: user.email,
             phone: user.phone_number,
             order_id: `SUB-${data.sub.id || data.sub._id}`,
             payment_method: 'mtn',
             onSuccess: (res) => {
               verifyPayment({ 
                 id: data.sub.id || data.sub._id, 
                 reference: res.reference 
               });
             }
           });
         } catch (err) {
           toast.error(err.message || t("subscription.paymentInitFailed"));
         }
      }
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');

    // Trigger verification if:
    // - status is 'pending' (first-time or free→paid subscription), OR
    // - pending_plan is set (active paid plan upgrading to a higher tier, e.g. pro→elite)
    const needsVerification =
      subscription?.status === 'pending' || !!subscription?.pending_plan;

    if (reference && needsVerification && (subscription?.id || subscription?._id)) {
      verifyPayment({ 
        id: subscription.id || subscription._id, 
        reference 
      });
      
      // Clean up URL properly
      params.delete('reference');
      params.delete('trxref');
      const search = params.toString() ? `?${params.toString()}` : '';
      window.history.replaceState({}, '', window.location.pathname + search);
    }
  }, [subscription, verifyPayment]);

  // Poll payment status when pending
  useEffect(() => {
    if (!pendingPayment || pendingPayment.status !== 'pending') return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await paymentAPI.itecpay.verify({
          req_ref: pendingPayment.reference,
          provider: pendingPayment.method
        });

        console.log('Payment verification result:', result);

        // Check if payment failed or was cancelled
        // The actual payment status is in data.status, not the top-level status (which is HTTP code)
        const status = result.data?.status || result.status;
        const statusLower = String(status).toLowerCase();

        console.log('Payment status:', statusLower);

        if (statusLower === 'failed' || statusLower === 'cancelled' || statusLower === 'rejected') {
          setPendingPayment(prev => (prev ? { ...prev, status: 'failed' } : prev));
          clearInterval(pollInterval);
          toast.error(t("subscription.paymentVerificationFailed"));
        } else if (statusLower === 'completed' || statusLower === 'success' || statusLower === 'successful' || statusLower === 'paid' || statusLower === 'approved') {
          // Payment successful - verify and close popup
          verifyPayment({
            id: subscription.id || subscription._id,
            reference: pendingPayment.reference
          });
          setPendingPayment(null);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling payment status:', error);
        // Surface the failure immediately instead of leaving the user staring at
        // a spinner forever — let them retry from a clean state.
        setPendingPayment(prev => (prev ? { ...prev, status: 'failed' } : prev));
        clearInterval(pollInterval);
        toast.error(error?.message || t("subscription.paymentVerificationFailed"));
      }
    }, 5000); // Poll every 5 seconds

    // Stop polling after 2 minutes (user likely cancelled or timed out)
    const timeout = setTimeout(() => {
      if (pendingPayment?.status === 'pending') {
        setPendingPayment(prev => ({ ...prev, status: 'failed' }));
        toast.error(t("subscription.paymentVerificationFailed"));
      }
      clearInterval(pollInterval);
    }, 120000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [pendingPayment, subscription, verifyPayment]);

  const currentPlanInfo = PLANS.find(p => p.id === (subscription?.plan || "free"));
  const pendingUpgradePlan = subscription?.pending_plan
    ? PLANS.find(p => p.id === subscription.pending_plan)
    : null;
  const isPending = subscription?.status === "pending" || !!pendingUpgradePlan;

  const PAYMENT_METHODS = [
    { id: 'mtn',    label: 'MTN Mobile Money', logo: '/mtn.jpg',                  mobile: true },
    { id: 'airtel', label: 'Airtel Money',      logo: '/airtelafrica-logo.png',    mobile: true },
    { id: 'card',   label: 'Card Payment',      logo: null, emoji: '💳',           mobile: false },
  ];

  const doInitiatePayment = async (method, phone) => {
    const targetPlanId = subscription.pending_plan || subscription.plan;
    const targetBillingCycle = subscription.pending_billing_cycle || subscription.billing_cycle;
    const plan = PLANS.find(p => p.id === targetPlanId);
    if (!plan) return;
    const bPrices = backendPrices?.[targetPlanId];
    const price = targetBillingCycle === "annual"
      ? (bPrices?.annual ?? plan.priceAnnual) * 12
      : (bPrices?.monthly ?? plan.price);
    setPayModal(false);
    setPayingNow(true);
    try {
      const response = await initializeITECPayPayment({
        amount: price,
        email: user.email,
        phone: phone || undefined,
        order_id: `SUB-${subscription.id || subscription._id}`,
        payment_method: method,
        onSuccess: (res) => {
          if (method !== 'card') {
            toast.success(t("subscription.checkPhonePrompt"));
            // Show pending payment popup
            setPendingPayment({
              reference: res.data?.reference || res.reference,
              method: method,
              amount: price,
              status: 'pending'
            });
          }
        },
      });
    } catch (err) {
      toast.error(err.message || t("subscription.paymentInitFailed"));
    } finally {
      setPayingNow(false);
    }
  };

  const handlePayNow = () => {
    if (payingNow) return;
    setSelectedMethod(null);
    setPhoneInput("");
    setPayStep("method");
    setPayModal(true);
  };

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    if (method.mobile) {
      const savedPhone = user.phone_number || "";
      setPhoneInput(savedPhone);
      setPayStep("phone");
    } else {
      doInitiatePayment(method.id, null);
    }
  };

  const handlePhoneSubmit = async () => {
    const cleaned = phoneInput.trim();
    if (!cleaned || cleaned.length < 9) {
      toast.error(t("subscription.phoneRequired"));
      return;
    }
    setPhoneSaving(true);
    try {
      await authAPI.updateProfile({ phone_number: cleaned });
      // Don't call checkUserAuth here as it may cause page reload
    } catch {
      /* non-fatal — proceed anyway with the entered number */
    } finally {
      setPhoneSaving(false);
    }
    await doInitiatePayment(selectedMethod.id, cleaned);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Current Plan Banner */}
      <div className={`relative rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${subscription?.plan === "elite" ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border border-amber-200 dark:border-amber-800" : subscription?.plan === "pro" ? "bg-gradient-to-r from-orange-50 to-orange-50 dark:from-orange-950 dark:to-orange-950 border border-orange-200 dark:border-orange-800" : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"}`}>
        <div className="flex items-center gap-4">
          {currentPlanInfo && <currentPlanInfo.icon className={`w-8 h-8 shrink-0 ${currentPlanInfo.iconColor}`} />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {t("subscription.onPlan", { name: currentPlanInfo?.name })}
              </p>
              {isPending && (
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 animate-pulse">{t("subscription.pendingPayment")}</Badge>
              )}
            </div>
            {subscription?.expires_at && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subscription.status === 'cancelled'
                  ? t("subscription.expires", { date: new Date(subscription.expires_at).toLocaleDateString() })
                  : t("subscription.renews", { date: new Date(subscription.expires_at).toLocaleDateString() })}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-row sm:flex-col flex-wrap items-end gap-2 sm:ml-auto">
          {subscription?.plan !== "free" && (
            <Badge className={`text-xs border-0 ${subscription?.plan === "elite" ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700"}`}>
              {subscription?.billing_cycle === "annual" ? t("subscription.annual") : t("subscription.monthly")}
            </Badge>
          )}
          {isPending && (
            <Button
              size="sm"
              variant="default"
              disabled={payingNow}
              className="h-9 text-xs font-bold bg-orange-600 hover:bg-orange-700 rounded-lg px-5 shadow-sm shadow-orange-100 min-w-[90px]"
              onClick={handlePayNow}
            >
              {payingNow ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />{t("subscription.processing")}</>
              ) : t("subscription.payNow")}
            </Button>
          )}
          {isPending && (
            <Button
              size="sm"
              variant="outline"
              disabled={isCancelling}
              className="h-9 text-xs font-bold border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-5 min-w-[90px]"
              onClick={() => setCancelDialog({ open: true, type: 'pending' })}
            >
              {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : t("subscription.cancelPending")}
            </Button>
          )}
          {subscription?.status === 'active' && subscription?.plan !== 'free' && !isPending && (
            <Button
              size="sm"
              variant="outline"
              disabled={isCancelling}
              className="h-9 text-xs font-bold border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg px-5 min-w-[90px]"
              onClick={() => setCancelDialog({ open: true, type: 'active' })}
            >
              {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : t("subscription.cancelPlan")}
            </Button>
          )}
          {subscription?.status === 'cancelled' && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs font-bold border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 rounded-lg px-5 min-w-[90px]"
              onClick={() => setPayModal(true)}
            >
              {t("subscription.activatePlan")}
            </Button>
          )}
        </div>
      </div>

      {isPending && (
        <div className="bg-amber-50/50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            <strong>{t("subscription.paymentRequired")}:</strong>{" "}
            {t("subscription.pendingFeatureWarning", { plan: pendingUpgradePlan ? pendingUpgradePlan.name : currentPlanInfo?.name })}{" "}
            {pendingUpgradePlan && (
              <span>{t("subscription.currentPlanMaintained", { current: currentPlanInfo?.name })} </span>
            )}
            {t("subscription.paymentMayTakeMins")}
          </div>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex items-center justify-center flex-wrap gap-3 text-center">
        <span className={`text-sm font-medium ${billing === "monthly" ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>{t("subscription.monthly")}</span>
        <button
          onClick={() => setBilling(b => b === "monthly" ? "annual" : "monthly")}
          className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${billing === "annual" ? "bg-orange-600" : "bg-slate-200 dark:bg-slate-700"}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white dark:bg-slate-200 rounded-full shadow transition-all ${billing === "annual" ? "left-7" : "left-1"}`} />
        </button>
        <span className={`text-sm font-medium ${billing === "annual" ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>
          {t("subscription.annual")} <span className="text-green-600 text-xs font-bold">{t("subscription.save20")}</span>
        </span>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentPlan={subscription}
            billing={billing}
            onSelect={(plan) => subscribeMutation.mutate(plan)}
            prices={backendPrices}
            isPending={subscribeMutation.isPending}
          />
        ))}
      </div>

      {/* Custom Domain */}
      <CustomDomainManager subscription={subscription} vendorUsername={vendorUsername} />

      {/* Feature comparison callout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
        {[
          { icon: TrendingUp, label: t("subscription.prioritySearch"), plans: ["Pro", "Elite"], color: "text-orange-500" },
          { icon: Image, label: t("subscription.unlimitedMedia"), plans: ["Elite"], color: "text-amber-500" },
        ].map(f => {
          const currentIndex = PLANS.findIndex(pl => pl.id === (subscription?.status === "pending" ? "free" : currentPlanInfo?.id));
          const requiredIndex = Math.min(...f.plans.map(p => PLANS.findIndex(pl => pl.name === p)));
          const unlocked = currentIndex >= requiredIndex;
          return (
            <div key={f.label} className="relative bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3 min-w-0">
              {!unlocked && (
                <Lock className="w-3.5 h-3.5 absolute top-2 right-2 text-slate-300 dark:text-slate-600" />
              )}
              <f.icon className={`w-5 h-5 mx-auto mb-1.5 ${unlocked ? f.color : "text-slate-300 dark:text-slate-600"}`} />
              <p className={`text-xs font-semibold ${unlocked ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}>{f.label}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("subscription.onlyPlans", { plans: f.plans.join(", ") })}</p>
            </div>
          );
        })}
      </div>

      {/* Payment Method Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl"
          >
            {payStep === "method" ? (
              <>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  {t("subscription.choosePaymentMethod")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  {t("subscription.choosePaymentMethodDesc")}
                </p>
                <div className="space-y-2 mb-4">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleMethodSelect(m)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950 transition-all text-left"
                    >
                      {m.logo
                        ? <img src={m.logo} alt={m.label} className="w-10 h-10 object-contain rounded-lg" />
                        : <span className="text-2xl w-10 text-center">{m.emoji}</span>
                      }
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">{m.label}</span>
                    </button>
                  ))}
                </div>
                <Button variant="outline" className="w-full rounded-xl" onClick={() => setPayModal(false)}>
                  {t("common.cancel")}
                </Button>
              </>
            ) : (
              <>
                <button
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mb-3"
                  onClick={() => setPayStep("method")}
                >
                  ← {t("common.back")}
                </button>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                  {selectedMethod?.logo
                    ? <img src={selectedMethod.logo} alt={selectedMethod.label} className="w-7 h-7 object-contain rounded" />
                    : <span>{selectedMethod?.emoji}</span>
                  }
                  {selectedMethod?.label}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  {t("subscription.phoneModalDesc")}
                </p>

                {/* Payment Information */}
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900 rounded-xl p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
                      <p className="font-semibold mb-1">{t("subscription.paymentProcessTitle")}</p>
                      <p>{t("subscription.paymentProcessDesc")}</p>
                    </div>
                  </div>
                </div>

                {/* ITEC Pay Branding */}
                <div className="flex items-center justify-center gap-2 mb-4 text-xs text-slate-400 dark:text-slate-500">
                  <span>{t("subscription.poweredBy")}</span>
                  <span className="font-bold text-slate-600 dark:text-slate-400">ITEC Pay</span>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handlePhoneSubmit(); }}>
                  <Input
                    type="tel"
                    placeholder="+250 7XX XXX XXX"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    className="rounded-xl mb-3 text-sm"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => setPayModal(false)}
                      disabled={phoneSaving || payingNow}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-700"
                      disabled={phoneSaving || payingNow || phoneInput.trim().length < 9}
                    >
                      {phoneSaving || payingNow
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />{t("subscription.processing")}</>
                        : t("subscription.continueToPayment")}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Pending Payment Popup */}
      {pendingPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="text-center">
              {pendingPayment.status === 'pending' ? (
                <>
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {t("subscription.paymentPendingTitle")}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {t("subscription.paymentPendingDesc")}
                  </p>
                  <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900 rounded-xl p-3 mb-4 text-left">
                    <div className="text-xs text-orange-700 dark:text-orange-300">
                      <p className="font-semibold mb-1">{t("subscription.paymentInstructionsTitle")}</p>
                      <p>{t("subscription.paymentInstructionsDesc")}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => setPendingPayment(null)}
                    >
                      {t("common.close")}
                    </Button>
                    <Button
                      className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-700"
                      onClick={() => {
                        verifyPayment({
                          id: subscription.id || subscription._id,
                          reference: pendingPayment.reference
                        });
                        setPendingPayment(null);
                      }}
                    >
                      {t("subscription.checkStatus")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {t("subscription.paymentFailedTitle")}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {t("subscription.paymentFailedDesc")}
                  </p>
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl p-3 mb-4 text-left">
                    <div className="text-xs text-red-700 dark:text-red-300">
                      <p className="font-semibold mb-1">{t("subscription.paymentFailedReasonTitle")}</p>
                      <p>{t("subscription.paymentFailedReasonDesc")}</p>
                    </div>
                  </div>
                  <Button
                    className="w-full rounded-xl bg-orange-600 hover:bg-orange-700"
                    onClick={() => setPendingPayment(null)}
                  >
                    {t("subscription.tryAgain")}
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancelDialog.type === 'pending'
                ? t("subscription.cancelPendingTitle")
                : t("subscription.cancelPlanTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelDialog.type === 'pending'
                ? t("subscription.cancelPendingDesc")
                : t("subscription.cancelPlanDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isCancelling}
              onClick={() => {
                if (subscription?.id || subscription?._id) {
                  cancelSubscription(subscription.id || subscription._id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCancelling ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {t("subscription.confirmCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
