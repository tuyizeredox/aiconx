import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { 
  ArrowLeft, CreditCard, Shield, Truck, 
  MapPin, CheckCircle2, Loader2,
  Info, Plus, Trash2, Tag, 
  ChevronRight, ShoppingBag, Store as StoreIcon,
  Package, Navigation, AlertCircle
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

const CheckoutStep = ({ number, title, active, completed, children, onEdit, summary }) => {
  const { t } = useTranslation();
  return (
  <div
    className={`bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border ${active ? "border-orange-500/50 shadow-lg shadow-orange-500/10 dark:shadow-orange-500/20" : "border-slate-200 dark:border-slate-800"} p-4 sm:p-6 mb-6 transition-all duration-300`}
  >
    <div className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all shrink-0 ${completed ? "bg-emerald-500 text-white" : active ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}>
          {completed ? <CheckCircle2 className="w-5 h-5" /> : number}
        </div>
        <h2 className={`font-semibold text-base sm:text-lg truncate ${active ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>{title}</h2>
      </div>
      {completed && onEdit && (
        <button onClick={onEdit} className="text-xs font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors shrink-0">{t("checkout.editDetails")}</button>
      )}
    </div>
    {(active || !completed) && (
      <div className={`${!active && "hidden"}`}>
        {children}
      </div>
    )}
    {completed && !active && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            {summary || (
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    {t("checkout.requirementCompleted")}
                </div>
            )}
        </div>
    )}
  </div>
  );
};

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
    <button
      onClick={() => !disabled && onSelect(method)}
      disabled={disabled}
      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${
        disabled
          ? "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 opacity-60 cursor-not-allowed"
          : selected
          ? "border-orange-500 bg-gradient-to-r from-orange-50 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/20 shadow-md shadow-orange-500/10"
          : "border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${selected ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className={`font-semibold text-sm truncate ${selected ? "text-orange-900 dark:text-orange-300" : "text-slate-900 dark:text-white"}`}>{getMethodLabel(method)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">{getSubLabel()}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {fee !== null && (
          <span className={`text-sm font-semibold ${fee === freeLabel ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>{fee}</span>
        )}
        {selected && <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30"><CheckCircle2 className="w-4 h-4 text-white" /></div>}
      </div>
    </button>
  );
};

export default function Checkout() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ street: "", city: "", state: "", zip: "", phone: "", country: "RW", label: "Home" });
  const [paymentMethod, setPaymentMethod] = useState("mtn");
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState("");
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
  const [isContinuing, setIsContinuing] = useState(false);
  const [checkoutPhone, setCheckoutPhone] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isQuickPay = searchParams.get("quickpay") === "true";
  const hasAutoAdvanced = useRef(false);
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

  useEffect(() => {
    if (isQuickPay && selectedAddress && Object.keys(storesMap).length > 0 && !hasAutoAdvanced.current) {
      hasAutoAdvanced.current = true;
      setStep(2);
    }
  }, [isQuickPay, selectedAddress, storesMap]);

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
    console.log('[Checkout] validateCheckout called');
    console.log('[Checkout] Validation state:', {
      storeDeliverySelections,
      selectedAddressId,
      needsAddress,
      paymentMethod,
      storeGroups: storeGroups.map(g => ({ id: g.store_id, name: g.store_name }))
    });

    // Validate delivery method selection for all stores
    const missingSelections = storeGroups.filter(group => !storeDeliverySelections[group.store_id]);
    console.log('[Checkout] Missing delivery selections:', missingSelections.map(g => g.store_name));
    
    if (missingSelections.length > 0) {
      console.log('[Checkout] Validation failed: Missing delivery selections');
      toast({ 
        title: "Validation Error", 
        description: t("checkout.selectDeliveryMethodForAllStores"),
        variant: "destructive"
      });
      return false;
    }

    // Validate address if needed
    console.log('[Checkout] Address validation:', { needsAddress, selectedAddressId });
    if (needsAddress && !selectedAddressId) {
      console.log('[Checkout] Validation failed: Missing address');
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
      
      console.log('[Checkout] Store validation:', {
        store: group.store_name,
        method,
        subtotal: groupSubtotal,
        minOrder: ds.min_order_for_delivery
      });
      
      if (method === "delivery" && ds.min_order_for_delivery && groupSubtotal < ds.min_order_for_delivery) {
        console.log('[Checkout] Validation failed: Minimum order not met');
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
    console.log('[Checkout] Payment method validation:', { paymentMethod });
    if (!paymentMethod) {
      console.log('[Checkout] Validation failed: No payment method selected');
      toast({
        title: "Validation Error",
        description: t("checkout.selectPaymentMethod"),
        variant: "destructive"
      });
      return false;
    }

    // Validate phone number for mobile money
    if ((paymentMethod === 'mtn' || paymentMethod === 'airtel') && !checkoutPhone) {
      console.log('[Checkout] Validation failed: Phone number required for mobile money');
      toast({
        title: "Validation Error",
        description: t("checkout.phoneNumberRequired"),
        variant: "destructive"
      });
      return false;
    }

    console.log('[Checkout] All validations passed');
    return true;
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
        console.log('[Checkout] Place Order clicked - starting checkout process');

        // Validate before proceeding
        if (!validateCheckout()) {
          console.log('[Checkout] Validation failed, aborting checkout');
          return null; // Validation failed, error already shown
        }

        console.log('[Checkout] Validation passed, preparing payload');
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

        console.log('[Checkout] Checkout payload:', payload);

        if (needsAddress && selectedAddress) {
            payload.shipping_address = {
                street: selectedAddress.street,
                city: selectedAddress.city,
                state: selectedAddress.state,
                zip: selectedAddress.zip,
                country: selectedAddress.country,
                phone: selectedAddress.phone || currentUser.phone_number || "",
            };
            console.log('[Checkout] Shipping address added to payload');
        }

        console.log('[Checkout] Calling checkoutAPI.process');
        return await checkoutAPI.process(payload);
    },
    onSuccess: async (data) => {
        console.log('[Checkout] Checkout API success:', data);
        if (!data) {
          console.log('[Checkout] No data returned (validation failed)');
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
        console.log('[Checkout] Stored pending order ids:', orderIds);

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
        console.log('[Checkout] Checkout API error:', err);
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
        console.log('[Checkout] Error message to show:', errorMsg);
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

        console.log('Payment verification result:', result);

        const status = result.data?.status || result.status;
        const statusLower = String(status).toLowerCase();

        console.log('Payment status:', statusLower);

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
        console.error('Error polling payment status:', error);
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

  const handleContinueFromStep1 = () => {
    console.log('[Checkout] Continue to Payment clicked');
    console.log('[Checkout] Current state:', {
      step,
      storeDeliverySelections,
      selectedAddressId,
      needsAddress,
      storeGroups: storeGroups.map(g => ({ id: g.store_id, name: g.store_name }))
    });
    
    setIsContinuing(true);
    
    // Validate all store delivery selections
    const missingSelections = storeGroups.filter(group => !storeDeliverySelections[group.store_id]);
    console.log('[Checkout] Missing delivery selections:', missingSelections.map(g => g.store_name));
    
    if (missingSelections.length > 0) {
      console.log('[Checkout] Validation failed: Missing delivery selections');
      toast({ 
        title: "Validation Error", 
        description: t("checkout.selectDeliveryMethodForAllStores"),
        variant: "destructive"
      });
      setIsContinuing(false);
      return;
    }

    // Validate address if needed
    console.log('[Checkout] Address validation:', { needsAddress, selectedAddressId });
    if (needsAddress && !selectedAddressId) {
      console.log('[Checkout] Validation failed: Missing address');
      toast({ 
        title: "Validation Error", 
        description: t("checkout.selectOrAddAddress"),
        variant: "destructive"
      });
      setIsContinuing(false);
      return;
    }

    // Validate delivery minimum orders
    for (const group of storeGroups) {
      const store = storesMap[group.store_id];
      const ds = store?.delivery_settings || {};
      const method = storeDeliverySelections[group.store_id];
      const groupSubtotal = group.items.reduce((sum, item) => sum + (item.product_price || 0) * (item.quantity || 1), 0);
      
      console.log('[Checkout] Store validation:', {
        store: group.store_name,
        method,
        subtotal: groupSubtotal,
        minOrder: ds.min_order_for_delivery
      });
      
      if (method === "delivery" && ds.min_order_for_delivery && groupSubtotal < ds.min_order_for_delivery) {
        console.log('[Checkout] Validation failed: Minimum order not met');
        toast({ 
          title: "Validation Error", 
          description: t("checkout.minOrderRequiredForStore", { 
            store: group.store_name, 
            amount: formatCurrency(ds.min_order_for_delivery) 
          }),
          variant: "destructive"
        });
        setIsContinuing(false);
        return;
      }
    }
    
    console.log('[Checkout] All validations passed, moving to step 2');
    // Small delay to show loading state
    setTimeout(() => {
      setStep(2);
      setIsContinuing(false);
    }, 300);
  };

  const getStep1Summary = () => {
    const methodSummary = storeGroups.map(g => {
      const method = storeDeliverySelections[g.store_id] || "shipping";
      const Icon = FULFILLMENT_ICONS[method];
      return (
        <div key={g.store_id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <Icon className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
          <span className="font-bold text-slate-800 dark:text-white">{g.store_name}</span>
          <span className="text-slate-400 dark:text-slate-500">·</span>
          <span className="capitalize">{method === "shipping" ? t("checkout.shippingLabel") : method === "delivery" ? t("checkout.deliveryLabel") : t("checkout.pickupLabel")}</span>
        </div>
      );
    });

    return (
      <div className="bg-slate-50/80 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
        {methodSummary}
        {needsAddress && selectedAddress && (
          <div className="flex items-start gap-3 pt-3 border-t border-slate-100 dark:border-slate-700 mt-3">
            <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedAddress.street}</p>
              <p className="text-xs text-slate-500">{selectedAddress.city}, {selectedAddress.state} {selectedAddress.zip}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (cartLoading || addressLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 lg:py-12">
      <Link to={createPageUrl("cart")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 sm:mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("checkout.backToCart")}
      </Link>

      <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-12">
        <div className="min-w-0 lg:col-span-8">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-8 sm:mb-10 tracking-tight">{t("common.checkout")}</h1>
          
          {/* STEP 1: DELIVERY OPTIONS */}
          <CheckoutStep 
            number="1" 
            title={t("checkout.deliveryOptions")} 
            active={step === 1} 
            completed={step > 1} 
            onEdit={() => setStep(1)}
            summary={getStep1Summary()}
          >
            <div className="space-y-6">
              {/* Per-store delivery method selector */}
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
                    <div className="flex items-center gap-2 mb-3 flex-wrap min-w-0">
                      <StoreIcon className="w-4 h-4 text-orange-500 shrink-0" />
                      <h3 className="font-black text-sm text-slate-900 dark:text-white tracking-tight truncate max-w-full">{group.store_name}</h3>
                      {enabledMethods.length === 1 && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-full capitalize shrink-0">{t("checkout.methodOnly", { method: enabledMethods[0] === "shipping" ? t("checkout.shippingLabel") : enabledMethods[0] === "delivery" ? t("checkout.deliveryLabel") : t("checkout.pickupLabel") })}</span>
                      )}
                    </div>

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

              {/* Delivery Address (only when needed) */}
              {needsAddress && (
                <div className="pt-6 border-t-2 border-slate-100 dark:border-slate-700 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      {storeGroups.every(g => storeDeliverySelections[g.store_id] === "delivery") ? t("checkout.deliveryAddress") : t("checkout.shippingAddress")}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addressResponse.addresses.map((addr) => (
                      <button
                        key={addr._id}
                        onClick={() => setSelectedAddressId(addr._id)}
                        className={`flex flex-col text-left p-4 rounded-xl border transition-all relative group ${
                          selectedAddressId === addr._id 
                            ? "border-orange-500 bg-gradient-to-r from-orange-50 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/20 shadow-md shadow-orange-500/10" 
                            : "border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-100/50 dark:bg-orange-900/30 px-2 py-0.5 rounded-full shrink-0">{addr.label || "Address"}</span>
                            {selectedAddressId === addr._id && <CheckCircle2 className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />}
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">{addr.street}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{addr.city}, {addr.state} {addr.zip}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{addr.country}</p>
                      </button>
                    ))}
                    
                    <button 
                        onClick={() => setIsAddingAddress(true)}
                        className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-gradient-to-br hover:from-orange-50 hover:to-orange-50 dark:hover:from-orange-900/10 dark:hover:to-orange-900/10 transition-all group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-gradient-to-br group-hover:from-orange-100 group-hover:to-orange-100 dark:group-hover:from-orange-900/40 dark:group-hover:to-orange-900/40 flex items-center justify-center mb-2 transition-all">
                            <Plus className="w-5 h-5 text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-500 group-hover:text-orange-600 dark:group-hover:text-orange-400">{t("checkout.addNewAddress")}</span>
                    </button>
                  </div>

                  {isAddingAddress && (
                    <div className="mt-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
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

              <Button 
                onClick={handleContinueFromStep1}
                disabled={isContinuing}
                className="w-full mt-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 h-14 rounded-xl font-semibold text-lg shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98]"
              >
                {isContinuing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {isContinuing ? t("checkout.loading") : t("checkout.continueToPayment")}
              </Button>
            </div>
          </CheckoutStep>

          {/* STEP 2: PAYMENT & REVIEW */}
          <CheckoutStep 
            number="2" 
            title={t("checkout.paymentAndReview")} 
            active={step === 2} 
            completed={false}
          >
            <div className="space-y-6">
{/* Payment Method */}
               <div>
                 <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">{t("checkout.paymentMethod")}</p>
                 <div className="space-y-3">
                   {PAYMENT_METHODS.filter(method => method.id !== 'card').map(method => (
                     <button
                       key={method.id}
                       onClick={() => setPaymentMethod(method.id)}
                       className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all group ${
                         paymentMethod === method.id
                           ? "border-orange-500 bg-gradient-to-r from-orange-50 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/20 shadow-md shadow-orange-500/10"
                           : "border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                       }`}
                     >
                       <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                         <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${paymentMethod === method.id ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"}`}>
                           {method.logo ? (
                             <img src={method.logo} alt={method.label} className="w-5 h-5 object-contain" />
                           ) : (
                             <span className="text-lg">{method.emoji}</span>
                           )}
                         </div>
                         <div className="text-left min-w-0">
                           <p className={`font-semibold text-sm truncate ${paymentMethod === method.id ? "text-orange-900 dark:text-orange-300" : "text-slate-900 dark:text-white"}`}>{method.label}</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{t("checkout.mobileMoneyPayment")}</p>
                         </div>
                       </div>
                       {paymentMethod === method.id && <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0"><CheckCircle2 className="w-4 h-4 text-white" /></div>}
                     </button>
                   ))}
                 </div>

                 {/* Phone Number Input for Mobile Money */}
                 {paymentMethod === 'mtn' || paymentMethod === 'airtel' ? (
                   <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                     <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 block">{t("checkout.phoneNumber")}</label>
                     <Input
                       type="tel"
                       placeholder="+250 7XX XXX XXX"
                       value={checkoutPhone}
                       onChange={e => setCheckoutPhone(e.target.value)}
                       className="rounded-xl h-11 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                     />
                     <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t("checkout.phonePaymentNote")}</p>
                   </div>
                 ) : null}
               </div>

              {/* Order Items Review */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-4">{t("checkout.orderReview")}</p>
                {calculations.storeBreakdown.map((store, idx) => {
                  const FulfillIcon = FULFILLMENT_ICONS[store.delivery_method] || Truck;
                  const storeInfo = storesMap[store.store_id];
                  const ds = storeInfo?.delivery_settings || {};
                  return (
                    <div key={store.store_id} className={`space-y-3 ${idx !== 0 ? "pt-6 border-t border-slate-200 dark:border-slate-700 mt-4" : ""}`}>
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <StoreIcon className="w-4 h-4 text-orange-600 shrink-0" />
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white tracking-tight truncate max-w-full">{store.store_name}</h3>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium shrink-0">{t("checkout.itemsCount", { count: store.items.length })}</span>
                      </div>
                      <div className="space-y-3">
                        {store.items.map(item => (
                          <div key={item._id} className="flex gap-3 group">
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                              <img src={item.product_image} alt={item.product_title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate">{item.product_title}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("checkout.qty", { qty: item.quantity, price: formatCurrency(item.product_price) })}</p>
                            </div>
                            <div className="text-right flex flex-col justify-center shrink-0">
                              <p className="font-semibold text-slate-900 dark:text-white text-sm">{formatCurrency(item.product_price * item.quantity)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center gap-2 py-2.5 px-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium min-w-0 truncate">
                          <FulfillIcon className="w-3.5 h-3.5 shrink-0" />
                          {store.delivery_method === "shipping" ? t("checkout.shippingLabel") : store.delivery_method === "delivery" ? t("checkout.deliveryLabel") : t("checkout.pickupLabel")}
                        </div>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white shrink-0">{store.shipping === 0 ? t("checkout.freeBadge") : formatCurrency(store.shipping)}</span>
                      </div>
                      {store.delivery_method === "pickup" && (
                        <div className="flex items-start gap-3 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3">
                          <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            {ds.pickup_instructions && (
                              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-2">{ds.pickup_instructions}</p>
                            )}
                            {storeInfo?.address && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {storeInfo.address}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Order Note */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-700 space-y-3">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">{t("checkout.orderNote")}</label>
                <Textarea 
                  value={orderNote} 
                  onChange={e => setOrderNote(e.target.value)} 
                  placeholder={t("checkout.orderNotePlaceholder")} 
                  className="rounded-xl min-h-[80px] border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400 resize-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" 
                />
              </div>

              {/* Secure Badge */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-purple-50 dark:from-orange-900/20 dark:to-purple-900/20 rounded-xl px-4 py-3 border border-orange-200/50 dark:border-orange-800/30">
                <Shield className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{t("checkout.securePaymentDesc")}</p>
              </div>

              {/* Mobile Money Payment Status */}
              {mobileMoneyStatus && (
                <div className={`p-6 rounded-2xl border-2 animate-in fade-in slide-in-from-bottom-4 duration-500 ${
                  mobileMoneyStatus === 'pending'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      mobileMoneyStatus === 'pending'
                        ? 'bg-amber-100 dark:bg-amber-800'
                        : 'bg-green-100 dark:bg-green-800'
                    }`}>
                      {mobileMoneyStatus === 'pending' ? (
                        <Loader2 className="w-6 h-6 animate-spin text-amber-600 dark:text-amber-400" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-black text-lg ${
                        mobileMoneyStatus === 'pending'
                          ? 'text-amber-900 dark:text-amber-300'
                          : 'text-green-900 dark:text-green-300'
                      }`}>
                        {mobileMoneyStatus === 'pending' ? 'Payment Pending' : 'Payment Completed'}
                      </h3>
                      <p className={`text-sm font-medium ${
                        mobileMoneyStatus === 'pending'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-green-700 dark:text-green-400'
                      }`}>
                        {mobileMoneyStatus === 'pending'
                          ? 'Check your phone for the USSD prompt to complete the payment. This may take up to 30 seconds.'
                          : 'Your payment has been successfully processed!'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-14 rounded-xl font-semibold text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 dark:hover:bg-slate-800">{t("common.back")}</Button>
                <Button 
                  onClick={() => checkoutMutation.mutate()} 
                  disabled={checkoutMutation.isPending}
                  className="flex-[2] bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white h-14 rounded-xl font-semibold text-lg shadow-lg shadow-orange-500/30 flex items-center justify-center gap-3 group"
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      {t("checkout.placeOrder")} <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CheckoutStep>
        </div>

        {/* SUMMARY SIDEBAR */}
        <div className="min-w-0 lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900/50 dark:to-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-100 to-purple-100 dark:from-orange-900/20 dark:to-purple-900/20 rounded-full -mr-16 -mt-16 opacity-50" />
              
              <h3 className="font-semibold text-xl text-slate-900 dark:text-white mb-6 tracking-tight flex items-center gap-3">
                  <ShoppingBag className="w-5 h-5 text-orange-600" /> {t("cart.orderSummary")}
              </h3>

              <div className="space-y-4 relative z-10">
                {/* Itemized product list */}
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {calculations.storeBreakdown.flatMap(store => store.items).map(item => (
                    <div key={item._id} className="flex justify-between gap-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-300 truncate min-w-0">
                        {item.product_title} <span className="text-slate-400 dark:text-slate-500">&times;{item.quantity}</span>
                      </span>
                      <span className="text-slate-900 dark:text-white font-medium shrink-0">{formatCurrency(item.product_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-slate-200 dark:bg-slate-700" />

                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                  <span>{t("checkout.itemsCount", { count: calculations.itemCount })}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                  <span>{t("cart.subtotal")}</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{formatCurrency(calculations.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                  <span>{t("checkout.fulfillment")}</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{calculations.shipping === 0 ? t("checkout.freeBadge") : formatCurrency(calculations.shipping)}</span>
                </div>
                {calculations.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                    <span className="flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> {t("common.discount")}</span>
                    <span>-{formatCurrency(calculations.discount)}</span>
                  </div>
                )}
                
                <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
                
                <div className="flex justify-between items-end pt-2">
                  <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("cart.total")}</span>
                      <span className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">{formatCurrency(calculations.total)}</span>
                  </div>
                </div>

                {/* Place Order Button */}
                <Button
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending}
                  className="w-full h-14 bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 rounded-xl font-semibold text-lg shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98] mt-4"
                >
                  {checkoutMutation.isPending ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("checkout.processing")}</>
                  ) : (
                    <><CreditCard className="w-5 h-5 mr-2" /> {t("checkout.placeOrder")}</>
                  )}
                </Button>

                {/* Coupon Code */}
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    {!appliedCoupon ? (
                        <div className="space-y-3">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("checkout.couponCode")}</label>
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
                                    className="h-11 rounded-xl font-semibold border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                                >
                                    {validateCouponMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.apply")}
                                </Button>
                            </div>
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
              </div>
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
