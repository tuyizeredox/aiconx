import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatCurrency, isGuestBuyer } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { initializeITECPayPayment } from "@/lib/itecpay";
import { checkoutAPI, paymentAPI } from "@/api/apiClient";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";
import RadioOptionCard from "@/components/shared/RadioOptionCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  CreditCard,
  MessageCircle,
  Calendar,
  Store,
  XCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  User,
  Navigation,
  Info,
  Palette,
  Loader2,
  ChevronLeft,
  Smartphone
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OrderTrackingPanel from "./OrderTrackingPanel";

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "bg-amber-100 text-amber-700", label: "Pending" },
  confirmed: { icon: CheckCircle2, color: "bg-orange-100 text-orange-700", label: "Confirmed" },
  processing: { icon: Package, color: "bg-orange-100 text-orange-700", label: "Processing" },
  shipped: { icon: Truck, color: "bg-purple-100 text-purple-700", label: "Shipped" },
  delivered: { icon: CheckCircle2, color: "bg-green-100 text-green-700", label: "Delivered" },
  cancelled: { icon: XCircle, color: "bg-red-100 text-red-700", label: "Cancelled" },
  refunded: { icon: AlertCircle, color: "bg-gray-100 text-gray-700", label: "Refunded" },
};

const POSSIBLE_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];

