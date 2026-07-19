import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Search, Truck, CheckCircle2, Clock, MapPin,
  ChevronDown, ChevronUp, ShoppingBag, AlertCircle, XCircle, Flag, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/shared/EmptyState";
import { ordersAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import BackLink from "@/components/shared/BackLink";

const TRACKING_STEPS = [
  { key: "pending",    icon: Clock },
  { key: "confirmed",  icon: CheckCircle2 },
  { key: "processing", icon: Package },
  { key: "shipped",    icon: Truck },
  { key: "delivered",  icon: MapPin },
];

const STATUS_ORDER = ["pending", "confirmed", "processing", "shipped", "delivered"];

function getStepIndex(status) {
  const idx = STATUS_ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

function TrackingTimeline({ status }) {
  const { t } = useTranslation();
  const currentIndex = getStepIndex(status);
  const isCancelled = status === "cancelled" || status === "refunded";

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-2xl">
        <XCircle className="w-6 h-6 text-red-500 shrink-0" />
        <div>
          <p className="font-semibold text-red-700 dark:text-red-400 text-sm capitalize">{status}</p>
          <p className="text-xs text-red-500">{t("orderTracking.orderCancelled", { status })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {TRACKING_STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isPending = i > currentIndex;
        const StepIcon = step.icon;
        const isLast = i === TRACKING_STEPS.length - 1;

        return (
          <div key={step.key} className="flex gap-4">
            {/* Icon + line */}
            <div className="flex flex-col items-center">
              <motion.div
                initial={isCurrent ? { scale: 0.8 } : {}}
                animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 ${
                  isDone
                    ? "bg-orange-600 text-white"
                    : isCurrent
                    ? "bg-orange-600 text-white ring-4 ring-orange-100"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                }`}
              >
                <StepIcon className="w-4 h-4" />
              </motion.div>
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[28px] my-1 rounded-full transition-colors duration-500 ${
                  isDone ? "bg-orange-600" : "bg-slate-200 dark:bg-slate-700"
                }`} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-5 flex-1 ${isLast ? "" : ""}`}>
              <div className="flex items-center gap-2 mt-1.5">
                <p className={`text-sm font-semibold ${isPending ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"}`}>
                  {t(`orderTracking.steps.${step.key}.label`)}
                </p>
                {isCurrent && (
                  <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {t("orderTracking.current")}
                  </span>
                )}
              </div>
              <p className={`text-xs mt-0.5 ${isPending ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>
                {t(`orderTracking.steps.${step.key}.desc`)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeliveryConfirmation({ order }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  const confirmMutation = useMutation({
    mutationFn: () => ordersAPI.confirmDelivery(order.id || order._id),
    onSuccess: () => {
      toast.success(t("orderTracking.confirmSuccess"));
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
    },
    onError: (err) => toast.error(err.message || t("common.error")),
  });

  const disputeMutation = useMutation({
    mutationFn: () => ordersAPI.disputeDelivery(order.id || order._id, reason.trim()),
    onSuccess: () => {
      toast.success(t("orderTracking.disputeSuccess"));
      setReporting(false);
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
    },
    onError: (err) => toast.error(err.message || t("common.error")),
  });

  if (order.status !== "delivered") return null;

  if (order.buyer_confirmation_status === "confirmed") {
    return (
      <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-xl flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
        <p className="text-xs text-green-700 dark:text-green-400">{t("orderTracking.confirmedBanner")}</p>
      </div>
    );
  }
  if (order.buyer_confirmation_status === "disputed") {
    return (
      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-xl flex items-center gap-2">
        <Flag className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400">{t("orderTracking.disputedBanner")}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950 rounded-xl">
      <p className="text-xs font-medium text-orange-900 dark:text-orange-300 mb-2">{t("orderTracking.confirmPrompt")}</p>
      {!reporting ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700 rounded-lg text-xs h-8 flex-1"
          >
            {confirmMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t("orderTracking.confirmReceipt")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReporting(true)}
            className="rounded-lg text-xs h-8 flex-1"
          >
            {t("orderTracking.reportProblem")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("orderTracking.disputeReasonPlaceholder")}
            className="text-xs h-20"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (!reason.trim()) { toast.error(t("orderTracking.reasonRequired")); return; }
                disputeMutation.mutate();
              }}
              disabled={disputeMutation.isPending}
              className="rounded-lg text-xs h-8 flex-1"
            >
              {disputeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t("orderTracking.submitReport")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReporting(false)} className="rounded-lg text-xs h-8">
              {t("orderTracking.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderTrackCard({ order, defaultExpanded = false }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const statusColors = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-orange-100 text-orange-700",
    processing: "bg-orange-100 text-orange-700",
    shipped: "bg-purple-100 text-purple-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    refunded: "bg-gray-100 text-gray-700",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
      >
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
          {order.items?.[0]?.product_image && (
            <img src={order.items[0].product_image} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 dark:text-slate-500">#{order.id?.slice(-8)} · {new Date(order.created_at || order.created_date).toLocaleDateString()}</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{order.store_name || "Store"}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("orderTracking.itemCount", { count: order.items?.length || 0 })} · <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(order.total)}</span></p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge className={`${statusColors[order.status] || statusColors.pending} border-0 text-xs capitalize`}>
            {order.status}
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded tracking */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-slate-50 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-4 mb-4">{t("orderTracking.shippingProgress")}</p>
              <TrackingTimeline status={order.status} />
              <DeliveryConfirmation order={order} />

              {order.tracking_number && (
                <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950 rounded-xl">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("orderTracking.trackingNumber")}</p>
                  <p className="text-sm font-bold text-orange-700 dark:text-orange-400 font-mono">{order.tracking_number}</p>
                </div>
              )}

              {order.shipping_address && (
                <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                  <span>{order.shipping_address}</span>
                </div>
              )}

              {/* Items */}
              <div className="mt-4 space-y-2">
                {order.items?.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                      {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{item.product_title}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{t("orderTracking.qty", { qty: item.quantity })} · {formatCurrency(item.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function OrderTracking() {
  const { t } = useTranslation();
  const [searchId, setSearchId] = useState("");
  const [searchedOrder, setSearchedOrder] = useState(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const { user: currentUser } = useAuth();

  const { data: myOrdersData, isLoading } = useQuery({
    queryKey: ["myOrders", currentUser?.username],
    queryFn: async () => {
      const res = await ordersAPI.list({ buyer_username: currentUser?.username, sort: "-created_at", limit: 20 });
      return res;
    },
    enabled: !!currentUser?.username,
  });

  const myOrders = Array.isArray(myOrdersData) 
    ? myOrdersData 
    : (Array.isArray(myOrdersData?.data) ? myOrdersData.data : []);

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setSearching(true);
    setNotFound(false);
    setSearchedOrder(null);
    try {
      // Direct get by ID first
      try {
        const found = await ordersAPI.get(searchId.trim());
        if (found) {
          setSearchedOrder(found);
          return;
        }
      } catch (e) {
        // Fallback to searching in list if ID is short
        const res = await ordersAPI.list({ limit: 200 });
        const all = Array.isArray(res) ? res : (res?.data || []);
        const found = all.find(o => o.id === searchId.trim() || o.id?.slice(-8) === searchId.trim());
        if (found) setSearchedOrder(found);
        else setNotFound(true);
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <BackLink to="Settings" label={t("common.backTo", { page: t("nav.settings") })} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{t("orderTracking.title")}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t("orderTracking.subtitle")}</p>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-8">
        <Input
          value={searchId}
          onChange={e => setSearchId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder={t("orderTracking.placeholder")}
          className="rounded-xl border-slate-200 dark:border-slate-700"
        />
        <Button
          onClick={handleSearch}
          disabled={searching || !searchId.trim()}
          className="bg-orange-600 hover:bg-orange-700 rounded-xl px-4 shrink-0"
        >
          {searching ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Search className="w-4 h-4" />
            </motion.div>
          ) : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {/* Search result */}
      <AnimatePresence>
        {searchedOrder && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{t("orderTracking.searchResult")}</p>
            <OrderTrackCard order={searchedOrder} defaultExpanded={true} />
          </div>
        )}
        {notFound && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mb-8 p-4 bg-red-50 dark:bg-red-950 rounded-2xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{t("orderTracking.notFound")}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent orders */}
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          {currentUser ? t("orderTracking.recentOrders") : t("orderTracking.signInToSee")}
        </p>
        {isLoading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 animate-pulse flex gap-3">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-40 bg-slate-100 dark:bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : myOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={t("orderTracking.noOrders")}
            description={t("orderTracking.noOrdersDesc")}
            action={
              <Link to={createPageUrl("Marketplace")}>
                <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl">{t("orderTracking.browseMarketplace")}</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {myOrders.map(order => (
              <OrderTrackCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
