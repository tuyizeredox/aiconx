import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import {
  Store, Plus, Package, DollarSign, ShoppingCart, Trash2, Loader2, BarChart3, Eye,
  X, Upload, Camera, CheckCircle2, Play, Search, MessageCircle, Info, Truck, Navigation, Tag, Pencil, Check, Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import StoreAnalytics from "@/components/mystore/StoreAnalytics";
import AdvancedAnalytics from "@/components/mystore/AdvancedAnalytics";
import CouponManager from "@/components/mystore/CouponManager";
import SubscriptionManager from "@/components/mystore/SubscriptionManager";
import ShippingZoneManager from "@/components/mystore/ShippingZoneManager";
import AIProductGenerator from "@/components/mystore/AIProductGenerator";
import ColorInput from "@/components/product/ColorInput";
import SizeInput from "@/components/product/SizeInput";
import CustomOptionsInput from "@/components/product/CustomOptionsInput";
import VendorFinance from "./VendorFinance";
import OrderDetailModal from "@/components/orders/OrderDetailModal";
import { storesAPI, productsAPI, ordersAPI, vendorSubscriptionsAPI, filesAPI } from "@/api/apiClient";
import { uploadImage } from "@/lib/storage";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "react-i18next";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

const CATEGORIES = ["fashion", "electronics", "home", "beauty", "sports", "food", "art", "books", "handmade", "other"];

const PLAN_LIMITS = {
  free: { products: 10, images: 5, videos: 0, media: 5 },
  pro: { products: 200, images: 20, videos: 20, media: 20 },
  elite: { products: Infinity, images: Infinity, videos: Infinity, media: Infinity },
};

export default function MyStore() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "products";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderTab, setOrderTab] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);
  const [showCreateStore, setShowCreateStore] = useState(false);
  const [showEditStore, setShowEditStore] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [storeForm, setStoreForm] = useState({ 
    name: "", 
    description: "", 
    category: "other", 
    logo_url: "", 
    banner_url: "",
    // Payment Settings
    payment_method: "bank_transfer",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    routing_number: "",
    paypal_email: "",
    mobile_money_number: "",
    // Delivery Settings
    delivery_settings: {
      shipping_enabled: true,
      delivery_enabled: false,
      pickup_enabled: false,
      delivery_fee: 0,
      delivery_radius_km: 10,
      min_order_for_delivery: 0,
      free_delivery_above: 0,
      delivery_time_est: "",
      pickup_instructions: ""
    },
    // Additional Info
    phone_number: "",
    address: "",
    website_url: "",
    social_links: {
      facebook: "",
      instagram: "",
      twitter: "",
      tiktok: "",
    }
  });
  const [productForm, setProductForm] = useState({ title: "", description: "", price: "", compare_at_price: "", category: "other", inventory_count: "", affiliate_enabled: true, affiliate_commission_pct: "10", colors: [], sizes: [], custom_options: [] });
  const [productImages, setProductImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingAssets, setUploadingAssets] = useState({ logo: false, banner: false });
  const [editingStockId, setEditingStockId] = useState(null);
  const [stockValue, setStockValue] = useState("");
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "", compare_at_price: "", category: "other", inventory_count: "", affiliate_enabled: true, affiliate_commission_pct: "10", colors: [], sizes: [], custom_options: [] });
  const queryClient = useQueryClient();

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const maxMedia = limits.media;
    const currentImages = productImages.filter(f => f.type.startsWith("image/")).length;
    const currentVideos = productImages.filter(f => f.type.startsWith("video/")).length;
    
    let validFiles = [];
    let tempImagesCount = currentImages;
    let tempVideosCount = currentVideos;

    for (const file of files) {
      if (validFiles.length + productImages.length >= maxMedia) {
        toast.error(`Your ${currentPlan} plan allows up to ${maxMedia} total media files.`);
        break;
      }

      if (file.type.startsWith("image/")) {
        if (tempImagesCount >= limits.images) {
          toast.error(`Your ${currentPlan} plan allows up to ${limits.images} images.`);
          continue;
        }
        tempImagesCount++;
        validFiles.push(file);
      } else if (file.type.startsWith("video/")) {
        if (limits.videos === 0) {
          toast.error(`Video uploads are not available on the ${currentPlan} plan.`);
          continue;
        }
        if (tempVideosCount >= limits.videos) {
          toast.error(`Your ${currentPlan} plan allows up to ${limits.videos} videos.`);
          continue;
        }
        tempVideosCount++;
        validFiles.push(file);
      }
    }

    const newPreviews = validFiles.map(f => URL.createObjectURL(f));
    setProductImages(prev => [...prev, ...validFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setProductImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleAssetUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("store.imageFileOnly"));
      return;
    }

    setUploadingAssets(prev => ({ ...prev, [type]: true }));
    try {
      const res = await uploadImage(file, { folder: 'stores' });
      if (res.url) {
        setStoreForm(prev => ({ ...prev, [`${type}_url`]: res.url }));
        toast.success(t("store.assetUploaded", { type: t(`store.${type}`) }));
      }
    } catch (err) {
      toast.error(t("store.assetUploadFailed", { type: t(`store.${type}`) }));
    } finally {
      setUploadingAssets(prev => ({ ...prev, [type]: false }));
    }
  };

  const { user: currentUser } = useAuth();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["myStore", currentUser?.username],
    queryFn: async () => {
      return storesAPI.getByOwnerUsername(currentUser?.username);
    },
    enabled: !!currentUser?.username,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["myProducts", store?.id || store?._id],
    queryFn: async () => {
      const storeId = store?.id || store?._id;
      const res = await productsAPI.list({ store_id: storeId, sort: "-created_at", limit: 100 });
      return res.data || [];
    },
    enabled: !!(store?.id || store?._id),
  });

  const { data: subscription } = useQuery({
    queryKey: ["vendorSubscription", currentUser?.username],
    queryFn: async () => {
      const res = await vendorSubscriptionsAPI.list({ vendor_username: currentUser?.username });
      const subs = res.subscriptions || res.data || (Array.isArray(res) ? res : []);
      return subs.find(s => s.status === 'active') || null;
    },
    enabled: !!currentUser?.username,
  });

  const { isSubscriptionEnforced } = usePlatformSettings();
  const currentPlan = isSubscriptionEnforced ? (subscription?.plan || 'free') : 'elite';
  const limits = PLAN_LIMITS[currentPlan];

  // Auto-redirect to subscription if limit reached and trying to add product
  React.useEffect(() => {
    if (showAddProduct && products.length >= limits.products) {
      setShowAddProduct(false);
      setActiveTab("subscription");
      toast.error(`Subscription limit reached! Your ${currentPlan} plan allows up to ${limits.products === Infinity ? 'unlimited' : limits.products} products.`);
    }
  }, [showAddProduct, products.length, limits.products, currentPlan]);

  const { data: ordersResponse = {} } = useQuery({
    queryKey: ["storeOrders", currentUser?.username],
    queryFn: async () => {
      const res = await ordersAPI.list({ vendor_username: currentUser?.username, sort: "-created_at", limit: 50 });
      return res;
    },
    enabled: !!currentUser?.username,
  });
  
  const orders = Array.isArray(ordersResponse?.data) ? ordersResponse.data : [];

  const createStoreMutation = useMutation({
    mutationFn: () => storesAPI.create({
      ...storeForm,
      owner_username: currentUser.username,
      owner_name: currentUser.full_name,
      status: "active",
    }),
    onSuccess: () => {
      toast.success(t("store.storeCreated"));
      setShowCreateStore(false);
      queryClient.invalidateQueries({ queryKey: ["myStore"] });
    },
  });

  const updateStoreMutation = useMutation({
    mutationFn: (data) => storesAPI.update(store.id || store._id, data),
    onSuccess: () => {
      toast.success(t("store.storeUpdated"));
      setShowEditStore(false);
      queryClient.invalidateQueries({ queryKey: ["myStore"] });
    },
  });

  const addProductMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let imageUrls = [];
      let videoUrls = [];
      try {
        for (const file of productImages) {
          const res = await filesAPI.upload(file);
          if (res.url) {
            if (file.type.startsWith("video/")) {
              videoUrls.push(res.url);
            } else {
              imageUrls.push(res.url);
            }
          }
        }
      } catch (err) {
        toast.error(t("store.failedToUploadAssets"));
        throw err;
      } finally {
        setUploading(false);
      }

      const storeId = store?.id || store?._id;

      return productsAPI.create({
        ...productForm,
        images: imageUrls,
        videos: videoUrls,
        price: parseFloat(productForm.price),
        compare_at_price: productForm.compare_at_price ? parseFloat(productForm.compare_at_price) : undefined,
        inventory_count: parseInt(productForm.inventory_count) || 0,
        ...(currentPlan === 'elite' ? {
          affiliate_enabled: productForm.affiliate_enabled,
          affiliate_commission_pct: Math.min(100, Math.max(0, parseFloat(productForm.affiliate_commission_pct) || 0)),
        } : { affiliate_enabled: undefined, affiliate_commission_pct: undefined }),
        store_id: storeId,
        store_name: store.name,
        vendor_username: currentUser.username,
        status: "active",
      });
    },
    onSuccess: () => {
      toast.success("Product added!");
      setShowAddProduct(false);
      setProductForm({ title: "", description: "", price: "", compare_at_price: "", category: "other", inventory_count: "", affiliate_enabled: true, affiliate_commission_pct: "10", colors: [], sizes: [], custom_options: [] });
      setProductImages([]);
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setImagePreviews([]);
      queryClient.invalidateQueries({ queryKey: ["myProducts"] });
    },
    onError: (err) => {
      if (err.status === 403 || err.message?.toLowerCase().includes("limit")) {
        setShowAddProduct(false);
        setActiveTab("subscription");
        toast.error(`Subscription limit reached! Your ${currentPlan} plan allows up to ${limits.products === Infinity ? 'unlimited' : limits.products} products.`);
      } else {
        toast.error(err.message || t("store.failedToAddProduct"));
      }
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id) => productsAPI.delete(id),
    onSuccess: () => {
      toast.success("Product deleted");
      queryClient.invalidateQueries({ queryKey: ["myProducts"] });
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: ({ id, inventory_count }) => productsAPI.update(id, { inventory_count }),
    onSuccess: () => {
      toast.success(t("store.stockUpdated"));
      setEditingStockId(null);
      queryClient.invalidateQueries({ queryKey: ["myProducts"] });
    },
    onError: (err) => {
      toast.error(err.message || t("store.failedToUpdateStock"));
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }) => productsAPI.update(id, data),
    onSuccess: () => {
      toast.success(t("store.productUpdated"));
      setShowEditProduct(false);
      setEditingProduct(null);
      queryClient.invalidateQueries({ queryKey: ["myProducts"] });
    },
    onError: (err) => {
      toast.error(err.message || t("store.failedToUpdateProduct"));
    }
  });

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setEditForm({
      title: product.title || "",
      description: product.description || "",
      price: String(product.price ?? ""),
      compare_at_price: product.compare_at_price != null ? String(product.compare_at_price) : "",
      category: product.category || "other",
      inventory_count: String(product.inventory_count ?? 0),
      affiliate_enabled: product.affiliate_enabled !== false,
      affiliate_commission_pct: String(product.affiliate_commission_pct ?? 10),
      colors: product.colors || [],
      sizes: product.sizes || [],
      custom_options: product.custom_options || [],
    });
    setShowEditProduct(true);
  };

  const submitEditProduct = () => {
    const productId = editingProduct.id || editingProduct._id;
    const payload = {
      title: editForm.title,
      description: editForm.description,
      price: parseFloat(editForm.price),
      compare_at_price: editForm.compare_at_price ? parseFloat(editForm.compare_at_price) : undefined,
      category: editForm.category,
      inventory_count: Math.max(0, parseInt(editForm.inventory_count) || 0),
      colors: editForm.colors,
      sizes: editForm.sizes,
      custom_options: editForm.custom_options,
      ...(currentPlan === 'elite' ? {
        affiliate_enabled: editForm.affiliate_enabled,
        affiliate_commission_pct: Math.min(100, Math.max(0, parseFloat(editForm.affiliate_commission_pct) || 0)),
      } : {}),
    };
    updateProductMutation.mutate({ id: productId, data: payload });
  };

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ id, status }) => ordersAPI.updateStatus(id, status),
    onSuccess: () => {
      toast.success("Order status updated!");
      queryClient.invalidateQueries({ queryKey: ["storeOrders"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update order status");
    }
  });

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "confirmed").length;

  if (storeLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
  }

  if (!store) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-100 dark:from-orange-900 dark:to-orange-900 flex items-center justify-center mx-auto mb-6">
          <Store className="w-9 h-9 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t("store.createStoreTitle")}</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">{t("store.createStoreSubtitle")}</p>

        <Dialog open={showCreateStore} onOpenChange={setShowCreateStore}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl px-8 h-12 text-base">
              <Plus className="w-5 h-5 mr-2" /> {t("store.createStore")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{t("store.createStoreTitle")}</DialogTitle></DialogHeader>
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="general" className="px-1 sm:px-3 text-[11px] sm:text-sm">{t("store.basicInfo")}</TabsTrigger>
                <TabsTrigger value="payment" className="px-1 sm:px-3 text-[11px] sm:text-sm">{t("store.payouts")}</TabsTrigger>
                <TabsTrigger value="delivery" className="px-1 sm:px-3 text-[11px] sm:text-sm">{t("store.delivery")}</TabsTrigger>
              </TabsList>

              <div className="max-h-[60vh] overflow-y-auto pr-2">
                <TabsContent value="general" className="space-y-4 pt-2">
                  <Input placeholder={t("store.storeNamePlaceholder")} value={storeForm.name} onChange={(e) => setStoreForm(p => ({ ...p, name: e.target.value }))} />
                  <Textarea placeholder={t("store.describeStorePlaceholder")} value={storeForm.description} onChange={(e) => setStoreForm(p => ({ ...p, description: e.target.value }))} />
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{t("store.storeLogo")}</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                          {storeForm.logo_url ? (
                            <img src={storeForm.logo_url} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-5 h-5 text-slate-300 dark:text-slate-500" />
                          )}
                        </div>
                        <div className="relative flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => handleAssetUpload(e, 'logo')}
                            disabled={uploadingAssets.logo}
                          />
                          <Button variant="outline" size="sm" className="w-full text-xs h-9 rounded-lg" disabled={uploadingAssets.logo}>
                            {uploadingAssets.logo ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Camera className="w-3.5 h-3.5 mr-1.5" />}
                            {storeForm.logo_url ? t("store.change") : t("store.upload")}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{t("store.storeBanner")}</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                          {storeForm.banner_url ? (
                            <img src={storeForm.banner_url} alt="Banner" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-5 h-5 text-slate-300 dark:text-slate-500" />
                          )}
                        </div>
                        <div className="relative flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => handleAssetUpload(e, 'banner')}
                            disabled={uploadingAssets.banner}
                          />
                          <Button variant="outline" size="sm" className="w-full text-xs h-9 rounded-lg" disabled={uploadingAssets.banner}>
                            {uploadingAssets.banner ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Camera className="w-3.5 h-3.5 mr-1.5" />}
                            {storeForm.banner_url ? t("store.change") : t("store.upload")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Select value={storeForm.category} onValueChange={(v) => setStoreForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`explore.cat.${c}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TabsContent>

                <TabsContent value="payment" className="space-y-4 pt-2">
                  <p className="text-xs text-slate-500 mb-2">{t("store.configureEarnings")}</p>
                  <Select value={storeForm.payment_method} onValueChange={(v) => setStoreForm(p => ({ ...p, payment_method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">{t("store.bankTransfer")}</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="mobile_money">{t("store.mobileMoney")}</SelectItem>
                    </SelectContent>
                  </Select>

                  {storeForm.payment_method === 'bank_transfer' && (
                    <div className="space-y-3 border-l-2 border-orange-100 dark:border-orange-900 pl-4">
                      <Input placeholder={t("store.bankName")} value={storeForm.bank_name} onChange={e => setStoreForm(p => ({ ...p, bank_name: e.target.value }))} />
                      <Input placeholder={t("store.accountHolderName")} value={storeForm.bank_account_name} onChange={e => setStoreForm(p => ({ ...p, bank_account_name: e.target.value }))} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input placeholder={t("store.accountNumber")} value={storeForm.bank_account_number} onChange={e => setStoreForm(p => ({ ...p, bank_account_number: e.target.value }))} />
                        <Input placeholder={t("store.routingNumber")} value={storeForm.routing_number} onChange={e => setStoreForm(p => ({ ...p, routing_number: e.target.value }))} />
                      </div>
                    </div>
                  )}

                  {storeForm.payment_method === 'paypal' && (
                    <div className="space-y-3 border-l-2 border-orange-100 dark:border-orange-900 pl-4">
                      <Input type="email" placeholder={t("store.paypalEmail")} value={storeForm.paypal_email} onChange={e => setStoreForm(p => ({ ...p, paypal_email: e.target.value }))} />
                    </div>
                  )}

                  {storeForm.payment_method === 'mobile_money' && (
                    <div className="space-y-3 border-l-2 border-orange-100 dark:border-orange-900 pl-4">
                      <Input placeholder={t("store.mobileMoneyNumber")} value={storeForm.mobile_money_number} onChange={e => setStoreForm(p => ({ ...p, mobile_money_number: e.target.value }))} />
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("store.mobileMoneyHint")}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="delivery" className="space-y-6 pt-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                      <div className="space-y-0.5">
                        <Label>{t("store.shipping")}</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t("store.shippingDesc")}</p>
                      </div>
                      <Switch 
                        checked={storeForm.delivery_settings.shipping_enabled} 
                        onCheckedChange={(v) => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, shipping_enabled: v } }))} 
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                      <div className="space-y-0.5">
                        <Label>{t("store.localDelivery")}</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t("store.localDeliveryDesc")}</p>
                      </div>
                      <Switch 
                        checked={storeForm.delivery_settings.delivery_enabled} 
                        onCheckedChange={(v) => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, delivery_enabled: v } }))} 
                      />
                    </div>

                    {storeForm.delivery_settings.delivery_enabled && (
                      <div className="space-y-3 border-l-2 border-orange-100 dark:border-orange-900 pl-4 py-1">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">{t("store.deliveryFee")}</Label>
                            <Input 
                              type="number" 
                              value={storeForm.delivery_settings.delivery_fee} 
                              onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, delivery_fee: parseFloat(e.target.value) || 0 } }))} 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">{t("store.radiusKm")}</Label>
                            <Input 
                              type="number" 
                              value={storeForm.delivery_settings.delivery_radius_km} 
                              onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, delivery_radius_km: parseFloat(e.target.value) || 0 } }))} 
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">{t("store.minOrder")}</Label>
                            <Input 
                              type="number" 
                              value={storeForm.delivery_settings.min_order_for_delivery} 
                              onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, min_order_for_delivery: parseFloat(e.target.value) || 0 } }))} 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">{t("store.freeDeliveryOver")}</Label>
                            <Input 
                              type="number" 
                              value={storeForm.delivery_settings.free_delivery_above} 
                              onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, free_delivery_above: parseFloat(e.target.value) || 0 } }))} 
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t("store.estDeliveryTime")}</Label>
                          <Input 
                            placeholder={t("store.estDeliveryTimePlaceholder")} 
                            value={storeForm.delivery_settings.delivery_time_est} 
                            onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, delivery_time_est: e.target.value } }))} 
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                      <div className="space-y-0.5">
                        <Label>{t("store.storePickup")}</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t("store.storePickupDesc")}</p>
                      </div>
                      <Switch 
                        checked={storeForm.delivery_settings.pickup_enabled} 
                        onCheckedChange={(v) => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, pickup_enabled: v } }))} 
                      />
                    </div>

                    {storeForm.delivery_settings.pickup_enabled && (
                      <div className="space-y-1.5 border-l-2 border-orange-100 dark:border-orange-900 pl-4 py-1">
                        <Label className="text-xs">{t("store.pickupInstructions")}</Label>
                        <Textarea 
                          placeholder={t("store.pickupInstructionsPlaceholder")} 
                          value={storeForm.delivery_settings.pickup_instructions} 
                          onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, pickup_instructions: e.target.value } }))} 
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>

              <div className="mt-6">
                <Button onClick={() => createStoreMutation.mutate()} disabled={!storeForm.name.trim() || createStoreMutation.isPending} className="w-full bg-orange-600 hover:bg-orange-700 h-11">
                  {createStoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t("store.createMyStore")}
                </Button>
              </div>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Store Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shrink-0 overflow-hidden">
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                store.name?.[0]?.toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">{store.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{store.description || t("store.noDescription")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Dialog open={showEditStore} onOpenChange={setShowEditStore}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl"
                  onClick={() => setStoreForm({
                    name: store.name,
                    description: store.description,
                    category: store.category || "other",
                    logo_url: store.logo_url || "",
                    banner_url: store.banner_url || "",
                    payment_method: store.payment_method || "bank_transfer",
                    bank_name: store.bank_name || "",
                    bank_account_name: store.bank_account_name || "",
                    bank_account_number: store.bank_account_number || "",
                    routing_number: store.routing_number || "",
                    paypal_email: store.paypal_email || "",
                    mobile_money_number: store.mobile_money_number || "",
                    delivery_settings: {
                      shipping_enabled: store.delivery_settings?.shipping_enabled ?? true,
                      delivery_enabled: store.delivery_settings?.delivery_enabled ?? false,
                      pickup_enabled: store.delivery_settings?.pickup_enabled ?? false,
                      delivery_fee: store.delivery_settings?.delivery_fee ?? 0,
                      delivery_radius_km: store.delivery_settings?.delivery_radius_km ?? 10,
                      min_order_for_delivery: store.delivery_settings?.min_order_for_delivery ?? 0,
                      free_delivery_above: store.delivery_settings?.free_delivery_above ?? 0,
                      delivery_time_est: store.delivery_settings?.delivery_time_est ?? "",
                      pickup_instructions: store.delivery_settings?.pickup_instructions ?? ""
                    },
                    phone_number: store.phone_number || "",
                    address: store.address || "",
                    website_url: store.website_url || "",
                    social_links: {
                      facebook: store.social_links?.facebook || "",
                      instagram: store.social_links?.instagram || "",
                      twitter: store.social_links?.twitter || "",
                      tiktok: store.social_links?.tiktok || "",
                    }
                  })}
                >
                  {t("store.editStore")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{t("store.editStoreDetails")}</DialogTitle></DialogHeader>
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid grid-cols-4 mb-4">
                    <TabsTrigger value="general" className="px-1 sm:px-3 text-[10px] sm:text-sm">{t("store.general")}</TabsTrigger>
                    <TabsTrigger value="payment" className="px-1 sm:px-3 text-[10px] sm:text-sm">{t("store.payment")}</TabsTrigger>
                    <TabsTrigger value="delivery" className="px-1 sm:px-3 text-[10px] sm:text-sm">{t("store.delivery")}</TabsTrigger>
                    <TabsTrigger value="additional" className="px-1 sm:px-3 text-[10px] sm:text-sm">{t("store.additional")}</TabsTrigger>
                  </TabsList>
                  
                  <div className="max-h-[60vh] overflow-y-auto pr-2">
                    <TabsContent value="general" className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("store.storeName")}</label>
                        <Input placeholder={t("store.storeNamePlaceholder")} value={storeForm.name} onChange={(e) => setStoreForm(p => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("store.description")}</label>
                        <Textarea placeholder={t("store.describeStorePlaceholder")} value={storeForm.description} onChange={(e) => setStoreForm(p => ({ ...p, description: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t("store.storeLogo")}</label>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                              {storeForm.logo_url ? (
                                <img src={storeForm.logo_url} alt="Logo" className="w-full h-full object-cover" />
                              ) : (
                                <Upload className="w-5 h-5 text-slate-300" />
                              )}
                            </div>
                            <div className="relative flex-1">
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => handleAssetUpload(e, 'logo')}
                                disabled={uploadingAssets.logo}
                              />
                              <Button variant="outline" size="sm" className="w-full text-xs h-9 rounded-lg" disabled={uploadingAssets.logo}>
                                {uploadingAssets.logo ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Camera className="w-3.5 h-3.5 mr-1.5" />}
                                {storeForm.logo_url ? t("store.changeLogo") : t("store.uploadLogo")}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t("store.storeBanner")}</label>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                              {storeForm.banner_url ? (
                                <img src={storeForm.banner_url} alt="Banner" className="w-full h-full object-cover" />
                              ) : (
                                <Upload className="w-5 h-5 text-slate-300" />
                              )}
                            </div>
                            <div className="relative flex-1">
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => handleAssetUpload(e, 'banner')}
                                disabled={uploadingAssets.banner}
                              />
                              <Button variant="outline" size="sm" className="w-full text-xs h-9 rounded-lg" disabled={uploadingAssets.banner}>
                                {uploadingAssets.banner ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Camera className="w-3.5 h-3.5 mr-1.5" />}
                                {storeForm.banner_url ? t("store.changeBanner") : t("store.uploadBanner")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("store.category")}</label>
                        <Select value={storeForm.category} onValueChange={(v) => setStoreForm(p => ({ ...p, category: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`explore.cat.${c}`)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>

                    <TabsContent value="payment" className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("store.defaultPayoutMethod")}</label>
                        <Select value={storeForm.payment_method} onValueChange={(v) => setStoreForm(p => ({ ...p, payment_method: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">{t("store.bankTransfer")}</SelectItem>
                            <SelectItem value="paypal">PayPal</SelectItem>
                             <SelectItem value="itecpay">ITEC Pay</SelectItem>
                            <SelectItem value="mobile_money">{t("store.mobileMoney")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {storeForm.payment_method === 'bank_transfer' && (
                        <div className="space-y-4 border-l-2 border-orange-100 dark:border-orange-900 pl-4 py-1 mt-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.bankName")}</label>
                            <Input placeholder={t("store.bankNamePlaceholder")} value={storeForm.bank_name} onChange={e => setStoreForm(p => ({ ...p, bank_name: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.accountHolderName")}</label>
                            <Input placeholder={t("store.accountHolderNamePlaceholder")} value={storeForm.bank_account_name} onChange={e => setStoreForm(p => ({ ...p, bank_account_name: e.target.value }))} />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.accountNumber")}</label>
                              <Input placeholder={t("store.accountNumber")} value={storeForm.bank_account_number} onChange={e => setStoreForm(p => ({ ...p, bank_account_number: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.routingNumber")}</label>
                              <Input placeholder={t("store.routingNumber")} value={storeForm.routing_number} onChange={e => setStoreForm(p => ({ ...p, routing_number: e.target.value }))} />
                            </div>
                          </div>
                        </div>
                      )}

                      {storeForm.payment_method === 'paypal' && (
                        <div className="space-y-2 border-l-2 border-orange-100 dark:border-orange-900 pl-4 py-1 mt-4">
                          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.paypalEmail")}</label>
                          <Input type="email" placeholder="email@example.com" value={storeForm.paypal_email} onChange={e => setStoreForm(p => ({ ...p, paypal_email: e.target.value }))} />
                        </div>
                      )}

                      {storeForm.payment_method === 'mobile_money' && (
                        <div className="space-y-2 border-l-2 border-orange-100 dark:border-orange-900 pl-4 py-1 mt-4">
                          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.mobileMoneyNumber")}</label>
                          <Input placeholder="07XXXXXXXX" value={storeForm.mobile_money_number} onChange={e => setStoreForm(p => ({ ...p, mobile_money_number: e.target.value }))} />
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="delivery" className="space-y-6 pt-2">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
                          <div className="space-y-1">
                            <Label className="text-base">{t("store.shipping")}</Label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t("store.shippingDesc")}</p>
                          </div>
                          <Switch 
                            checked={storeForm.delivery_settings.shipping_enabled} 
                            onCheckedChange={(v) => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, shipping_enabled: v } }))} 
                          />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
                          <div className="space-y-1">
                            <Label className="text-base">{t("store.localDelivery")}</Label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t("store.localDeliveryDesc")}</p>
                          </div>
                          <Switch 
                            checked={storeForm.delivery_settings.delivery_enabled} 
                            onCheckedChange={(v) => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, delivery_enabled: v } }))} 
                          />
                        </div>

                        {storeForm.delivery_settings.delivery_enabled && (
                          <div className="space-y-4 border-l-2 border-orange-100 dark:border-orange-900 pl-4 py-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.deliveryFee")}</Label>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={storeForm.delivery_settings.delivery_fee}
                                  onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, delivery_fee: parseFloat(e.target.value) || 0 } }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.deliveryRadiusKm")}</Label>
                                <Input
                                  type="number"
                                  placeholder="10"
                                  value={storeForm.delivery_settings.delivery_radius_km}
                                  onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, delivery_radius_km: parseFloat(e.target.value) || 0 } }))}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.minOrderForDelivery")}</Label>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={storeForm.delivery_settings.min_order_for_delivery}
                                  onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, min_order_for_delivery: parseFloat(e.target.value) || 0 } }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.freeDeliveryAbove")}</Label>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={storeForm.delivery_settings.free_delivery_above}
                                  onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, free_delivery_above: parseFloat(e.target.value) || 0 } }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.estDeliveryTime")}</Label>
                              <Input 
                                placeholder={t("store.estDeliveryTimePlaceholder2")} 
                                value={storeForm.delivery_settings.delivery_time_est} 
                                onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, delivery_time_est: e.target.value } }))} 
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
                          <div className="space-y-1">
                            <Label className="text-base">{t("store.storePickup")}</Label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t("store.storePickupDesc2")}</p>
                          </div>
                          <Switch 
                            checked={storeForm.delivery_settings.pickup_enabled} 
                            onCheckedChange={(v) => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, pickup_enabled: v } }))} 
                          />
                        </div>

                        {storeForm.delivery_settings.pickup_enabled && (
                          <div className="space-y-2 border-l-2 border-orange-100 dark:border-orange-900 pl-4 py-1">
                            <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("store.pickupInstructions")}</Label>
                            <Textarea 
                              placeholder={t("store.pickupInstructionsPlaceholder2")} 
                              className="min-h-[100px]"
                              value={storeForm.delivery_settings.pickup_instructions} 
                              onChange={e => setStoreForm(p => ({ ...p, delivery_settings: { ...p.delivery_settings, pickup_instructions: e.target.value } }))} 
                            />
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="additional" className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t("store.phoneNumber")}</label>
                          <Input placeholder="+1 234 567 890" value={storeForm.phone_number} onChange={(e) => setStoreForm(p => ({ ...p, phone_number: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t("store.websiteUrl")}</label>
                          <Input placeholder="https://example.com" value={storeForm.website_url} onChange={(e) => setStoreForm(p => ({ ...p, website_url: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("store.storeAddress")}</label>
                        <Input placeholder={t("store.storeAddressPlaceholder")} value={storeForm.address} onChange={(e) => setStoreForm(p => ({ ...p, address: e.target.value }))} />
                      </div>
                      <div className="space-y-3 pt-2">
                        <label className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("store.socialMediaHandles")}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">Instagram</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 font-medium">@</span>
                              <Input 
                                className="pl-7 h-10 text-xs rounded-xl" 
                                placeholder="username" 
                                value={storeForm.social_links?.instagram?.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '').replace('@', '')} 
                                onChange={(e) => setStoreForm(p => ({ ...p, social_links: { ...p.social_links, instagram: e.target.value } }))} 
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">TikTok</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 font-medium">@</span>
                              <Input 
                                className="pl-7 h-10 text-xs rounded-xl" 
                                placeholder="username" 
                                value={storeForm.social_links?.tiktok?.replace(/^(https?:\/\/)?(www\.)?tiktok\.com\/@?/, '').replace('@', '')} 
                                onChange={(e) => setStoreForm(p => ({ ...p, social_links: { ...p.social_links, tiktok: e.target.value } }))} 
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">Twitter / X</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 font-medium">@</span>
                              <Input 
                                className="pl-7 h-10 text-xs rounded-xl" 
                                placeholder="username" 
                                value={storeForm.social_links?.twitter?.replace(/^(https?:\/\/)?(www\.)?(twitter|x)\.com\//, '').replace('@', '')} 
                                onChange={(e) => setStoreForm(p => ({ ...p, social_links: { ...p.social_links, twitter: e.target.value } }))} 
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">Facebook</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 dark:text-slate-500 font-medium">fb.com/</span>
                              <Input 
                                className="pl-14 h-10 text-xs rounded-xl" 
                                placeholder="page-handle" 
                                value={storeForm.social_links?.facebook?.replace(/^(https?:\/\/)?(www\.)?facebook\.com\//, '')} 
                                onChange={(e) => setStoreForm(p => ({ ...p, social_links: { ...p.social_links, facebook: e.target.value } }))} 
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </div>

                  <div className="mt-6">
                    <Button onClick={() => updateStoreMutation.mutate(storeForm)} disabled={!storeForm.name.trim() || updateStoreMutation.isPending} className="w-full bg-orange-600 hover:bg-orange-700 h-11">
                      {updateStoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {t("store.saveAllChanges")}
                    </Button>
                  </div>
                </Tabs>
              </DialogContent>
            </Dialog>
            <Link to={createPageUrl("StoreDetail") + `?id=${store.id || store._id}`}>
              <Button variant="outline" size="sm" className="rounded-xl">
                <Eye className="w-4 h-4 mr-1.5" /> {t("store.viewStore")}
              </Button>
            </Link>
          </div>
        </div>

        {/* Onboarding Checklist */}
        {(!store.logo_url || !store.description || products.length === 0 || !store.payment_method) && (
          <div className="mb-6 p-4 bg-orange-50/50 dark:bg-orange-950/30 rounded-2xl border border-orange-100/50 dark:border-orange-900/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-orange-900 dark:text-orange-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {t("store.setupProgress")}
              </h3>
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {Math.round(
                  ((store.logo_url ? 1 : 0) + 
                  (store.description ? 1 : 0) + 
                  (products.length > 0 ? 1 : 0) + 
                  (store.payment_method ? 1 : 0)) / 4 * 100
                )}% {t("store.complete")}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: t("store.setupAddLogo"), done: !!store.logo_url },
                { label: t("store.setupDescribeStore"), done: !!store.description },
                { label: t("store.setupAddProduct"), done: products.length > 0 },
                { label: t("store.setupPayoutMethod"), done: !!store.payment_method },
              ].map((step, i) => (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-xl border ${step.done ? 'bg-white/50 dark:bg-slate-700/50 border-orange-100 dark:border-orange-900 text-orange-600' : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 text-slate-400'}`}>
                  {step.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 dark:border-slate-600" />}
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: t("store.products"), value: products.length, icon: Package, color: "text-orange-500 bg-orange-50 dark:bg-orange-950" },
            { label: t("store.orders"), value: orders.length, icon: ShoppingCart, color: "text-purple-500 bg-purple-50 dark:bg-purple-950" },
            { label: t("store.revenue"), value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-green-500 bg-green-50 dark:bg-green-950" },
            { label: t("store.pending"), value: pendingOrders, icon: BarChart3, color: "text-amber-500 bg-amber-50 dark:bg-amber-950" },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-2`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 w-full sm:w-auto">
          <TabsList className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 w-full sm:w-auto overflow-x-auto scrollbar-hide justify-start">
            <TabsTrigger value="products">{t("store.products")}</TabsTrigger>
            <TabsTrigger value="orders">{t("store.orders")}</TabsTrigger>
            <TabsTrigger value="coupons">{t("store.coupons")}</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              {t("store.analytics")} 
              {currentPlan === 'free' ? <Badge className="px-1 py-0 text-[8px] bg-orange-100 text-orange-600 border-0">Standard</Badge> : <Badge className="px-1 py-0 text-[8px] bg-amber-100 text-amber-600 border-0">Pro+</Badge>}
            </TabsTrigger>
            <TabsTrigger value="shipping" className="gap-1.5">
              {t("store.shipping")}
              {currentPlan === 'free' && <Badge className="px-1 py-0 text-[8px] bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-0">Pro+</Badge>}
            </TabsTrigger>
            <TabsTrigger value="subscription">{t("store.plan")}</TabsTrigger>
            <TabsTrigger value="finance">{t("store.finance")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "products" && (
          <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
            {products.length >= limits.products ? (
              <Button 
                onClick={() => {
                  setActiveTab("subscription");
                  toast.error(t("store.subscriptionLimitReached", { plan: currentPlan, limit: limits.products === Infinity ? t("store.unlimited") : limits.products }));
                }}
                className="bg-orange-600 hover:bg-orange-700 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-1.5" /> {t("store.addProduct")}
              </Button>
            ) : (
              <DialogTrigger asChild>
                <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl">
                  <Plus className="w-4 h-4 mr-1.5" /> {t("store.addProduct")}
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("store.addProduct")}</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">
                <AIProductGenerator 
                  plan={currentPlan} 
                  onUpgrade={() => {
                    setShowAddProduct(false);
                    setActiveTab("subscription");
                  }}
                  onApply={(ai) => setProductForm(p => ({
                    ...p,
                    title: ai.title || p.title,
                    description: ai.description || p.description,
                  }))} 
                />
                <Input placeholder={t("store.productTitle")} value={productForm.title} onChange={(e) => setProductForm(p => ({ ...p, title: e.target.value }))} />
                <Textarea placeholder={t("store.productDescription")} value={productForm.description} onChange={(e) => setProductForm(p => ({ ...p, description: e.target.value }))} />
                
                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> {t("store.productMedia", { limit: limits.images === Infinity ? t("store.unlimited") : limits.images })}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {imagePreviews.map((url, i) => {
                      const isVideo = productImages[i]?.type?.startsWith("video/");
                      return (
                        <div key={`preview-${i}-${url}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 group">
                          {isVideo ? (
                            <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700">
                              <video src={url} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <Play className="w-6 h-6 text-white fill-white" />
                              </div>
                            </div>
                          ) : (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={() => removeImage(i)}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    {(limits.images === Infinity || productImages.length < limits.images) && (
                      <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 dark:hover:border-orange-600 hover:bg-orange-50/30 dark:hover:bg-orange-950/30 transition-all text-slate-400 dark:text-slate-500">
                        <Upload className="w-5 h-5" />
                        <span className="text-[10px] mt-1 font-medium">{t("store.upload")}</span>
                        <input type="file" accept={limits.videos === 0 ? "image/*" : "image/*,video/*"} multiple className="hidden" onChange={handleFileChange} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" placeholder={t("store.productPrice")} value={productForm.price} onChange={(e) => setProductForm(p => ({ ...p, price: e.target.value }))} />
                  <Input type="number" placeholder={t("store.compareAtPrice")} value={productForm.compare_at_price} onChange={(e) => setProductForm(p => ({ ...p, compare_at_price: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={productForm.category} onValueChange={(v) => setProductForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`explore.cat.${c}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder={t("store.inventoryCount")} value={productForm.inventory_count} onChange={(e) => setProductForm(p => ({ ...p, inventory_count: e.target.value }))} />
                </div>

                <ColorInput colors={productForm.colors} onChange={(colors) => setProductForm(p => ({ ...p, colors }))} />
                <SizeInput sizes={productForm.sizes} onChange={(sizes) => setProductForm(p => ({ ...p, sizes }))} />
                <CustomOptionsInput options={productForm.custom_options} onChange={(custom_options) => setProductForm(p => ({ ...p, custom_options }))} />

                {/* Affiliate Marketing Settings */}
                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link2 className="w-4 h-4 text-orange-500 shrink-0" />
                      <div className="min-w-0">
                        <Label className="text-sm">{t("store.allowAffiliate")}</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t("store.allowAffiliateDesc")}</p>
                      </div>
                    </div>
                    {currentPlan === 'elite' ? (
                      <Switch
                        checked={productForm.affiliate_enabled}
                        onCheckedChange={(v) => setProductForm(p => ({ ...p, affiliate_enabled: v }))}
                      />
                    ) : (
                      <Badge className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-600 border-0 shrink-0">{t("store.eliteFeature")}</Badge>
                    )}
                  </div>
                  {currentPlan === 'elite' && productForm.affiliate_enabled && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("store.commissionRate")}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={productForm.affiliate_commission_pct}
                          onChange={(e) => setProductForm(p => ({ ...p, affiliate_commission_pct: e.target.value }))}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  )}
                  {currentPlan !== 'elite' && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-500">{t("store.affiliateEliteOnlyDesc")}</p>
                  )}
                </div>

                <Button
                  onClick={() => addProductMutation.mutate()}
                  disabled={!productForm.title.trim() || !productForm.price || addProductMutation.isPending || uploading} 
                  className="w-full bg-orange-600 hover:bg-orange-700 h-11 rounded-xl font-bold"
                >
                  {addProductMutation.isPending || uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {uploading ? t("store.uploadingMedia") : t("store.addingProduct")}</>
                  ) : t("store.publishProduct")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Products Tab */}
      {activeTab === "products" && (
        <div className="space-y-2">
          {products.length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500">{t("store.noProductsDesc")}</div>
          ) : (
            products.map((product, idx) => {
              const productId = product.id || product._id || `product-${idx}`;
              return (
                <motion.div key={productId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                    {product.images?.[0] && <img src={product.images[0]} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{product.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-orange-600">{formatCurrency(product.price)}</span>
                      <Badge variant="secondary" className="text-[10px]">{product.status}</Badge>
                      {editingStockId === productId ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            autoFocus
                            value={stockValue}
                            onChange={(e) => setStockValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateStockMutation.mutate({ id: productId, inventory_count: Math.max(0, parseInt(stockValue) || 0) });
                              } else if (e.key === "Escape") {
                                setEditingStockId(null);
                              }
                            }}
                            className="h-6 w-16 text-xs px-1.5"
                          />
                          <button
                            onClick={() => updateStockMutation.mutate({ id: productId, inventory_count: Math.max(0, parseInt(stockValue) || 0) })}
                            disabled={updateStockMutation.isPending}
                            className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-950 text-slate-400 hover:text-green-600"
                          >
                            {updateStockMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setEditingStockId(null)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingStockId(productId); setStockValue(String(product.inventory_count || 0)); }}
                          className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                        >
                          {t("store.stock")}: {product.inventory_count || 0}
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <button onClick={() => openEditProduct(product)} className="p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950 text-slate-400 hover:text-orange-500 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteProductMutation.mutate(productId)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Edit Product Dialog */}
      <Dialog open={showEditProduct} onOpenChange={(open) => { setShowEditProduct(open); if (!open) setEditingProduct(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("store.editProduct")}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">
            <Input placeholder={t("store.productTitle")} value={editForm.title} onChange={(e) => setEditForm(p => ({ ...p, title: e.target.value }))} />
            <Textarea placeholder={t("store.productDescription")} value={editForm.description} onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))} />

            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder={t("store.productPrice")} value={editForm.price} onChange={(e) => setEditForm(p => ({ ...p, price: e.target.value }))} />
              <Input type="number" placeholder={t("store.compareAtPrice")} value={editForm.compare_at_price} onChange={(e) => setEditForm(p => ({ ...p, compare_at_price: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={editForm.category} onValueChange={(v) => setEditForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`explore.cat.${c}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" placeholder={t("store.inventoryCount")} value={editForm.inventory_count} onChange={(e) => setEditForm(p => ({ ...p, inventory_count: e.target.value }))} />
            </div>

            <ColorInput colors={editForm.colors} onChange={(colors) => setEditForm(p => ({ ...p, colors }))} />
            <SizeInput sizes={editForm.sizes} onChange={(sizes) => setEditForm(p => ({ ...p, sizes }))} />
            <CustomOptionsInput options={editForm.custom_options} onChange={(custom_options) => setEditForm(p => ({ ...p, custom_options }))} />

            {/* Affiliate Marketing Settings */}
            <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 className="w-4 h-4 text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-sm">{t("store.allowAffiliate")}</Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t("store.allowAffiliateDesc")}</p>
                  </div>
                </div>
                {currentPlan === 'elite' ? (
                  <Switch
                    checked={editForm.affiliate_enabled}
                    onCheckedChange={(v) => setEditForm(p => ({ ...p, affiliate_enabled: v }))}
                  />
                ) : (
                  <Badge className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-600 border-0 shrink-0">{t("store.eliteFeature")}</Badge>
                )}
              </div>
              {currentPlan === 'elite' && editForm.affiliate_enabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("store.commissionRate")}</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.affiliate_commission_pct}
                      onChange={(e) => setEditForm(p => ({ ...p, affiliate_commission_pct: e.target.value }))}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                  </div>
                </div>
              )}
              {currentPlan !== 'elite' && (
                <p className="text-[11px] text-amber-600 dark:text-amber-500">{t("store.affiliateEliteOnlyDesc")}</p>
              )}
            </div>

            <Button
              onClick={submitEditProduct}
              disabled={!editForm.title.trim() || !editForm.price || updateProductMutation.isPending}
              className="w-full bg-orange-600 hover:bg-orange-700 h-11 rounded-xl font-bold"
            >
              {updateProductMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("store.savingChanges")}</>
              ) : t("store.saveChanges")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shipping Tab */}
      {activeTab === "shipping" && (
        currentPlan === 'free' ? (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
             <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
               <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t("store.shippingZonesRestricted")}</h3>
             <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">{t("store.shippingZonesRestrictedDesc")}</p>
             <Button onClick={() => setActiveTab("subscription")} className="bg-orange-600 hover:bg-orange-700 rounded-xl">{t("store.upgradePlan")}</Button>
          </div>
        ) : (
          <ShippingZoneManager store={store} vendorUsername={currentUser?.username} plan={currentPlan} onUpgrade={() => setActiveTab("subscription")} />
        )
      )}

      {/* Subscription Tab */}
      {activeTab === "subscription" && (
        <SubscriptionManager store={store} vendorUsername={currentUser?.username} />
      )}

      {/* Finance Tab */}
      {activeTab === "finance" && (
        <VendorFinance />
      )}

      {/* Coupons Tab */}
      {activeTab === "coupons" && (
        currentPlan === 'free' ? (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
             <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
               <Tag className="w-8 h-8 text-slate-300 dark:text-slate-600" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t("store.couponsRestricted")}</h3>
             <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">{t("store.couponsRestrictedDesc")}</p>
             <Button onClick={() => setActiveTab("subscription")} className="bg-orange-600 hover:bg-orange-700 rounded-xl">{t("store.upgradePlan")}</Button>
          </div>
        ) : (
          <CouponManager store={store} vendorUsername={currentUser?.username} />
        )
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        currentPlan === 'elite' || currentPlan === 'pro' ? (
          <AdvancedAnalytics orders={orders} products={products} plan={currentPlan} onUpgrade={() => setActiveTab("subscription")} />
        ) : (
          <StoreAnalytics orders={orders} products={products} plan={currentPlan} onUpgrade={() => setActiveTab("subscription")} />
        )
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <Input 
                placeholder={t("store.searchOrders")}
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="pl-10 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 rounded-2xl"
              />
            </div>
          </div>

          <Tabs value={orderTab} onValueChange={setOrderTab} className="w-full">
            <TabsList className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 w-full justify-start overflow-x-auto hide-scrollbar h-auto p-1">
              <TabsTrigger value="all" className="rounded-xl px-4 py-2">{t("store.all")}</TabsTrigger>
              <TabsTrigger value="pending" className="rounded-xl px-4 py-2">{t("orders.pending")}</TabsTrigger>
              <TabsTrigger value="processing" className="rounded-xl px-4 py-2">{t("orders.processing")}</TabsTrigger>
              <TabsTrigger value="shipped" className="rounded-xl px-4 py-2">{t("orders.shipped")}</TabsTrigger>
              <TabsTrigger value="delivered" className="rounded-xl px-4 py-2">{t("orders.delivered")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {(() => {
            const filtered = orders.filter(o => {
              const matchesTab = orderTab === "all" ? true : o.status === orderTab;
              const searchLower = orderSearch.toLowerCase();
              const orderId = o._id || o.id;
              const matchesSearch = orderSearch === "" || 
                orderId?.toLowerCase().includes(searchLower) || 
                o.buyer_name?.toLowerCase().includes(searchLower) ||
                o.buyer_username?.toLowerCase().includes(searchLower);
              return matchesTab && matchesSearch;
            });

            if (filtered.length === 0) {
              return <div className="text-center py-16 text-slate-400 dark:text-slate-500">{t("store.noOrdersFound")}</div>;
            }

            return (
              <div className="space-y-3">
                {filtered.map((order, idx) => {
                  const orderId = order.id || order._id || `order-${idx}`;
                  const status = order.status || "pending";
                  
                  return (
                    <motion.div 
                      key={orderId} 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                            {t("store.orderRef", { id: orderId?.slice(-8) })}
                          </p>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-orange-600 transition-colors truncate">
                            {order.buyer_name || `@${order.buyer_username}`}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {new Date(order.created_at || order.created_date).toLocaleDateString()} · {t("store.itemsCount", { count: order.items?.length || 0 })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-center gap-1.5">
                            {order.delivery_method && (
                              <Badge className={`border-0 text-[9px] px-1.5 py-0.5 h-5 font-semibold flex items-center gap-1 ${
                                order.delivery_method === "pickup" ? "bg-amber-100 text-amber-700" :
                                order.delivery_method === "delivery" ? "bg-orange-100 text-orange-700" :
                                "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                              }`}>
                                {order.delivery_method === "pickup" ? <Package className="w-2.5 h-2.5" /> :
                                 order.delivery_method === "delivery" ? <Navigation className="w-2.5 h-2.5" /> :
                                 <Truck className="w-2.5 h-2.5" />}
                                {order.delivery_method === "pickup" ? t("store.pickup") :
                                 order.delivery_method === "delivery" ? t("store.delivery") : t("store.shippingLabel")}
                              </Badge>
                            )}
                            <Badge className={`${
                              status === 'delivered' ? 'bg-green-100 text-green-700' :
                              status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-orange-100 text-orange-700'
                            } border-0 text-[10px] px-2 py-0.5 h-6 font-semibold capitalize`}>
                              {t(`orders.${status}`)}
                            </Badge>
                          </div>
                          <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(order.total)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-700">
                        <div className="flex gap-1.5 overflow-hidden">
                          {order.items?.slice(0, 4).map((item, i) => (
                            <div key={i} className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 overflow-hidden shrink-0">
                              {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
                            </div>
                          ))}
                          {order.items?.length > 4 && (
                            <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-400 dark:text-slate-500">
                              +{order.items.length - 4}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 rounded-xl text-[10px] gap-1 text-slate-500 dark:text-slate-400"
                            onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                          >
                            <Info className="w-3 h-3" />
                            {t("store.details")}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 rounded-xl text-[10px] gap-1 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              navigate(createPageUrl("Chat") + `?to=${order.buyer_username}`);
                            }}
                          >
                            <MessageCircle className="w-3 h-3" />
                            {t("store.chat")}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            );
          })()}

          {selectedOrder && (
            <OrderDetailModal
              open={!!selectedOrder}
              onOpenChange={(open) => !open && setSelectedOrder(null)}
              order={selectedOrder}
              userRole="vendor"
              onUpdateStatus={(id, status) => {
                updateOrderStatusMutation.mutate({ id, status });
                setSelectedOrder(prev => prev ? { ...prev, status } : null);
              }}
              onContactBuyer={(username) => navigate(createPageUrl("Chat") + `?to=${username}`)}
            />
          )}
        </div>
      )}
    </div>
  );
}
