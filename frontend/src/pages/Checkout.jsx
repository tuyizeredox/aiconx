import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import {
  ArrowLeft, Shield, Truck,
  MapPin, CheckCircle2, Loader2,
  Info, Plus, Trash2, Tag,
  ChevronDown, ChevronRight, Store as StoreIcon,
  Package, Navigation, AlertCircle, Smartphone, Clock, RotateCcw,
  BadgeCheck, Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cartAPI, checkoutAPI, authAPI, couponsAPI, shippingZonesAPI, storesAPI, paymentAPI, ordersAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/utils";
import { initializeITECPayPayment } from "@/lib/itecpay";
import { motion } from "framer-motion";

const FULFILLMENT_ICONS = {
  shipping: Truck,
  delivery: Navigation,
  pickup: Package,
};

const PAYMENT_METHODS = [
  { id: 'mtn',    label: 'MTN Mobile Money', logo: '/mtn.jpg',                  mobile: true },
  { id: 'airtel', label: 'Airtel Money',      logo: '/airtelafrica-logo.png',    mobile: true },
  { id: 'card',   label: 'Card Payment',      logo: null, emoji: '💳',           mobile: false },
];

const CheckoutStepper = ({ t, stage }) => {
  const steps = [
    { key: "cart", label: t("checkout.stepCart"), state: "done" },
    { key: "checkout", label: t("checkout.stepCheckout"), state: stage === "confirm" ? "done" : "active" },
    { key: "confirmation", label: t("checkout.stepConfirmation"), state: stage === "confirm" ? "active" : "upcoming" },
  ];
  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      {steps.map((s, idx) => (
        <React.Fragment key={s.key}>
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 transition-all ${
              s.state === "done" ? "bg-emerald-500 text-white" :
              s.state === "active" ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30" :
              "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
            }`}>
              {s.state === "done" ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : idx + 1}
            </div>
            <span className={`text-[10px] sm:text-xs font-semibold whitespace-nowrap ${s.state === "upcoming" ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200"}`}>{s.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-6 sm:w-16 h-0.5 rounded-full -mt-4 shrink-0 ${s.state === "done" ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const CheckoutSection = ({ number, title, children }) => (
  <div className="bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 mb-6">
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-lg shadow-orange-500/30">
        {number}
      </div>
      <h2 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">{title}</h2>
    </div>
    {children}
  </div>
);

const RadioOptionCard = ({ selected, disabled, onSelect, icon: Icon, iconImg, iconEmoji, title, subtitle, badge, badgeFree }) => (
  <button
    type="button"
    onClick={() => !disabled && onSelect()}
    disabled={disabled}
    className={`relative flex items-center gap-3 p-4 rounded-xl border text-left transition-all w-full ${
      disabled
        ? "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 opacity-60 cursor-not-allowed"
        : selected
        ? "border-orange-500 bg-orange-50/70 dark:bg-orange-900/20 shadow-sm"
        : "border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
    }`}
  >
    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-orange-500" : "border-slate-300 dark:border-slate-600"}`}>
      {selected && <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
    </span>
    <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${selected ? "bg-white dark:bg-slate-900" : "bg-slate-100 dark:bg-slate-800"}`}>
      {iconImg ? (
        <img src={iconImg} alt="" className="w-6 h-6 object-contain" />
      ) : iconEmoji ? (
        <span className="text-lg">{iconEmoji}</span>
      ) : Icon ? (
        <Icon className={`w-5 h-5 ${selected ? "text-orange-600" : "text-slate-500 dark:text-slate-400"}`} />
      ) : null}
    </span>
    <span className="min-w-0 flex-1">
      <span className={`block font-semibold text-sm truncate ${selected ? "text-orange-900 dark:text-orange-300" : "text-slate-900 dark:text-white"}`}>{title}</span>
      {subtitle && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{subtitle}</span>}
    </span>
    {badge && (
      <span className={`text-xs font-semibold shrink-0 ${badgeFree ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>{badge}</span>
    )}
  </button>
);

const FulfillmentMethodCard = ({ method, selected, onSelect, store, subtotal }) => {
  const { t } = useTranslation();
  const Icon = FULFILLMENT_ICONS[method];
  const ds = store?.delivery_settings || {};

  const getMethodLabel = (m) => {
    if (m === "shipping") return t("checkout.shippingLabel");
    if (m === "delivery") return t("checkout.deliveryLabel");
    return t("checkout.pickupLabel");
  };

  const getFee = () => {
    if (method === "pickup") return t("checkout.free");
    if (method === "delivery") {
      const fee = ds.delivery_fee || 0;
      if (ds.free_delivery_above && subtotal >= ds.free_delivery_above) return t("checkout.free");
      return fee === 0 ? t("checkout.free") : formatCurrency(fee);
    }
    return null;
  };

  const getSubLabel = () => {
    if (method === "pickup") return ds.pickup_instructions ? t("checkout.seeInstructionsBelow") : t("checkout.collectFromStore");
    if (method === "delivery") {
      const parts = [];
      if (ds.delivery_time_est) parts.push(ds.delivery_time_est);
      if (ds.delivery_radius_km) parts.push(t("checkout.withinKm", { km: ds.delivery_radius_km }));
      if (ds.min_order_for_delivery && subtotal < ds.min_order_for_delivery) {
        return t("checkout.minOrderRequired", { amount: formatCurrency(ds.min_order_for_delivery) });
      }
      return parts.length ? parts.join(" · ") : t("checkout.toYourLocation");
    }
    return t("checkout.trackedCarrierDelivery");
  };

  const isDisabled = () => {
    if (method === "delivery" && ds.min_order_for_delivery && subtotal < ds.min_order_for_delivery) return true;
    return false;
  };

  const fee = getFee();
  const freeLabel = t("checkout.free");
  const disabled = isDisabled();

  return (
    <RadioOptionCard
      selected={selected}
      disabled={disabled}
      onSelect={() => onSelect(method)}
      icon={Icon}
      title={getMethodLabel(method)}
      subtitle={getSubLabel()}
      badge={fee}
      badgeFree={fee === freeLabel}
    />
  );
};

export default function Checkout() {
  const { t } = useTranslation();
  const [stage, setStage] = useState("form"); // 'form' | 'confirm'
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [isAddressPanelOpen, setIsAddressPanelOpen] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ street: "", city: "", state: "", zip: "", phone: "", country: "RW", label: "Home" });
  const [paymentMethod, setPaymentMethod] = useState("mtn");
  const [orderNote, setOrderNote] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [storeDeliverySelections, setStoreDeliverySelections] = useState({});
  const [mobileMoneyStatus, setMobileMoneyStatus] = useState(null); // 'pending', 'completed', null
  const [payModal, setPayModal] = useState(false);
  const [payStep, setPayStep] = useState("method"); // 'method' | 'phone'
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null); // { reference, method, amount, status: 'pending' | 'failed' | 'cancelled' }
  const [checkoutPhone, setCheckoutPhone] = useState("");

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, isLoadingAuth, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
        navigate(createPageUrl("login"), { state: { from: window.location.pathname } });
    }
  }, [isLoadingAuth, isAuthenticated, navigate]);

  const { data: cartResponse = {}, isLoading: cartLoading, isFetching: cartFetching } = useQuery({
    queryKey: ["cart", currentUser?.username],
    queryFn: () => cartAPI.get(),
    enabled: !!currentUser?.username,
  });

  const { data: addressResponse = { addresses: [] }, isLoading: addressLoading, refetch: refetchAddresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => authAPI.getAddresses(),
    enabled: !!currentUser,
  });

  const cartItems = Array.isArray(cartResponse?.items) ? cartResponse.items : [];
  const storeIds = useMemo(() => Array.from(new Set(cartItems.map(item => item.store_id))), [cartItems]);

  const { data: shippingZonesResponse = { zones: [] } } = useQuery({
    queryKey: ["shipping-zones", storeIds],
    queryFn: () => shippingZonesAPI.listByStores(storeIds),
    enabled: storeIds.length > 0,
  });

  const shippingZones = Array.isArray(shippingZonesResponse?.zones) ? shippingZonesResponse.zones : [];

  const { data: storesDataList = [] } = useQuery({
    queryKey: ["checkout-stores", storeIds],
    queryFn: async () => {
      const results = await Promise.all(storeIds.map(id => storesAPI.get(id).catch(() => null)));
      return results.filter(Boolean);
    },
    enabled: storeIds.length > 0,
  });

  const storesMap = useMemo(() => {
    const map = {};
    storesDataList.forEach(store => {
      if (store?._id) map[store._id] = store;
    });
    return map;
  }, [storesDataList]);

  const storeGroups = useMemo(() => {
    const groups = {};
    cartItems.forEach(item => {
      const key = item.store_id;
      if (!groups[key]) groups[key] = { items: [], store_name: item.store_name, store_id: item.store_id };
      groups[key].items.push(item);
    });
    return Object.values(groups);
  }, [cartItems]);

  // Init delivery selections from store settings when stores are loaded
  useEffect(() => {
    if (Object.keys(storesMap).length > 0) {
      setStoreDeliverySelections(prev => {
        const next = { ...prev };
        Object.entries(storesMap).forEach(([storeId, store]) => {
          if (!next[storeId]) {
            const ds = store.delivery_settings || {};
            if (ds.shipping_enabled !== false) next[storeId] = "shipping";
            else if (ds.delivery_enabled) next[storeId] = "delivery";
            else if (ds.pickup_enabled) next[storeId] = "pickup";
            else next[storeId] = "shipping";
          }
        });
        return next;
      });
    }
  }, [storesMap]);

  const selectedAddress = useMemo(() =>
    addressResponse.addresses.find(a => a._id === selectedAddressId) || addressResponse.addresses.find(a => a.is_default) || addressResponse.addresses[0]
  , [addressResponse.addresses, selectedAddressId]);

  useEffect(() => {
    if (selectedAddress && !selectedAddressId) {
        setSelectedAddressId(selectedAddress._id);
    }
  }, [selectedAddress, selectedAddressId]);

  // Initialize delivery selections for all stores
  useEffect(() => {
    if (Object.keys(storesMap).length > 0) {
      setStoreDeliverySelections(prev => {
        const newSelections = { ...prev };
        storeGroups.forEach(group => {
          const store = storesMap[group.store_id];
          const ds = store?.delivery_settings || {};
          const enabledMethods = [];
          if (ds.shipping_enabled !== false) enabledMethods.push("shipping");
          if (ds.delivery_enabled) enabledMethods.push("delivery");
          if (ds.pickup_enabled) enabledMethods.push("pickup");
          if (enabledMethods.length === 0) enabledMethods.push("shipping");

          if (!newSelections[group.store_id]) {
            newSelections[group.store_id] = enabledMethods[0];
          }
        });
        return newSelections;
      });
    }
  }, [storeGroups, storesMap]);

  // Whether any store requires an address (shipping or delivery selected)
  const needsAddress = useMemo(() => {
    return storeGroups.some(group => {
      const method = storeDeliverySelections[group.store_id] || "shipping";
      return method === "shipping" || method === "delivery";
    });
  }, [storeGroups, storeDeliverySelections]);

  const paymentSectionNumber = needsAddress ? 3 : 2;
  const noteSectionNumber = needsAddress ? 4 : 3;

  const calculations = useMemo(() => {
    let subtotal = 0;
    let shipping = 0;
    const country = selectedAddress?.country || "RW";

    const storeBreakdown = storeGroups.map(group => {
        const groupSubtotal = group.items.reduce((sum, item) => sum + (item.product_price || 0) * (item.quantity || 1), 0);
        subtotal += groupSubtotal;

        const store = storesMap[group.store_id];
        const ds = store?.delivery_settings || {};
        const method = storeDeliverySelections[group.store_id] || "shipping";

        let groupShipping = 0;

        if (method === "pickup") {
          groupShipping = 0;
        } else if (method === "delivery") {
          let fee = ds.delivery_fee || 0;
          if (ds.free_delivery_above && groupSubtotal >= ds.free_delivery_above) fee = 0;
          groupShipping = fee;
        } else {
          // shipping - use shipping zones
          const storeZones = shippingZones.filter(z => z.store_id === group.store_id && z.is_active);
          const zone = storeZones.find(z => Array.isArray(z.countries) && z.countries.includes(country)) ||
                       storeZones.find(z => Array.isArray(z.countries) && z.countries.includes("WORLD"));
          groupShipping = zone ? (zone.flat_rate || 0) : 0;
          if (zone && zone.free_above > 0 && groupSubtotal >= zone.free_above) groupShipping = 0;
        }

        shipping += groupShipping;

        return {
            ...group,
            subtotal: groupSubtotal,
            shipping: groupShipping,
            delivery_method: method,
        };
    });

    let discount = 0;
    if (appliedCoupon) {
        if (appliedCoupon.discount_type === 'percentage') {
            discount = (subtotal * appliedCoupon.discount_value) / 100;
        } else {
            discount = Math.min(appliedCoupon.discount_value, subtotal);
        }
    }

    const itemCount = storeGroups.reduce((sum, group) => sum + group.items.reduce((s, item) => s + (item.quantity || 1), 0), 0);

    return {
        subtotal,
        shipping,
        discount,
        itemCount,
        total: subtotal + shipping - discount,
        storeBreakdown
    };
  }, [storeGroups, shippingZones, selectedAddress, appliedCoupon, storeDeliverySelections, storesMap]);

  const addAddressMutation = useMutation({
    mutationFn: (data) => authAPI.addAddress(data),
    onSuccess: () => {
        refetchAddresses();
        setIsAddingAddress(false);
        setIsAddressPanelOpen(false);
        toast({
          title: "Success",
          description: t("checkout.addressAdded"),
          variant: "default"
        });
    }
  });

  const validateCouponMutation = useMutation({
    mutationFn: (code) => couponsAPI.validateForCart({ code, cart_total: calculations.subtotal }),
    onSuccess: (data) => {
        setAppliedCoupon(data.coupon);
        toast({
          title: "Success",
          description: t("checkout.couponApplied"),
          variant: "default"
        });
    },
    onError: (err) => {
        toast({
          title: "Error",
          description: err.message || t("checkout.invalidCoupon"),
          variant: "destructive"
        });
    }
  });

  const validateCheckout = () => {
    // Validate delivery method selection for all stores
    const missingSelections = storeGroups.filter(group => !storeDeliverySelections[group.store_id]);
    if (missingSelections.length > 0) {
      toast({
        title: "Validation Error",
        description: t("checkout.selectDeliveryMethodForAllStores"),
        variant: "destructive"
      });
      return false;
    }

    // Validate address if needed
    if (needsAddress && !selectedAddressId) {
      toast({
        title: "Validation Error",
        description: t("checkout.selectOrAddAddress"),
        variant: "destructive"
      });
      return false;
    }

    // Validate delivery minimum orders
    for (const group of storeGroups) {
      const store = storesMap[group.store_id];
      const ds = store?.delivery_settings || {};
      const method = storeDeliverySelections[group.store_id];
      const groupSubtotal = group.items.reduce((sum, item) => sum + (item.product_price || 0) * (item.quantity || 1), 0);

      if (method === "delivery" && ds.min_order_for_delivery && groupSubtotal < ds.min_order_for_delivery) {
        toast({
          title: "Validation Error",
          description: t("checkout.minOrderRequiredForStore", {
            store: group.store_name,
            amount: formatCurrency(ds.min_order_for_delivery)
          }),
          variant: "destructive"
        });
        return false;
      }
    }

    // Validate payment method
    if (!paymentMethod) {
      toast({
        title: "Validation Error",
        description: t("checkout.selectPaymentMethod"),
        variant: "destructive"
      });
      return false;
    }

    // Validate phone number for mobile money
    if ((paymentMethod === 'mtn' || paymentMethod === 'airtel') && !checkoutPhone) {
      toast({
        title: "Validation Error",
        description: t("checkout.phoneNumberRequired"),
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleReviewOrder = () => {
    if (!validateCheckout()) return;
    setStage("confirm");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectedPaymentMethodInfo = useMemo(
    () => PAYMENT_METHODS.find(m => m.id === paymentMethod),
    [paymentMethod]
  );

  const checkoutMutation = useMutation({
    mutationFn: async () => {
        // Validate before proceeding
        if (!validateCheckout()) {
          return null; // Validation failed, error already shown
        }

        if (needsAddress && !selectedAddress) throw new Error(t("checkout.selectDeliveryAddress"));

        const payload = {
            payment_method: paymentMethod,
            order_note: orderNote,
            coupon_code: appliedCoupon?.code,
            affiliate_ref: localStorage.getItem('iqon_ref') || undefined,
            affiliate_time: localStorage.getItem('iqon_ref_time') || undefined,
            store_fulfillment_types: storeDeliverySelections,
        };

        // Add phone number for mobile money payments
        if (paymentMethod === 'mtn' || paymentMethod === 'airtel') {
          payload.mobile_money_phone = checkoutPhone;
        }

        if (needsAddress && selectedAddress) {
            payload.shipping_address = {
                street: selectedAddress.street,
                city: selectedAddress.city,
                state: selectedAddress.state,
                zip: selectedAddress.zip,
                country: selectedAddress.country,
                phone: selectedAddress.phone || currentUser.phone_number || "",
            };
        }

        return await checkoutAPI.process(payload);
    },
    onSuccess: async (data) => {
        if (!data) {
          return; // Validation failed
        }

        // The real order ids created by this checkout — needed to verify payment
        // against the correct orders later (a multi-vendor cart creates one order
        // per store, all paid together under a single reference).
        const orderIds = (data.orders || []).map(id => String(id));
        if (orderIds.length === 0) {
          toast({ title: "Error", description: t("checkout.failedToPlaceOrder"), variant: "destructive" });
          return;
        }
        localStorage.setItem('pending_order_ids', JSON.stringify(orderIds));

        // Checkout already initialized the real payment above (using the method
        // and phone chosen on this page, and the actual order ids/total) — use
        // that transaction directly instead of starting a second, disconnected one.
        if (paymentMethod === 'card') {
          if (data.payment_url) {
            window.location.href = data.payment_url;
          } else {
            toast({ title: "Error", description: t("subscription.paymentInitFailed"), variant: "destructive" });
          }
          return;
        }

        if (data.reference) {
          toast({
            title: "Payment Initiated",
            description: "Please check your phone to confirm the payment. Do not close this page.",
            variant: "default"
          });
          setPendingPayment({
            reference: data.reference,
            method: paymentMethod,
            amount: data.total_amount,
            status: 'pending'
          });
        } else {
          toast({ title: "Error", description: t("subscription.paymentInitFailed"), variant: "destructive" });
        }
    },
    onError: (err) => {
        let errorMsg = err.message || t("checkout.failedToPlaceOrder");
        if (err.message?.includes("Insufficient stock")) {
          errorMsg = t("checkout.insufficientStock");
        } else if (err.message?.includes("Inventory")) {
          errorMsg = t("checkout.outOfStock");
        } else if (err.message?.includes("cancelled") || err.message?.includes("rejected") || err.message?.includes("timeout")) {
          errorMsg = "Payment was cancelled or timed out. Please try again.";
        } else if (/balance/i.test(err.message || "") && !/does not have enough funds/i.test(err.message || "")) {
          errorMsg = "Payment declined: the selected payment method does not have enough funds to cover this order. Please top up or try a different payment method.";
        }
        toast({
          title: "Payment Failed",
          description: errorMsg,
          variant: "destructive"
        });
    }
  });

  const doInitiatePayment = async (method, phone) => {
    const orderId = localStorage.getItem('pending_order_id');
    if (!orderId) {
      toast({
        title: "Error",
        description: "Order information lost. Please try again.",
        variant: "destructive"
      });
      return;
    }

    setPayModal(false);
    setMobileMoneyStatus('pending');

    try {
      const response = await initializeITECPayPayment({
        amount: calculations.total,
        email: currentUser.email,
        phone: phone || undefined,
        order_id: `ORD-${orderId}`,
        payment_method: method,
        onSuccess: (res) => {
          if (method !== 'card') {
            toast({
              title: "Success",
              description: t("subscription.checkPhonePrompt"),
              variant: "default"
            });
            // Show pending payment popup
            setPendingPayment({
              reference: res.data?.reference || res.reference,
              method: method,
              amount: calculations.total,
              status: 'pending'
            });
          }
        },
      });
    } catch (err) {
      setMobileMoneyStatus(null);
      toast({
        title: "Error",
        description: err.message || t("subscription.paymentInitFailed"),
        variant: "destructive"
      });
    }
  };

  const handleMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
    if (method.mobile) {
      const savedPhone = currentUser.phone_number || "";
      setPhoneInput(savedPhone);
      setPayStep("phone");
    } else {
      doInitiatePayment(method.id, null);
    }
  };

  const handlePhoneSubmit = async () => {
    const cleaned = phoneInput.trim();
    if (!cleaned || cleaned.length < 9) {
      toast({
        title: "Error",
        description: t("subscription.phoneRequired"),
        variant: "destructive"
      });
      return;
    }
    setPhoneSaving(true);
    try {
      await authAPI.updateProfile({ phone_number: cleaned });
    } catch {
      /* non-fatal — proceed anyway with the entered number */
    } finally {
      setPhoneSaving(false);
    }
    await doInitiatePayment(selectedPaymentMethod.id, cleaned);
  };

  // A cancelled/failed/timed-out mobile money payment leaves the orders created
  // at checkout time stuck at status 'pending' unless we explicitly cancel them
  // (this also restores the inventory that was deducted at order creation).
  const cancelPendingOrders = async () => {
    const storedOrderIds = localStorage.getItem('pending_order_ids');
    const orderIds = storedOrderIds ? JSON.parse(storedOrderIds) : [];
    localStorage.removeItem('pending_order_ids');
    await Promise.all(orderIds.map(id => ordersAPI.cancelOrder(id).catch(() => {})));
  };

  // Poll payment status when pending
  useEffect(() => {
    if (!pendingPayment || pendingPayment.status !== 'pending') return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await paymentAPI.itecpay.verify({
          req_ref: pendingPayment.reference,
          provider: pendingPayment.method
        });

        const status = result.data?.status || result.status;
        const statusLower = String(status).toLowerCase();

        if (statusLower === 'failed' || statusLower === 'cancelled' || statusLower === 'rejected') {
          setPendingPayment(prev => ({ ...prev, status: 'failed' }));
          setMobileMoneyStatus(null);
          clearInterval(pollInterval);
          await cancelPendingOrders();
          toast({
            title: "Payment Cancelled",
            description: "You cancelled the payment on your phone. Please try again.",
            variant: "destructive"
          });
        } else if (statusLower === 'completed' || statusLower === 'success' || statusLower === 'successful' || statusLower === 'paid' || statusLower === 'approved') {
          // Payment successful - complete order
          const storedOrderIds = localStorage.getItem('pending_order_ids');
          const orderIds = storedOrderIds ? JSON.parse(storedOrderIds) : [];
          if (orderIds.length > 0) {
            await checkoutAPI.verifyPayments(orderIds, pendingPayment.reference);
          }
          setPendingPayment(null);
          setMobileMoneyStatus('completed');
          clearInterval(pollInterval);
          toast({
            title: "Success",
            description: t("checkout.orderPlaced"),
            variant: "default"
          });
          localStorage.removeItem('pending_order_ids');
          localStorage.removeItem('iqon_ref');
          localStorage.removeItem('iqon_ref_time');
          queryClient.invalidateQueries({ queryKey: ["cart"] });
          navigate(createPageUrl("orders"));
        }
      } catch (error) {
        // Surface the failure immediately instead of leaving the user staring at
        // a spinner forever — let them retry from a clean state.
        setPendingPayment(prev => (prev ? { ...prev, status: 'failed' } : prev));
        setMobileMoneyStatus(null);
        clearInterval(pollInterval);
        await cancelPendingOrders();
        toast({
          title: "Payment Verification Failed",
          description: error.message || "We couldn't confirm your payment. Please try again.",
          variant: "destructive"
        });
      }
    }, 5000);

    const timeout = setTimeout(async () => {
      if (pendingPayment?.status === 'pending') {
        setPendingPayment(prev => ({ ...prev, status: 'failed' }));
        setMobileMoneyStatus(null);
        await cancelPendingOrders();
        toast({
          title: "Payment Timed Out",
          description: "We couldn't confirm your payment in time. Please try again.",
          variant: "destructive"
        });
      }
      clearInterval(pollInterval);
    }, 120000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [pendingPayment, queryClient, navigate]);

  useEffect(() => {
    // Guard against the moment right after "Buy Now" adds an item and navigates here:
    // isLoading is only true on the very first fetch, so a background refetch triggered
    // by the just-completed cartAPI.add() + invalidateQueries wouldn't be caught by it
    // alone, and this would fire on stale (empty) cached data.
    if (!cartLoading && !cartFetching && cartItems.length === 0 && !checkoutMutation.isSuccess) {
      toast({
        title: "Error",
        description: t("checkout.cartEmpty"),
        variant: "destructive"
      });
      navigate(createPageUrl("cart"));
    }
  }, [cartItems, cartLoading, cartFetching, navigate, checkoutMutation.isSuccess]);

  if (cartLoading || addressLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 lg:py-10">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8 flex-wrap">
        <Link to={createPageUrl("cart")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 order-1">
          <ArrowLeft className="w-4 h-4" /> {t("checkout.backToCart")}
        </Link>

        <div className="order-3 sm:order-2 w-full sm:w-auto flex justify-center mt-2 sm:mt-0">
          <CheckoutStepper t={t} stage={stage} />
        </div>

        <div className="hidden sm:flex order-2 sm:order-3 items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shrink-0">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-left leading-tight">
            <p className="text-xs font-bold text-slate-900 dark:text-white">{t("checkout.secureCheckout")}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("checkout.secureCheckoutDesc")}</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{t("common.checkout")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("checkout.completeInFewSteps")}</p>
      </div>

      {mobileMoneyStatus === 'completed' && (
        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">Your payment has been successfully processed!</p>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-12 items-start">
        <div className="min-w-0 lg:col-span-8">
          {stage === "form" ? (
          <>
          {/* SECTION 1: DELIVERY METHOD */}
          <CheckoutSection number="1" title={t("checkout.deliveryOptions")}>
            <div className="space-y-6">
              {storeGroups.map((group, idx) => {
                const store = storesMap[group.store_id];
                const ds = store?.delivery_settings || {};
                const groupSubtotal = group.items.reduce((sum, item) => sum + (item.product_price || 0) * (item.quantity || 1), 0);
                const enabledMethods = [];
                if (ds.shipping_enabled !== false) enabledMethods.push("shipping");
                if (ds.delivery_enabled) enabledMethods.push("delivery");
                if (ds.pickup_enabled) enabledMethods.push("pickup");
                if (enabledMethods.length === 0) enabledMethods.push("shipping");

                const selectedMethod = storeDeliverySelections[group.store_id] || enabledMethods[0];
                const storeHasPickup = selectedMethod === "pickup";

                return (
                  <div key={group.store_id} className={`space-y-3 ${idx !== 0 ? "pt-6 border-t border-slate-100 dark:border-slate-700" : ""}`}>
                    {storeGroups.length > 1 && (
                      <div className="flex items-center gap-2 mb-3 flex-wrap min-w-0">
                        <StoreIcon className="w-4 h-4 text-orange-500 shrink-0" />
                        <h3 className="font-black text-sm text-slate-900 dark:text-white tracking-tight truncate max-w-full">{group.store_name}</h3>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {enabledMethods.map(method => (
                        <FulfillmentMethodCard
                          key={method}
                          method={method}
                          selected={selectedMethod === method}
                          onSelect={(m) => setStoreDeliverySelections(prev => ({ ...prev, [group.store_id]: m }))}
                          store={store}
                          subtotal={groupSubtotal}
                        />
                      ))}
                    </div>

                    {storeHasPickup && (
                      <div className="flex items-start gap-3 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 animate-in fade-in duration-300">
                        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 uppercase tracking-wider mb-1">{t("checkout.pickupLocation")}</p>
                          {store?.address && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 mb-2">
                              <MapPin className="w-3 h-3" /> {store.address}
                            </p>
                          )}
                          {ds.pickup_instructions && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{ds.pickup_instructions}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedMethod === "delivery" && ds.delivery_radius_km && (
                      <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 rounded-xl px-4 py-2.5 text-xs text-orange-700 dark:text-orange-300 font-medium">
                        <Navigation className="w-3.5 h-3.5 flex-shrink-0" />
                        {t("checkout.deliveryRadius", { km: ds.delivery_radius_km })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CheckoutSection>

          {/* SECTION 2: DELIVER TO */}
          {needsAddress && (
            <CheckoutSection number="2" title={t("checkout.deliverToSectionTitle")}>
              <div className="space-y-3">
                {selectedAddress ? (
                  <div className="flex items-start gap-3 sm:gap-4 p-4 rounded-xl border border-orange-500 bg-orange-50/70 dark:bg-orange-900/20 transition-all">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30">
                      <Home className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{selectedAddress.label || "Address"}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5 truncate">{selectedAddress.street}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{selectedAddress.city}, {selectedAddress.state} {selectedAddress.zip}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{selectedAddress.country}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {selectedAddress.is_default && (
                        <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100/70 dark:bg-orange-900/40 px-2 py-0.5 rounded-full whitespace-nowrap">{t("checkout.defaultBadge")}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsAddressPanelOpen(o => !o)}
                        className="text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                        aria-label={t("common.edit")}
                      >
                        <ChevronDown className={`w-5 h-5 transition-transform ${isAddressPanelOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setIsAddressPanelOpen(true); setIsAddingAddress(true); }}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 font-semibold text-sm hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> {t("checkout.addNewAddress")}
                  </button>
                )}

                {isAddressPanelOpen && (
                  <div className="pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {addressResponse.addresses.length > 1 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {addressResponse.addresses.map((addr) => (
                          <button
                            key={addr._id}
                            onClick={() => { setSelectedAddressId(addr._id); setIsAddressPanelOpen(false); }}
                            className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                              selectedAddressId === addr._id
                                ? "border-orange-500 bg-orange-50/70 dark:bg-orange-900/20"
                                : "border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-100/50 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">{addr.label || "Address"}</span>
                              {selectedAddressId === addr._id && <CheckCircle2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
                            </div>
                            <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{addr.street}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{addr.city}, {addr.state} {addr.zip}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {!isAddingAddress ? (
                      <button
                        onClick={() => setIsAddingAddress(true)}
                        className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 text-sm font-semibold"
                      >
                        <Plus className="w-4 h-4" /> {t("checkout.addNewAddress")}
                      </button>
                    ) : (
                      <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{t("checkout.newAddressDetails")}</h4>
                          <button onClick={() => setIsAddingAddress(false)} className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">{t("common.cancel")}</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="col-span-1 sm:col-span-2">
                            <label htmlFor="addr-label" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">{t("checkout.addressLabel")}</label>
                            <Input id="addr-label" value={newAddress.label} onChange={e => setNewAddress({...newAddress, label: e.target.value})} placeholder="Home" className="rounded-xl h-11 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
                          </div>
                          <div className="col-span-1 sm:col-span-2">
                            <label htmlFor="addr-street" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">{t("checkout.streetAddress")}</label>
                            <Input id="addr-street" value={newAddress.street} onChange={e => setNewAddress({...newAddress, street: e.target.value})} placeholder="123 Main St" className="rounded-xl h-11 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
                          </div>
                          <div>
                            <label htmlFor="addr-city" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">{t("checkout.city")}</label>
                            <Input id="addr-city" value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} placeholder="Kigali" className="rounded-xl h-11 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
                          </div>
                          <div>
                            <label htmlFor="addr-state" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">{t("checkout.state")}</label>
                            <Input id="addr-state" value={newAddress.state} onChange={e => setNewAddress({...newAddress, state: e.target.value})} placeholder="Kigali City" className="rounded-xl h-11 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
                          </div>
                          <div>
                            <label htmlFor="addr-zip" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">{t("checkout.zipCode")}</label>
                            <Input id="addr-zip" value={newAddress.zip} onChange={e => setNewAddress({...newAddress, zip: e.target.value})} placeholder="100001" className="rounded-xl h-11 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
                          </div>
                          <div>
                            <label htmlFor="addr-phone" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">{t("checkout.phone")}</label>
                            <Input id="addr-phone" value={newAddress.phone} onChange={e => setNewAddress({...newAddress, phone: e.target.value})} placeholder="+250..." className="rounded-xl h-11 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                              if (!newAddress.street || !newAddress.city || !newAddress.state || !newAddress.zip || !newAddress.phone) {
                                  toast({
                                    title: "Validation Error",
                                    description: t("checkout.fillAllFields"),
                                    variant: "destructive"
                                  });
                                  return;
                              }
                              addAddressMutation.mutate(newAddress);
                          }}
                          disabled={addAddressMutation.isPending}
                          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl h-12 font-semibold shadow-lg shadow-orange-500/30 transition-all"
                        >
                          {addAddressMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("checkout.saveAddress")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CheckoutSection>
          )}

          {/* SECTION: PAYMENT METHOD */}
          <CheckoutSection number={String(paymentSectionNumber)} title={t("checkout.paymentMethod")}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PAYMENT_METHODS.filter(method => method.id !== 'card').map(method => (
                  <RadioOptionCard
                    key={method.id}
                    selected={paymentMethod === method.id}
                    onSelect={() => setPaymentMethod(method.id)}
                    iconImg={method.logo}
                    iconEmoji={method.emoji}
                    title={method.label}
                    subtitle={t("checkout.mobileMoneyPayment")}
                  />
                ))}
              </div>

              {(paymentMethod === 'mtn' || paymentMethod === 'airtel') && (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 block">{t("checkout.phoneNumber")}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                      <span className="text-base leading-none">🇷🇼</span>
                      <span className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
                      <Smartphone className="w-4 h-4 text-slate-400" />
                    </span>
                    <Input
                      type="tel"
                      placeholder="+250 7XX XXX XXX"
                      value={checkoutPhone}
                      onChange={e => setCheckoutPhone(e.target.value)}
                      className="rounded-xl h-12 pl-[4.5rem] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t("checkout.phonePaymentNote")}</p>
                </div>
              )}
            </div>
          </CheckoutSection>

          {/* SECTION: ORDER NOTE */}
          <CheckoutSection number={String(noteSectionNumber)} title={t("checkout.orderNote")}>
            <Textarea
              value={orderNote}
              onChange={e => setOrderNote(e.target.value)}
              placeholder={t("checkout.orderNotePlaceholder")}
              className="rounded-xl min-h-[100px] border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400 resize-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </CheckoutSection>
          </>
          ) : (
          <>
          {/* CONFIRMATION REVIEW */}
          <button
            type="button"
            onClick={() => setStage("form")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t("checkout.backToEdit")}
          </button>

          <div className="bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">{t("checkout.orderReview")}</h2>
            </div>

            <div className="space-y-5">
              {/* Delivery method per store */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("checkout.deliveryOptions")}</p>
                  <button type="button" onClick={() => setStage("form")} className="text-xs font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">{t("common.edit")}</button>
                </div>
                <div className="space-y-2">
                  {calculations.storeBreakdown.map(store => {
                    const FulfillIcon = FULFILLMENT_ICONS[store.delivery_method] || Truck;
                    const label = store.delivery_method === "shipping" ? t("checkout.shippingLabel") : store.delivery_method === "delivery" ? t("checkout.deliveryLabel") : t("checkout.pickupLabel");
                    return (
                      <div key={store.store_id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 min-w-0 text-sm">
                          <FulfillIcon className="w-4 h-4 text-orange-500 shrink-0" />
                          <span className="font-semibold text-slate-900 dark:text-white truncate">{storeGroups.length > 1 ? `${store.store_name} · ${label}` : label}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">{store.shipping === 0 ? t("checkout.freeBadge") : formatCurrency(store.shipping)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Address */}
              {needsAddress && selectedAddress && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("checkout.deliverToSectionTitle")}</p>
                    <button type="button" onClick={() => setStage("form")} className="text-xs font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">{t("common.edit")}</button>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                    <Home className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{selectedAddress.label ? `${selectedAddress.label} · ` : ""}{selectedAddress.street}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{selectedAddress.city}, {selectedAddress.state} {selectedAddress.zip}, {selectedAddress.country}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment method */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("checkout.paymentMethod")}</p>
                  <button type="button" onClick={() => setStage("form")} className="text-xs font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">{t("common.edit")}</button>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                    {selectedPaymentMethodInfo?.logo
                      ? <img src={selectedPaymentMethodInfo.logo} alt="" className="w-5 h-5 object-contain" />
                      : <span className="text-base">{selectedPaymentMethodInfo?.emoji}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{selectedPaymentMethodInfo?.label}</p>
                    {checkoutPhone && (paymentMethod === 'mtn' || paymentMethod === 'airtel') && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{checkoutPhone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order note */}
              {orderNote && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">{t("checkout.orderNote")}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 p-3">{orderNote}</p>
                </div>
              )}
            </div>
          </div>
          </>
          )}
        </div>

        {/* SUMMARY SIDEBAR */}
        <div className="min-w-0 lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            <div className="bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">{t("cart.orderSummary")}</h3>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full whitespace-nowrap">{t("checkout.itemsCount", { count: calculations.itemCount })}</span>
              </div>

              {/* Itemized product list */}
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1 mb-5">
                {calculations.storeBreakdown.flatMap(store => store.items).map(item => (
                  <div key={item._id} className="flex gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                      <img src={item.product_image} alt={item.product_title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{item.product_title}</p>
                      {(item.selected_color || item.selected_size) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.selected_color && <>{t("product.color")}: {item.selected_color}</>}
                          {item.selected_color && item.selected_size ? " · " : ""}
                          {item.selected_size && <>{t("product.size")}: {item.selected_size}</>}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t("checkout.qty", { qty: item.quantity, price: formatCurrency(item.product_price) })}</p>
                    </div>
                    <div className="text-right shrink-0 flex items-center">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white">{formatCurrency(item.product_price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-700 mb-4" />

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                  <span>{t("cart.subtotal")}</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{formatCurrency(calculations.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                  <span>{t("checkout.fulfillment")}</span>
                  <span className={calculations.shipping === 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-900 dark:text-white font-semibold"}>
                    {calculations.shipping === 0 ? t("checkout.freeBadge") : formatCurrency(calculations.shipping)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                  <span>{t("common.discount")}</span>
                  <span className={calculations.discount > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-900 dark:text-white font-semibold"}>
                    {calculations.discount > 0 ? `- ${formatCurrency(calculations.discount)}` : formatCurrency(0)}
                  </span>
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-700 my-4" />

              <div className="flex justify-between items-end">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{t("cart.total")}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("checkout.allTaxesIncluded")}</p>
                </div>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(calculations.total)}</span>
              </div>

              {/* Coupon Code */}
              <div className="mt-5">
                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <Input
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value)}
                      placeholder={t("checkout.couponPlaceholder")}
                      className="rounded-xl h-11 border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                    />
                    <Button
                      onClick={() => validateCouponMutation.mutate(couponCode)}
                      disabled={!couponCode || validateCouponMutation.isPending}
                      variant="outline"
                      className="h-11 rounded-xl font-semibold border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20 shrink-0"
                    >
                      {validateCouponMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.apply")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 p-3 bg-orange-50 dark:bg-orange-950 rounded-xl border border-orange-100 dark:border-orange-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shrink-0">
                        <Tag className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-orange-900 dark:text-orange-300 uppercase tracking-tight truncate">{appliedCoupon.code}</p>
                        <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">{t("checkout.appliedSuccessfully")}</p>
                      </div>
                    </div>
                    <button onClick={() => setAppliedCoupon(null)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 p-1 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Trust list */}
              <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700 space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0"><Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{t("checkout.securePaymentTrust")}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("checkout.securePaymentTrustDesc")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0"><RotateCcw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{t("checkout.easyReturns")}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("checkout.easyReturnsDesc")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0"><Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{t("checkout.support247")}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("checkout.support247Desc")}</p>
                  </div>
                </div>
              </div>

              {/* Pay / Review Button */}
              {stage === "form" ? (
                <Button
                  onClick={handleReviewOrder}
                  className="w-full h-14 mt-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl font-bold text-base shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {t("checkout.reviewOrder")} <ChevronRight className="w-5 h-5" />
                </Button>
              ) : (
                <Button
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending}
                  className="w-full h-14 mt-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl font-bold text-base shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {checkoutMutation.isPending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> {t("checkout.processing")}</>
                  ) : (
                    <><Shield className="w-5 h-5" /> {t("checkout.payAmount", { amount: formatCurrency(calculations.total) })}</>
                  )}
                </Button>
              )}
              <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-3">{stage === "form" ? t("checkout.reviewBeforePay") : t("checkout.wontBeCharged")}</p>
            </div>

            {/* Help/Support info */}
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 transition-all group-hover:scale-150 duration-700" />
                <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Info className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-black tracking-tight">{t("checkout.needHelp")}</h4>
                </div>
                <p className="text-xs text-white/60 font-medium leading-relaxed mb-4">
                    {t("checkout.needHelpDesc")}
                </p>
                <Link to="/support" className="text-xs font-black text-white hover:text-orange-400 underline underline-offset-4 decoration-white/20">{t("checkout.contactSupport")}</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom trust strip */}
      <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {[
            { icon: Shield, title: t("checkout.trustSecurePayment"), desc: t("checkout.trustSecurePaymentDesc") },
            { icon: Smartphone, title: t("checkout.trustMobileMoney"), desc: t("checkout.trustMobileMoneyDesc") },
            { icon: Truck, title: t("checkout.trustFastDelivery"), desc: t("checkout.trustFastDeliveryDesc") },
            { icon: BadgeCheck, title: t("checkout.trustSatisfaction"), desc: t("checkout.trustSatisfactionDesc") },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
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
                  {selectedPaymentMethod?.logo
                    ? <img src={selectedPaymentMethod.logo} alt={selectedPaymentMethod.label} className="w-7 h-7 object-contain rounded" />
                    : <span>{selectedPaymentMethod?.emoji}</span>
                  }
                  {selectedPaymentMethod?.label}
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
                      disabled={phoneSaving}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-700"
                      disabled={phoneSaving}
                    >
                      {phoneSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("subscription.payNow")}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Pending Payment Popup */}
      {pendingPayment && pendingPayment.status === 'pending' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-amber-600 dark:text-amber-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t("subscription.paymentPending")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatCurrency(pendingPayment.amount)}</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  <p className="font-semibold mb-1">{t("subscription.checkPhonePrompt")}</p>
                  <p>{t("subscription.paymentMayTakeMins")}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 mb-4 text-xs text-slate-400 dark:text-slate-500">
              <span>{t("subscription.poweredBy")}</span>
              <span className="font-bold text-slate-600 dark:text-slate-400">ITEC Pay</span>
            </div>

            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => {
                setPendingPayment(null);
                setMobileMoneyStatus(null);
              }}
            >
              {t("common.close")}
            </Button>
          </motion.div>
        </div>
      )}

      {/* Mobile Money Status Display */}
      {mobileMoneyStatus === 'pending' && !pendingPayment && (
        <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 shadow-lg sm:max-w-sm animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-spin shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-300">{t("subscription.paymentPending")}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t("subscription.checkPhonePrompt")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