export default function OrderDetailModal({ 
  order, 
  open, 
  onOpenChange, 
  onBuyAgain, 
  onContactVendor, 
  onContactBuyer,
  onUpdateStatus,
  userRole = "buyer" 
}) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  // 'method' -> choosing mtn/airtel/card, 'phone' -> entering mobile money number,
  // 'pending' -> waiting for the buyer to confirm on their phone
  const [payStep, setPayStep] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [retryPhone, setRetryPhone] = useState(currentUser?.phone_number || "");
  const [pendingPayment, setPendingPayment] = useState(null); // { reference, method }

  const orderId = order ? String(order._id || order.id) : null;

  const initiateMutation = useMutation({
    mutationFn: async ({ method, phone }) => {
      if (method === 'card') {
        // PaymentSuccess.jsx picks this up when the gateway redirects back.
        localStorage.setItem('pending_order_ids', JSON.stringify([orderId]));
      }
      let result = null;
      await initializeITECPayPayment({
        amount: order.total,
        email: currentUser?.email,
        phone: phone || undefined,
        order_id: orderId,
        payment_method: method,
        onSuccess: (res) => { result = res; },
      });
      return { method, response: result };
    },
    onSuccess: ({ method, response }) => {
      if (method === 'card') return; // browser is navigating to the hosted payment page
      const reference = response?.data?.reference || response?.reference;
      if (!reference) {
        toast.error("Failed to start payment. Please try again.");
        setPayStep('method');
        return;
      }
      toast.success("Payment request sent — check your phone to confirm.");
      setPendingPayment({ reference, method });
      setPayStep('pending');
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start payment. Please try again.");
      setPayStep('method');
    },
  });

  const handleSelectMethod = (method) => {
    setSelectedMethod(method);
    if (method.mobile) {
      setPayStep('phone');
    } else {
      initiateMutation.mutate({ method: method.id, phone: null });
    }
  };

  const handlePhoneSubmit = () => {
    if (!retryPhone.trim()) return;
    initiateMutation.mutate({ method: selectedMethod.id, phone: retryPhone });
  };

  const resetPayFlow = () => {
    setPayStep(null);
    setSelectedMethod(null);
    setPendingPayment(null);
  };

  // Poll for confirmation after a mobile money prompt is sent, mirroring the
  // Checkout page's flow — then flip the order to paid via the same
  // single-order verify endpoint checkout uses for existing orders.
  useEffect(() => {
    if (!pendingPayment) return;
    let stopped = false;

    const finish = (fn) => {
      if (stopped) return;
      stopped = true;
      clearInterval(poll);
      clearTimeout(timeout);
      fn();
    };

    const poll = setInterval(async () => {
      try {
        const result = await paymentAPI.itecpay.verify({
          req_ref: pendingPayment.reference,
          provider: pendingPayment.method,
        });
        const status = String(result.data?.status || result.status || '').toLowerCase();

        if (['completed', 'success', 'successful', 'paid', 'approved'].includes(status)) {
          finish(async () => {
            try {
              await checkoutAPI.verifyPayment(orderId, pendingPayment.reference);
              toast.success("Payment confirmed! Your order is now paid.");
              queryClient.invalidateQueries({ queryKey: ["myOrders"] });
              resetPayFlow();
              onOpenChange(false);
            } catch (err) {
              toast.error(err.message || "We couldn't confirm your payment. Please try again.");
              resetPayFlow();
            }
          });
        } else if (['failed', 'cancelled', 'rejected'].includes(status)) {
          finish(() => {
            toast.error("Payment was cancelled or failed. Please try again.");
            setPendingPayment(null);
            setPayStep('method');
          });
        }
      } catch (err) {
        finish(() => {
          toast.error(err.message || "We couldn't confirm your payment. Please try again.");
          setPendingPayment(null);
          setPayStep('method');
        });
      }
    }, 5000);

    const timeout = setTimeout(() => {
      finish(() => {
        toast.error("Payment confirmation timed out. Please try again.");
        setPendingPayment(null);
        setPayStep('method');
      });
    }, 120000);

    return () => {
      stopped = true;
      clearInterval(poll);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayment]);

  if (!order) return null;

  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;
  const isVendor = userRole === "vendor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 gap-0 grid-cols-1">
        <DialogHeader className="min-w-0 p-6 pr-10 pb-4 bg-slate-50/50 dark:bg-ink-800/50 sticky top-0 z-10 backdrop-blur-md border-b dark:border-ink-700">
          <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
            <Badge className={`${status.color} border-0 flex items-center gap-1.5 shrink-0`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </Badge>
            <p className="text-xs text-slate-400 font-mono truncate min-w-0">#{order._id?.slice(-12)}</p>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Order Details</DialogTitle>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500 dark:text-ink-400">
            <div className="flex items-center gap-1 font-medium shrink-0">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(order.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-1 font-medium min-w-0">
              {isVendor ? (
                <>
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Buyer: {order.buyer_name || `@${order.buyer_username}`}</span>
                </>
              ) : (
                <>
                  <Store className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{order.store_name}</span>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="min-w-0 p-6 space-y-8">
          {/* Payment Failed */}
          {!isVendor && order.payment_status === 'failed' && (
            <section className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-red-900 dark:text-red-300 mb-1">Payment Failed</h3>
                  <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                    Your payment for this order didn't go through, so it's on hold until payment is completed.
                  </p>

                  {!payStep && (
                    <Button
                      size="sm"
                      onClick={() => setPayStep('method')}
                      className="mt-3 bg-red-600 hover:bg-red-700 text-white rounded-xl gap-2 h-9"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Pay Again
                    </Button>
                  )}

                  {payStep === 'method' && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-700/70 dark:text-red-400/70">
                        Choose a payment method
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {PAYMENT_METHODS.map(method => (
                          <RadioOptionCard
                            key={method.id}
                            selected={selectedMethod?.id === method.id}
                            disabled={initiateMutation.isPending}
                            onSelect={() => handleSelectMethod(method)}
                            iconImg={method.logo}
                            iconEmoji={method.emoji}
                            title={method.label}
                            subtitle={method.mobile ? "Mobile money" : "Visa / Mastercard"}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={resetPayFlow}
                        className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {payStep === 'phone' && (
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => setPayStep('method')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400 hover:underline"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Change method
                      </button>
                      <div className="flex items-center gap-2">
                        <Input
                          type="tel"
                          value={retryPhone}
                          onChange={(e) => setRetryPhone(e.target.value)}
                          placeholder="e.g. 078xxxxxxx"
                          className="flex-1 min-w-0 h-10 rounded-xl border-red-200 dark:border-red-800 bg-white dark:bg-ink-800 text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={handlePhoneSubmit}
                          disabled={!retryPhone.trim() || initiateMutation.isPending}
                          className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-10 shrink-0"
                        >
                          {initiateMutation.isPending ? "Sending..." : "Send"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {payStep === 'pending' && (
                    <div className="mt-3 flex items-center gap-2 text-red-700 dark:text-red-400">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span className="text-xs font-medium">Waiting for confirmation on your phone…</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Vendor Status Management */}
          {isVendor && (
            <section className="bg-orange-50/30 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-orange-900 dark:text-orange-300 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Manage Order Status
              </h3>
              <div className="flex items-center gap-3">
                <Select 
                  value={order.status} 
                  onValueChange={(newStatus) => onUpdateStatus?.(order._id || order.id, newStatus)}
                >
                  <SelectTrigger className="flex-1 bg-white dark:bg-ink-700 rounded-xl h-11 border-orange-100 dark:border-orange-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSSIBLE_STATUSES.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge className={`${status.color} border-0 h-11 px-4 rounded-xl flex items-center gap-2 text-xs`}>
                  Current: {status.label}
                </Badge>
              </div>
            </section>
          )}

          {/* Status Tracker — only for shipped/shipping orders, not pickup */}
          {["pending", "processing", "shipped", "delivered", "confirmed"].includes(order.status) && order.delivery_method !== "pickup" && (
            <div className="bg-white dark:bg-ink-800 border dark:border-ink-700 rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                {order.delivery_method === "delivery" ? (
                  <Navigation className="w-4 h-4 text-orange-600" />
                ) : (
                  <Truck className="w-4 h-4 text-orange-600" />
                )}
                {order.delivery_method === "delivery" ? "Delivery Status" : "Tracking Status"}
              </h3>
              <OrderTrackingPanel order={order} />
            </div>
          )}

          {/* Pickup status info */}
          {order.delivery_method === "pickup" && ["pending", "confirmed", "processing"].includes(order.status) && order.pickup_instructions && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4">
              <Package className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider mb-1">Pickup Instructions</p>
                <p className="text-xs text-amber-700 leading-relaxed">{order.pickup_instructions}</p>
              </div>
            </div>
          )}

          {/* Items Section */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-600" />
              Items ({order.items?.length})
            </h3>
            <div className="space-y-4">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex gap-4 p-2 hover:bg-slate-50 dark:hover:bg-ink-700/50 rounded-2xl transition-colors">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-ink-700 overflow-hidden shrink-0 border border-slate-100 dark:border-ink-600">
                    {item.product_image ? (
                      <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.product_title}</p>
                    <p className="text-xs text-slate-500 dark:text-ink-400 mt-0.5">
                      {item.quantity} x {formatCurrency(item.price)}
                    </p>
                    {(item.selected_color || item.selected_size || item.selected_options?.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.selected_color && (
                          <Badge variant="secondary" className="w-fit text-[10px] px-1.5 py-0 gap-1">
                            <Palette className="w-2.5 h-2.5" />
                            {item.selected_color}
                          </Badge>
                        )}
                        {item.selected_size && (
                          <Badge variant="secondary" className="w-fit text-[10px] px-1.5 py-0">
                            Size: {item.selected_size}
                          </Badge>
                        )}
                        {item.selected_options?.map((opt) => (
                          <Badge key={opt.name} variant="secondary" className="w-fit text-[10px] px-1.5 py-0">
                            {opt.name}: {opt.value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                    {formatCurrency(item.quantity * item.price)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator className="bg-slate-100 dark:bg-ink-700" />

          {/* Summary and Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-w-0">
            <section className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-orange-600" />
                Payment Info
              </h3>
              <div className="space-y-3 bg-slate-50/50 dark:bg-ink-700/50 p-4 rounded-2xl border border-slate-100 dark:border-ink-600 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs min-w-0">
                  <span className="text-slate-500 dark:text-ink-400 shrink-0">Method</span>
                  <span className="font-medium text-slate-900 dark:text-white capitalize truncate min-w-0 text-right">{order.payment_method?.replace('_', ' ') || 'Card'}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs min-w-0">
                  <span className="text-slate-500 dark:text-ink-400 shrink-0">Status</span>
                  <Badge variant="outline" className={`text-[10px] h-5 capitalize px-1.5 shrink-0 ${
                    order.payment_status === 'paid' ? 'bg-green-50 text-green-700 border-green-100' :
                    order.payment_status === 'failed' ? 'bg-red-50 text-red-700 border-red-100' :
                    'bg-amber-50 text-amber-700 border-amber-100'
                  }`}>
                    {order.payment_status}
                  </Badge>
                </div>
                <div className="pt-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-900 dark:text-white border-t border-slate-200/60 dark:border-ink-600 min-w-0">
                  <span className="shrink-0">Total Amount</span>
                  <span className="truncate min-w-0 text-right">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </section>

            <section className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                {order.delivery_method === "pickup" ? (
                  <Package className="w-4 h-4 text-orange-600" />
                ) : order.delivery_method === "delivery" ? (
                  <Navigation className="w-4 h-4 text-orange-600" />
                ) : (
                  <MapPin className="w-4 h-4 text-orange-600" />
                )}
                {order.delivery_method === "pickup" ? "Store Pickup" : order.delivery_method === "delivery" ? "Local Delivery" : "Delivery Address"}
              </h3>
              <div className="bg-slate-50/50 dark:bg-ink-700/50 p-4 rounded-2xl border border-slate-100 dark:border-ink-600 h-full min-h-[100px] flex flex-col gap-3">
                {order.delivery_method === "pickup" ? (
                  <>
                    {order.pickup_instructions && (
                      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl p-3">
                        <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 leading-relaxed">{order.pickup_instructions}</p>
                      </div>
                    )}
                    {order.shipping_address && (
                      <p className="text-xs text-slate-600 dark:text-ink-400 leading-relaxed">{order.shipping_address}</p>
                    )}
                    {!order.pickup_instructions && !order.shipping_address && (
                      <p className="text-xs text-slate-500 dark:text-ink-400">Collect from store location</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-ink-400 leading-relaxed flex-1">
                    {order.shipping_address || "No address provided"}
                  </p>
                )}
                {order.delivery_method && (
                  <div className="mt-auto">
                    <Badge variant="secondary" className={`text-[10px] capitalize font-medium ${
                      order.delivery_method === "pickup" ? "bg-amber-100 text-amber-700" :
                      order.delivery_method === "delivery" ? "bg-orange-100 text-orange-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {order.delivery_method === "pickup" ? "Store Pickup" : order.delivery_method === "delivery" ? "Local Delivery" : "Shipping"}
                    </Badge>
                  </div>
                )}
              </div>
            </section>
          </div>

          {order.order_note && (
            <section className="bg-amber-50/50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-800/30">
              <h4 className="text-xs font-bold text-amber-900 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertCircle className="w-3.5 h-3.5" />
                Customer Note
              </h4>
              <p className="text-xs text-amber-700 leading-relaxed italic">
                "{order.order_note}"
              </p>
            </section>
          )}

          <div className="flex flex-col gap-3 pt-4">
            {isVendor ? (
              // A QR counter sale has no account behind it, so there is no chat
              // thread to open — the number the shopper paid with is the only
              // way to reach them.
              isGuestBuyer(order.buyer_username) ? (
                <a
                  href={`tel:${order.buyer_phone || ""}`}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl gap-2 h-12 font-semibold shadow-lg shadow-orange-100 inline-flex items-center justify-center text-sm"
                >
                  <Smartphone className="w-4 h-4" />
                  Call {order.buyer_phone || "buyer"}
                </a>
              ) : (
                <Button 
                  onClick={() => onContactBuyer?.(order.buyer_username)}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl gap-2 h-12 font-semibold shadow-lg shadow-orange-100"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat with Buyer
                </Button>
              )
            ) : (
              <>
                <Button 
                  onClick={() => onContactVendor?.(order.vendor_username)}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl gap-2 h-12 font-semibold shadow-lg shadow-orange-100"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contact Vendor
                </Button>
                {order.status === 'delivered' && (
                  <Button 
                    variant="outline" 
                    onClick={() => onBuyAgain?.(order)}
                    className="w-full rounded-xl gap-2 border-slate-200 dark:border-ink-600 h-12 font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition-all"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Buy Again
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
