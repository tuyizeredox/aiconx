import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import EmptyState from "@/components/shared/EmptyState";
import { Minus, Plus, Trash2, ArrowLeft, CreditCard, Loader2, ShoppingBag, Tag, X, CheckCircle2, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

import { cartAPI, couponsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { getGuestCart, updateGuestCartQty, removeFromGuestCart, clearGuestCart } from "@/lib/guestCart";

export default function Cart() {
  const { t } = useTranslation();
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [guestCartItems, setGuestCartItems] = useState(() => getGuestCart());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { user: currentUser } = useAuth();

  const { data: cartResponse = {}, isLoading: cartLoading } = useQuery({
    queryKey: ["cart", currentUser?.username],
    queryFn: async () => {
      const res = await cartAPI.get();
      return res;
    },
    enabled: !!currentUser?.username,
  });

  const isLoading = !!currentUser && cartLoading;

  const serverCartItems = Array.isArray(cartResponse?.items) ? cartResponse.items : [];
  const cartItems = currentUser
    ? serverCartItems
    : guestCartItems.map((item) => ({ ...item, id: item.product_id }));

  const updateQuantityMutation = useMutation({
    mutationFn: ({ id, quantity }) => {
      if (!currentUser) {
        setGuestCartItems(quantity <= 0 ? removeFromGuestCart(id) : updateGuestCartQty(id, quantity));
        return Promise.resolve();
      }
      if (quantity <= 0) return cartAPI.remove(id);
      return cartAPI.update(id, { quantity });
    },
    onSuccess: () => {
      if (currentUser) queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (id) => {
      if (!currentUser) {
        setGuestCartItems(removeFromGuestCart(id));
        return Promise.resolve();
      }
      return cartAPI.remove(id);
    },
    onSuccess: () => {
      if (currentUser) queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: () => {
      if (!currentUser) {
        clearGuestCart();
        setGuestCartItems([]);
        return Promise.resolve();
      }
      return cartAPI.clear();
    },
    onSuccess: () => {
      if (currentUser) queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success(t("cart.cleared"));
    },
    onError: () => {
      toast.error(t("cart.clearFailed"));
    },
  });

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    setCouponError("");
    try {
      const coupon = await couponsAPI.check(couponCode.trim().toUpperCase());
      if (!coupon) { setCouponError(t("cart.invalidOrExpiredCoupon")); return; }
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) { setCouponError(t("cart.couponExpired")); return; }
      if (coupon.max_uses > 0 && coupon.uses_count >= coupon.max_uses) { setCouponError(t("cart.couponUsageLimitReached")); return; }
      const sub = cartItems.reduce((s, i) => s + (i.product_price || 0) * (i.quantity || 1), 0);
      if (coupon.min_order_amount > 0 && sub < coupon.min_order_amount) {
        setCouponError(t("cart.couponMinOrder", { amount: formatCurrency(coupon.min_order_amount) })); return;
      }
      setAppliedCoupon(coupon);
      const discountStr = coupon.discount_type === "percentage"
        ? `${coupon.discount_value}% ${t("shop.off")}`
        : `${formatCurrency(coupon.discount_value)} ${t("shop.off")}`;
      toast.success(t("cart.couponAppliedToast", { discount: discountStr }));
    } catch (e) {
      setCouponError(t("cart.invalidCoupon"));
    } finally {
      setCheckingCoupon(false);
    }
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponCode(""); setCouponError(""); };

  const handlePayNow = () => {
    if (cartItems.length === 0) return;
    navigate(createPageUrl("Checkout") + "?quickpay=true");
  };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price || 0) * (item.quantity || 1), 0);
  const discount = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? subtotal * (appliedCoupon.discount_value / 100)
      : Math.min(appliedCoupon.discount_value, subtotal)
    : 0;
  const discountedSubtotal = subtotal - discount;
  const shipping = discountedSubtotal > 50 ? 0 : 5.99;
  const total = discountedSubtotal + shipping;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link
        to={createPageUrl("Marketplace")}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 sm:mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t("common.continueShopping")}
      </Link>

      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mb-6 sm:mb-8 tracking-tight">
        {t("cart.title")} ({cartItems.length})
      </h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl p-4 animate-pulse flex gap-4 border border-slate-100 dark:border-slate-800">
              <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-1/4 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : cartItems.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={t("cart.empty")}
          description={t("cart.emptyDescription")}
          action={
            <Link to={createPageUrl("Marketplace")}>
              <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl font-bold">{t("cart.browseProducts")}</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            <AnimatePresence>
              {cartItems.map((item) => (
                <motion.div
                  key={item._id || item.id}
                  layout
                  exit={{ opacity: 0, x: -100 }}
                  className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors"
                >
                  <button
                    onClick={() => removeItemMutation.mutate(item._id || item.id)}
                    className="absolute top-3 right-3 sm:static sm:order-3 sm:shrink-0 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex gap-3 sm:gap-4 min-w-0">
                    <Link
                      to={createPageUrl("ProductDetail") + `?id=${item.product_id}`}
                      className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0"
                    >
                      {item.product_image && (
                        <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                      )}
                    </Link>

                    <div className="flex-1 min-w-0 pr-8 sm:pr-0 flex flex-col justify-center">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.product_title}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{item.store_name}</p>
                      <p className="text-base font-bold text-orange-600 dark:text-orange-400">
                        {formatCurrency(item.product_price)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden self-start sm:self-auto sm:shrink-0">
                    <button
                      onClick={() => updateQuantityMutation.mutate({ id: item._id || item.id, quantity: (item.quantity || 1) - 1 })}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                      {item.quantity || 1}
                    </span>
                    <button
                      onClick={() => updateQuantityMutation.mutate({ id: item._id || item.id, quantity: (item.quantity || 1) + 1 })}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-6 lg:sticky lg:top-6 transition-colors">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                {t("cart.orderSummary")}
              </h3>

              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t("cart.subtotal")}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(subtotal)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> {t("cart.discount", { code: appliedCoupon.code })}
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">-{formatCurrency(discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t("cart.shipping")}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {shipping === 0 ? t("product.freeShipping") : formatCurrency(shipping)}
                  </span>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between text-base">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{t("common.total")}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Coupon */}
              <div className="space-y-3 mb-5">
                {cartItems.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(t("cart.clearCartConfirm"))) {
                        clearCartMutation.mutate();
                      }
                    }}
                    disabled={clearCartMutation.isPending}
                    className="w-full rounded-xl text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {t("cart.clearCart")}
                  </Button>
                )}
                {appliedCoupon ? (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-sm text-green-700 dark:text-green-400 font-semibold flex-1">
                      {t("cart.couponCodeApplied", { code: appliedCoupon.code })}
                    </span>
                    <button
                      onClick={removeCoupon}
                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("cart.couponPlaceholder")}
                        value={couponCode}
                        onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                        onKeyDown={e => e.key === "Enter" && applyCoupon()}
                        className="rounded-xl font-mono text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <Button
                        variant="outline"
                        onClick={applyCoupon}
                        disabled={checkingCoupon || !couponCode.trim()}
                        className="shrink-0 rounded-xl px-3 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {checkingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : t("cart.applyCoupon")}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 flex items-center gap-1">
                        <X className="w-3 h-3" />{couponError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handlePayNow}
                disabled={cartItems.length === 0}
                className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-base font-bold shadow-lg shadow-orange-200/50 dark:shadow-orange-900/30 mb-2 transition-colors"
              >
                <Zap className="w-4 h-4 mr-2" /> {t("cart.payNow")}
              </Button>

              <Button
                onClick={() => navigate(createPageUrl("Checkout"))}
                disabled={cartItems.length === 0}
                variant="outline"
                className="w-full h-11 rounded-xl text-sm font-semibold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <CreditCard className="w-4 h-4 mr-2" /> {t("cart.proceedToCheckout")}
              </Button>

              {subtotal < 50 && (
                <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-3">
                  {t("cart.freeShippingProgress", { amount: formatCurrency(50 - subtotal) })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
