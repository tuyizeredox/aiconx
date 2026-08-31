import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl, formatCurrency, storeUrl, haversineKm } from "@/lib/utils";
import ShopHeaderBar from "@/components/shop/ShopHeaderBar";
import ReviewGallery from "@/components/reviews/ReviewGallery";
import ReviewForm from "@/components/reviews/ReviewForm";
import SimilarProducts from "@/components/product/SimilarProducts";
import RelatedPosts from "@/components/product/RelatedPosts";
import SentimentSummary from "@/components/product/SentimentSummary";
import ImageZoomGallery from "@/components/product/ImageZoomGallery";
import ColorSelector from "@/components/product/ColorSelector";
import SizeSelector from "@/components/product/SizeSelector";
import OptionSelector from "@/components/product/OptionSelector";
import ProductPurchaseSidebar from "@/components/product/ProductPurchaseSidebar";
import ProductQuestions from "@/components/product/ProductQuestions";
import BoughtTogether from "@/components/product/BoughtTogether";
import ProductTrustFooter from "@/components/product/ProductTrustFooter";
import ShareModal from "@/components/shared/ShareModal";
import ReportModal from "@/components/shared/ReportModal";
import { useBackLink } from "@/hooks/useBackLink";
import { useNativeShare } from "@/hooks/useNativeShare";
import useGeolocation from "@/hooks/useGeolocation";
import { recordSignal } from "@/lib/personalization";
import { useAffiliateLink } from "@/hooks/useAffiliateLink";
import { productsAPI, reviewsAPI, cartAPI, wishlistAPI, storesAPI, productQuestionsAPI, productBookingsAPI } from "@/api/apiClient";
import { addToGuestCart, getGuestCart } from "@/lib/guestCart";
import { useAuth } from "@/lib/AuthContext";
import useAuthGate from "@/hooks/useAuthGate";
import Seo from "@/components/shared/Seo";
import { describeProduct, productPath } from "@/lib/previewMeta";
import { useTranslation } from "react-i18next";
import {
  Star, Heart, ShoppingCart, Share2, Minus, Plus, Check, PenLine, Images, Zap,
  Loader2, Flag, BadgeCheck, ChevronLeft, ChevronRight, Truck, PackageCheck, Store as StoreIcon, MapPin, Coins,
  BellRing, BellOff, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";

const BEST_SELLER_THRESHOLD = 20;
const NEW_ARRIVAL_DAYS = 14;
const LOW_STOCK_THRESHOLD = 10;

function StarRow({ rating, className = "w-4 h-4" }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${className} ${s <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-ink-600"}`} />
      ))}
    </div>
  );
}

// The page renders outside the app sidebar layout (see App.jsx) so it owns its
// own background + top chrome — including on the loading/error states, which
// otherwise leave a visitor with no way back.
function ProductPageShell({ backTo, backLabel, onBack, onShare, children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900 dark:text-ink-100">
      <ShopHeaderBar backTo={backTo} backLabel={backLabel} onBack={onBack} onShare={onShare} />
      {children}
    </div>
  );
}

function Panel({ children, className = "" }) {
  return (
    <div className={`bg-white dark:bg-ink-900 rounded-2xl border border-slate-100 dark:border-ink-800 ${className}`}>
      {children}
    </div>
  );
}

function SpecTable({ specifications }) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-ink-800 divide-y divide-slate-100 dark:divide-ink-800 overflow-hidden">
      {specifications.map((spec, i) => (
        <div key={`${spec.name}-${i}`} className="flex items-start gap-3 px-3.5 py-2.5 odd:bg-slate-50/60 dark:odd:bg-ink-800/30">
          <span className="text-xs font-medium text-slate-500 dark:text-ink-400 w-2/5 shrink-0">{spec.name}</span>
          <span className="text-sm text-slate-800 dark:text-ink-100 break-words min-w-0">{spec.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ProductDetail() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { requireAuth } = useAuthGate();

  const { data: productResponse, isLoading, error: productError } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const res = await productsAPI.get(productId);
      return res;
    },
    enabled: !!productId,
    retry: false,
  });

  const product = productResponse?.data || productResponse;

  // Resolved here rather than inside the share button so a tap can hand
  // navigator.share a finished URL synchronously (see useNativeShare).
  const affiliate = useAffiliateLink(product, currentUser, { authoritative: true });
  const canEarn = !!currentUser && affiliate.eligible && affiliate.amount > 0;
  const nativeShare = useNativeShare({
    product,
    // Pressing share mints the link if it doesn't exist yet, so even the very
    // first share of a product goes out attributed.
    resolveUrl: affiliate.ensureLink,
    onFallback: () => setIsShareModalOpen(true),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["productReviews", productId],
    queryFn: async () => {
      const res = await reviewsAPI.list({ product_id: productId, sort: "-created_at", limit: 50 });
      return res.data || [];
    },
    enabled: !!productId,
    retry: false,
  });

  // The seller card and the delivery rail both read from the store record, and
  // the question counter is needed in the header even when the Questions tab
  // has never been opened — so both are fetched here rather than inside the
  // components that display them.
  const { data: store } = useQuery({
    queryKey: ["store", product?.store_id],
    queryFn: () => storesAPI.get(product.store_id),
    enabled: !!product?.store_id,
    staleTime: 5 * 60_000,
  });

  // Feeds the taste profile the home feed reads back. Fired once the product
  // resolves rather than on mount, so a mistyped id never teaches the feed
  // anything.
  useEffect(() => {
    if (!product) return;
    recordSignal("view", {
      id: productId,
      category: product.category,
      price: product.price,
      store_id: product.store_id,
    });
  }, [product?.id, product?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // How far the shop actually is — shown only when the shopper has already
  // shared their location elsewhere in the app. Opening a product page never
  // triggers a permission prompt of its own.
  const { coords, requestIfGranted } = useGeolocation();
  useEffect(() => { requestIfGranted(); }, [requestIfGranted]);
  const storeDistanceKm = coords && store?.location ? haversineKm(coords, store.location) : null;

  const { data: questionData } = useQuery({
    queryKey: ["productQuestions", productId],
    queryFn: () => productQuestionsAPI.listForProduct(productId, { limit: 50 }),
    enabled: !!productId,
  });
  const questionCount = questionData?.total || 0;
  const answeredCount = questionData?.answered || 0;

  const requiresColor = product?.colors?.length > 0;
  const requiresSize = product?.sizes?.length > 0;
  const customOptions = product?.custom_options || [];

  const missingSelection = () => {
    if (requiresColor && !selectedColor) return t("product.selectColorPrompt");
    if (requiresSize && !selectedSize) return t("product.selectSizePrompt");
    const missingOption = customOptions.find(opt => !selectedOptions[opt.name]);
    if (missingOption) return t("product.selectOptionPrompt", { option: missingOption.name });
    return null;
  };

  const buildCartItem = () => ({
    product_id: productId,
    product_title: product.title,
    product_image: selectedImage || product.images?.[0],
    product_price: product.price,
    store_id: product.store_id,
    store_name: product.store_name,
    quantity,
    selected_color: selectedColor || undefined,
    selected_size: selectedSize || undefined,
    selected_options: customOptions.length > 0
      ? Object.entries(selectedOptions).map(([name, value]) => ({ name, value }))
      : undefined,
    selected_image: selectedImage || undefined,
  });

  const goToCart = () => navigate(createPageUrl("Cart"));

  const { data: cartResponse } = useQuery({
    queryKey: ["cart", currentUser?.username],
    queryFn: () => cartAPI.get(),
    enabled: !!currentUser?.username,
  });

  const [guestCartItems, setGuestCartItems] = useState(() => getGuestCart());
  useEffect(() => {
    const sync = () => setGuestCartItems(getGuestCart());
    window.addEventListener("guestcart:updated", sync);
    return () => window.removeEventListener("guestcart:updated", sync);
  }, []);

  const normalizeOptions = (options) => [...(options || [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(o => `${o.name}:${o.value}`)
    .join("|");

  const currentSelectionOptions = customOptions.length > 0
    ? Object.entries(selectedOptions).map(([name, value]) => ({ name, value }))
    : [];

  const cartItems = currentUser ? (cartResponse?.items || []) : guestCartItems;
  const isInCart = cartItems.some(item =>
    item.product_id === productId &&
    (item.selected_color || "") === (selectedColor || "") &&
    (item.selected_size || "") === (selectedSize || "") &&
    (item.selected_image || "") === (selectedImage || "") &&
    normalizeOptions(item.selected_options) === normalizeOptions(currentSelectionOptions)
  );

  const showAddedToCartToast = (alreadyInCart) => {
    setAddedToCart(true);
    const toastFn = alreadyInCart ? toast.info : toast.success;
    toastFn(alreadyInCart ? t("product.alreadyInCart") : t("product.addedToCart"), {
      action: { label: t("product.viewCart"), onClick: goToCart },
    });
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const addToCartMutation = useMutation({
    mutationFn: async () => cartAPI.add(buildCartItem()),
    onSuccess: (result) => {
      showAddedToCartToast(result?.already_in_cart);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const handleAddToCart = () => {
    const missing = missingSelection();
    if (missing) {
      toast.error(missing);
      return;
    }
    recordSignal("cart", { id: productId, category: product.category, price: product.price, store_id: product.store_id });
    if (!currentUser) {
      const { alreadyInCart } = addToGuestCart(buildCartItem());
      showAddedToCartToast(alreadyInCart);
      return;
    }
    addToCartMutation.mutate();
  };

  const buyNowMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        addToGuestCart(buildCartItem());
      } else {
        await cartAPI.add(buildCartItem());
        queryClient.invalidateQueries({ queryKey: ["cart"] });
      }
    },
    onSuccess: () => {
      navigate(createPageUrl("Checkout"));
    },
  });

  const handleBuyNow = () => {
    const missing = missingSelection();
    if (missing) {
      toast.error(missing);
      return;
    }
    recordSignal("purchase", { id: productId, category: product.category, price: product.price, store_id: product.store_id });
    buyNowMutation.mutate();
  };

  // ---- Booking (waitlist) for out-of-stock products.
  const { data: waitingData } = useQuery({
    queryKey: ["productBookingCount", productId],
    queryFn: () => productBookingsAPI.waitingCount(productId),
    enabled: !!productId,
    staleTime: 60_000,
  });
  const waitingCount = waitingData?.waiting || 0;

  const { data: myBookingsData } = useQuery({
    queryKey: ["myBookings", currentUser?.username],
    queryFn: () => productBookingsAPI.listForMe({ limit: 100 }),
    enabled: !!currentUser?.username,
  });
  const myBooking = (myBookingsData?.data || []).find(
    b => b.product_id === productId && b.status !== "cancelled"
  );

  const invalidateBookings = () => {
    queryClient.invalidateQueries({ queryKey: ["myBookings"] });
    queryClient.invalidateQueries({ queryKey: ["productBookingCount", productId] });
  };

  const bookMutation = useMutation({
    mutationFn: () => productBookingsAPI.book({
      product_id: productId,
      quantity,
      selected_color: selectedColor || undefined,
      selected_size: selectedSize || undefined,
      selected_options: customOptions.length > 0
        ? Object.entries(selectedOptions).map(([name, value]) => ({ name, value }))
        : undefined,
      selected_image: selectedImage || undefined,
    }),
    onSuccess: () => {
      toast.success(t("product.bookedToast"));
      invalidateBookings();
    },
    onError: (error) => toast.error(error?.message || t("product.bookFailed")),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: () => productBookingsAPI.cancel(myBooking.id || myBooking._id),
    onSuccess: () => {
      toast.success(t("product.bookingCancelled"));
      invalidateBookings();
    },
    onError: (error) => toast.error(error?.message || t("product.bookingCancelFailed")),
  });

  const handleBook = () => {
    // A toast that says "sign in" but leaves the shopper on the page is a
    // dead end. Take them to the form instead, and bring them back.
    if (!requireAuth("book")) return;
    // Variants still have to be chosen: the booking records which one the
    // shopper wants so the vendor knows what to restock.
    const missing = missingSelection();
    if (missing) {
      toast.error(missing);
      return;
    }
    bookMutation.mutate();
  };

  const { data: wishlistItems = [] } = useQuery({
    queryKey: ["wishlist", currentUser?.username],
    queryFn: async () => {
      const res = await wishlistAPI.list({ user_username: currentUser?.username, sort: "-created_at", limit: 200 });
      return res.items || res.data || (Array.isArray(res) ? res : []);
    },
    enabled: !!currentUser?.username,
  });

  const isWishlisted = wishlistItems.some(w => (w.product_id === productId || w.product_id === product?.id || w.product_id === product?._id));

  // Mobile-only floating buy bar: without the app layout there's no bottom nav,
  // so once the inline action row scrolls out of view we surface the same
  // actions pinned to the bottom of the viewport.
  const actionsRef = useRef(null);
  const [showBuyBar, setShowBuyBar] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const reviewRailRef = useRef(null);

  useEffect(() => {
    const el = actionsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowBuyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [product]);

  const scrollReviews = useCallback((direction) => {
    const rail = reviewRailRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * (rail.clientWidth * 0.8), behavior: "smooth" });
  }, []);

  const wishlistMutation = useMutation({
    mutationFn: async () => {
      if (!requireAuth("wishlist")) return;

      // Double check state to avoid race conditions
      if (isWishlisted) {
        await wishlistAPI.remove(productId);
      } else {
        recordSignal("save", { id: productId, category: product.category, price: product.price, store_id: product.store_id });
        const vendorUsername = product.vendor_username || product.store_username || productResponse?.vendor_username || "";

        await wishlistAPI.add({
          user_username: currentUser.username,
          product_id: productId,
          product_title: product.title,
          product_image: product.images?.[0],
          product_price: product.price,
          compare_at_price: product.compare_at_price,
          store_id: product.store_id,
          store_name: product.store_name,
          vendor_username: vendorUsername,
        });
        toast.success(t("product.savedToWishlist"));
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  // Back returns to wherever the visitor came from — a store page, the feed,
  // search results — and only falls back to the marketplace when this page was
  // opened cold (a shared or affiliate link, a new tab).
  const { to: backTo, label: backLabel, onClick: onBack } = useBackLink(
    createPageUrl("Marketplace"),
    t("product.backToMarketplace")
  );

  const emptyState = (message) => (
    <ProductPageShell backTo={backTo} backLabel={backLabel} onBack={onBack}>
      <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center text-center">
        <p className="text-base font-medium text-slate-500 dark:text-ink-400 mb-6">{message}</p>
        {/* The dead-end states keep the marketplace as their explicit way out —
            "back" from a product that doesn't exist would just bounce them. */}
        <Link to={createPageUrl("Marketplace")}>
          <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl font-bold">{t("product.backToMarketplace")}</Button>
        </Link>
      </div>
    </ProductPageShell>
  );

  // Early return if no productId (moved after all hooks)
  if (!productId) return emptyState(t("product.noProductId"));

  // Handle 404 or other errors
  if (productError) {
    return emptyState(productError.status === 404 ? t("product.productNotFound") : t("product.errorLoadingProduct"));
  }

  if (isLoading) {
    return (
      <ProductPageShell backTo={backTo} backLabel={backLabel}>
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6 animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 aspect-square bg-slate-200 dark:bg-ink-800 rounded-2xl" />
            <div className="lg:col-span-4 space-y-4">
              <div className="h-4 w-24 bg-slate-100 dark:bg-ink-800 rounded" />
              <div className="h-7 w-3/4 bg-slate-200 dark:bg-ink-800 rounded" />
              <div className="h-4 w-1/2 bg-slate-100 dark:bg-ink-800 rounded" />
              <div className="h-10 w-40 bg-slate-200 dark:bg-ink-800 rounded" />
              <div className="h-12 w-full bg-slate-200 dark:bg-ink-800 rounded-xl" />
            </div>
            <div className="lg:col-span-3 space-y-3">
              <div className="h-32 w-full bg-slate-100 dark:bg-ink-800 rounded-2xl" />
              <div className="h-28 w-full bg-slate-100 dark:bg-ink-800 rounded-2xl" />
            </div>
          </div>
        </div>
      </ProductPageShell>
    );
  }

  if (!product) return emptyState(t("product.productNotFound"));

  const images = product.images?.length > 0 ? product.images : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"];
  const discount = product.compare_at_price ? Math.round((1 - product.price / product.compare_at_price) * 100) : 0;
  const savings = product.compare_at_price > product.price ? product.compare_at_price - product.price : 0;

  // Rating breakdown
  const ratingCounts = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length,
    pct: reviews.length > 0 ? Math.round((reviews.filter(r => r.rating === s).length / reviews.length) * 100) : 0,
  }));
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const isSoldOut = product.status === "sold_out" || product.inventory_count === 0;
  const isLongDescription = (product.description || "").length > 260;
  const highlights = product.highlights || [];
  const specifications = product.specifications || [];
  const subtitle = (product.tags || []).slice(0, 3).join(" · ");
  const isBestSeller = (product.sales_count || 0) >= BEST_SELLER_THRESHOLD;
  const isNewArrival = !isBestSeller && product.created_at
    && (Date.now() - new Date(product.created_at).getTime()) < NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000;
  const storeSince = store?.created_at ? new Date(store.created_at).getFullYear() : null;
  const delivery = store?.delivery_settings;

  const tabs = [
    { id: "overview", label: t("product.tabOverview") },
    ...(specifications.length > 0 ? [{ id: "specs", label: t("product.tabSpecifications") }] : []),
    { id: "reviews", label: `${t("product.tabReviews")} (${reviews.length})` },
    { id: "questions", label: `${t("product.tabQuestions")} (${questionCount})` },
    { id: "shipping", label: t("product.tabShipping") },
  ];

  return (
    <ProductPageShell backTo={backTo} backLabel={backLabel} onShare={() => nativeShare()}>
      {/* Product/Offer structured data — the price, currency and stock state a
          search engine needs to render the result as a shopping card rather
          than a plain blue link. `store` supplies the seller/brand name. */}
      <Seo
        meta={describeProduct(product, { url: productPath(productId), store })}
        path={productPath(productId)}
      />
      <ShareModal
        isOpen={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        product={product}
        currentUser={currentUser}
      />
      <ReportModal
        isOpen={isReportModalOpen}
        onOpenChange={setIsReportModalOpen}
        targetId={productId}
        targetType="product"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-10 space-y-4">
        {/* ===== TOP: gallery | buy box | delivery rail ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Gallery */}
          <div className="lg:col-span-5">
            <Panel className="p-3 sm:p-4 lg:sticky lg:top-[4.5rem]">
              <ImageZoomGallery
                images={images}
                videos={product.videos}
                title={product.title}
                expandLabel={t("product.expand")}
                onSelectedImageChange={(url) => setSelectedImage(url)}
                badge={discount > 0 ? (
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-lg shadow-sm">
                    -{discount}%
                  </div>
                ) : null}
              />
            </Panel>
          </div>

          {/* Buy box */}
          <div className="lg:col-span-4 min-w-0">
            <Panel className="p-4 sm:p-5">
              <div className="flex items-center gap-2 flex-wrap mb-2.5">
                {isBestSeller && (
                  <Badge className="bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 border-0 text-[10px] font-bold rounded-full px-2.5">
                    {t("product.bestSeller")}
                  </Badge>
                )}
                {isNewArrival && (
                  <Badge className="bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-0 text-[10px] font-bold rounded-full px-2.5">
                    {t("product.newArrival")}
                  </Badge>
                )}
                {isSoldOut && (
                  <Badge variant="secondary" className="bg-slate-200 dark:bg-ink-700 text-slate-600 dark:text-ink-300 text-[10px] rounded-full px-2.5">
                    {t("product.outOfStock")}
                  </Badge>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-snug break-words">
                {product.title}
              </h1>
              {subtitle && (
                <p className="text-sm text-slate-500 dark:text-ink-400 mt-1 capitalize">{subtitle}</p>
              )}

              {/* Rating + questions */}
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-3">
                {avgRating > 0 ? (
                  <>
                    <StarRow rating={Math.round(avgRating)} className="w-3.5 h-3.5" />
                    <span className="text-sm font-bold text-slate-800 dark:text-ink-200">{avgRating.toFixed(1)}</span>
                    <button
                      onClick={() => setActiveTab("reviews")}
                      className="text-sm text-slate-400 dark:text-ink-500 hover:text-orange-600 transition-colors"
                    >
                      ({t("product.reviewsCount", { count: reviews.length })})
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-slate-400 dark:text-ink-500">{t("product.noReviewsYet")}</span>
                )}
                {questionCount > 0 && (
                  <>
                    <span className="text-slate-200 dark:text-ink-700">·</span>
                    <button
                      onClick={() => setActiveTab("questions")}
                      className="text-sm text-slate-400 dark:text-ink-500 hover:text-orange-600 transition-colors"
                    >
                      {t("product.answeredQuestions", { count: answeredCount })}
                    </button>
                  </>
                )}
              </div>

              {/* Price */}
              <div className="mt-4">
                <p className="text-2xl sm:text-3xl font-black text-orange-600">{formatCurrency(product.price)}</p>
                {savings > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-sm text-slate-400 line-through">{formatCurrency(product.compare_at_price)}</span>
                    <span className="text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950 rounded-full px-2 py-0.5">
                      {t("product.saveAmount", { amount: formatCurrency(savings) })}
                    </span>
                  </div>
                )}
              </div>

              {/* What this product pays anyone who shares it. Placed under the
                  price because that is the number it is derived from, and
                  phrased as a result ("share and earn X") rather than as a
                  programme to enrol in. */}
              {canEarn && (
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="w-full flex items-center gap-2.5 mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-left hover:bg-emerald-100/70 dark:hover:bg-emerald-500/15 transition-colors"
                >
                  <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="flex-1 min-w-0 text-[13px] font-bold text-emerald-800 dark:text-emerald-300">
                    {t("affiliate.shareAndEarn", { amount: formatCurrency(affiliate.amount) })}
                  </span>
                  <Share2 className="w-4 h-4 text-emerald-600/70 dark:text-emerald-400/70 shrink-0" />
                </button>
              )}

              {/* Stock */}
              <div className="flex items-center gap-2 flex-wrap mt-3 text-sm">
                {isSoldOut ? (
                  <>
                    <span className="text-red-500 font-medium">{t("product.outOfStock")}</span>
                    {waitingCount > 0 && (
                      <span className="text-slate-400 dark:text-ink-500 flex items-center gap-1">
                        · <Users className="w-3.5 h-3.5" /> {t("product.peopleWaiting", { count: waitingCount })}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <Check className="w-4 h-4" /> {t("product.inStock")}
                    </span>
                    {product.inventory_count > 0 && product.inventory_count <= LOW_STOCK_THRESHOLD && (
                      <span className="text-slate-400 dark:text-ink-500">
                        · {t("product.itemsLeft", { count: product.inventory_count })}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Seller */}
              {product.store_name && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ink-800">
                  <p className="text-[11px] text-slate-400 dark:text-ink-500 mb-1.5">{t("product.soldBy")}</p>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="truncate">{product.store_name}</span>
                        {store?.is_verified && <BadgeCheck className="w-4 h-4 text-orange-500 shrink-0" />}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs text-slate-400 dark:text-ink-500">
                        {store?.rating_avg > 0 && (
                          <>
                            <StarRow rating={Math.round(store.rating_avg)} className="w-3 h-3" />
                            <span className="font-semibold text-slate-600 dark:text-ink-300">{store.rating_avg.toFixed(1)}</span>
                          </>
                        )}
                        {store?.product_count > 0 && <span>· {t("shop.storeItems", { count: store.product_count })}</span>}
                        {storeSince && <span>· {t("product.since", { year: storeSince })}</span>}
                      </div>
                      {(storeDistanceKm != null || store?.location?.city) && (
                        <p className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-slate-600 dark:text-ink-300">
                          <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          {storeDistanceKm != null
                            ? t("home.kmAway", { km: storeDistanceKm })
                            : store.location.city}
                        </p>
                      )}
                    </div>
                    <Link to={storeUrl(store || product.store_id)} className="shrink-0">
                      <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs gap-1.5">
                        <StoreIcon className="w-3.5 h-3.5" /> {t("product.visitStore")}
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Variants */}
              <div className="mt-4">
                <SizeSelector sizes={product.sizes} value={selectedSize} onChange={setSelectedSize} />
                <ColorSelector colors={product.colors} value={selectedColor} onChange={setSelectedColor} />
                <OptionSelector
                  options={customOptions}
                  values={selectedOptions}
                  onChange={(name, value) => setSelectedOptions(prev => ({ ...prev, [name]: value }))}
                />
              </div>

              {/* Quantity */}
              <div className="flex items-center flex-wrap gap-3 mt-4">
                <span className="text-sm font-medium text-slate-700 dark:text-ink-300">{t("product.quantity")}</span>
                <div className="flex items-center border border-slate-200 dark:border-ink-700 rounded-xl overflow-hidden bg-white dark:bg-ink-900">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    aria-label="-"
                    className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-ink-800 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center font-semibold text-sm">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    aria-label="+"
                    className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-ink-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Actions — buying is replaced by booking while stock is out,
                  since there's nothing to sell until the vendor restocks. */}
              <div ref={actionsRef} className="mt-4 space-y-2.5">
                {isSoldOut ? (
                  myBooking ? (
                    <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/50 p-3.5">
                      <p className="text-sm font-bold text-green-800 dark:text-green-400 flex items-center gap-1.5">
                        <BellRing className="w-4 h-4 shrink-0" /> {t("product.bookedTitle")}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-500 mt-1 leading-relaxed">
                        {t("product.bookedBody")}
                      </p>
                      <button
                        onClick={() => cancelBookingMutation.mutate()}
                        disabled={cancelBookingMutation.isPending}
                        className="mt-2.5 text-xs font-semibold text-slate-500 dark:text-ink-400 hover:text-red-600 transition-colors inline-flex items-center gap-1.5"
                      >
                        {cancelBookingMutation.isPending
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <BellOff className="w-3.5 h-3.5" />}
                        {t("product.cancelBooking")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={handleBook}
                        disabled={bookMutation.isPending}
                        className="w-full h-12 rounded-xl text-sm font-bold bg-orange-600 hover:bg-orange-700"
                      >
                        {bookMutation.isPending
                          ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          : <BellRing className="w-4 h-4 mr-2" />}
                        {t("product.bookThisItem")}
                      </Button>
                      <p className="text-xs text-slate-500 dark:text-ink-400 text-center leading-relaxed">
                        {t("product.bookExplainer")}
                      </p>
                    </>
                  )
                ) : (
                  <>
                    <Button
                      onClick={handleBuyNow}
                      disabled={buyNowMutation.isPending}
                      className="w-full h-12 rounded-xl text-sm font-bold bg-orange-600 hover:bg-orange-700"
                    >
                      {buyNowMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                      {t("product.buyNow")}
                    </Button>
                    <Button
                      onClick={isInCart && !addedToCart ? goToCart : handleAddToCart}
                      disabled={addToCartMutation.isPending}
                      variant="outline"
                      className={`w-full h-12 rounded-xl text-sm font-bold ${addedToCart || isInCart ? "border-green-600 text-green-600" : ""}`}
                    >
                      {addedToCart ? (
                        <><Check className="w-4 h-4 mr-2" /> {t("product.added")}</>
                      ) : isInCart ? (
                        <><ShoppingCart className="w-4 h-4 mr-2" /> {t("product.viewInCart")}</>
                      ) : (
                        <><ShoppingCart className="w-4 h-4 mr-2" /> {t("product.addToCart")}</>
                      )}
                    </Button>
                  </>
                )}

                <div className="flex items-center justify-around pt-1 border-t border-slate-100 dark:border-ink-800">
                  <button
                    onClick={() => wishlistMutation.mutate()}
                    className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-medium transition-colors ${
                      isWishlisted ? "text-red-500" : "text-slate-500 dark:text-ink-400 hover:text-slate-800 dark:hover:text-ink-200"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
                    {t("product.addToWishlist")}
                  </button>
                  <span className="w-px h-5 bg-slate-100 dark:bg-ink-800" />
                  <button
                    onClick={() => nativeShare()}
                    className="flex items-center gap-1.5 py-2.5 px-3 text-xs font-medium text-slate-500 dark:text-ink-400 hover:text-slate-800 dark:hover:text-ink-200 transition-colors"
                  >
                    <Share2 className="w-4 h-4" /> {t("common.share")}
                  </button>
                  {currentUser && currentUser.username !== product.vendor_username && (
                    <>
                      <span className="w-px h-5 bg-slate-100 dark:bg-ink-800" />
                      <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-1.5 py-2.5 px-3 text-xs font-medium text-slate-500 dark:text-ink-400 hover:text-slate-800 dark:hover:text-ink-200 transition-colors"
                      >
                        <Flag className="w-4 h-4" /> {t("common.report")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Panel>
          </div>

          {/* Delivery / checkout / guarantees */}
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-[4.5rem]">
              <ProductPurchaseSidebar store={store} />
            </div>
          </div>
        </div>

        {/* ===== TABS ===== */}
        <Panel>
          <div className="flex gap-1 overflow-x-auto hide-scrollbar border-b border-slate-100 dark:border-ink-800 px-2 sm:px-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 px-3 sm:px-4 py-3.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-orange-600 text-orange-600"
                    : "border-transparent text-slate-500 dark:text-ink-400 hover:text-slate-800 dark:hover:text-ink-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {highlights.length > 0 && (
                  <div className="lg:border-r lg:border-slate-100 lg:dark:border-ink-800 lg:pr-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t("product.highlights")}</h3>
                    <ul className="space-y-2">
                      {highlights.map((highlight, i) => (
                        <li key={`${highlight}-${i}`} className="flex items-start gap-2 text-sm text-slate-600 dark:text-ink-300">
                          <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-1" />
                          <span className="break-words">{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className={highlights.length > 0 ? "" : "lg:col-span-2"}>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t("product.description")}</h3>
                  {product.description ? (
                    <>
                      <p className={`text-sm text-slate-600 dark:text-ink-300 leading-relaxed whitespace-pre-line break-words ${
                        isLongDescription && !descExpanded ? "line-clamp-6" : ""
                      }`}>
                        {product.description}
                      </p>
                      {isLongDescription && (
                        <button
                          onClick={() => setDescExpanded(v => !v)}
                          className="mt-2 text-sm font-semibold text-orange-600 hover:underline"
                        >
                          {descExpanded ? t("common.seeLess") : t("product.showMore")}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-ink-500">{t("product.noDescription")}</p>
                  )}
                </div>

                {specifications.length > 0 && (
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 lg:sr-only">
                      {t("product.tabSpecifications")}
                    </h3>
                    <SpecTable specifications={specifications.slice(0, 6)} />
                    {specifications.length > 6 && (
                      <button
                        onClick={() => setActiveTab("specs")}
                        className="mt-2 text-sm font-semibold text-orange-600 hover:underline"
                      >
                        {t("product.allSpecifications")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "specs" && <SpecTable specifications={specifications} />}

            {activeTab === "reviews" && (
              <div>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t("product.customerReviews")}</h3>
                  {currentUser && !showReviewForm && (
                    <Button onClick={() => setShowReviewForm(true)} variant="outline" size="sm" className="rounded-xl gap-1.5">
                      <PenLine className="w-3.5 h-3.5" /> {t("product.writeReview")}
                    </Button>
                  )}
                </div>

                <SentimentSummary productId={productId} reviews={reviews} />

                {showReviewForm && currentUser && (
                  <div className="mb-5">
                    <ReviewForm
                      productId={productId}
                      storeId={product?.store_id}
                      currentUser={currentUser}
                      onClose={() => setShowReviewForm(false)}
                    />
                  </div>
                )}

                {reviews.length > 0 ? (
                  <>
                    <ReviewGallery reviews={reviews} />
                    <div className="mt-5 space-y-3">
                      {reviews.map((review, i) => {
                        const reviewId = review.id || review._id || `review-${i}-${review.reviewer_name || "anon"}`;
                        return (
                          <motion.div
                            key={reviewId}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border border-slate-100 dark:border-ink-800 rounded-2xl p-4"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                                  {review.reviewer_name?.[0]?.toUpperCase() || "U"}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{review.reviewer_name}</span>
                                    {review.is_verified_purchase && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{t("product.verified")}</Badge>
                                    )}
                                  </div>
                                  <StarRow rating={review.rating} className="w-3.5 h-3.5" />
                                </div>
                              </div>
                              <span className="text-xs text-slate-400 dark:text-ink-500 shrink-0 whitespace-nowrap">
                                {new Date(review.created_at || review.created_date).toLocaleDateString()}
                              </span>
                            </div>
                            {review.title && (
                              <p className="text-sm font-semibold text-slate-800 dark:text-ink-200 mb-1">{review.title}</p>
                            )}
                            <p className="text-sm text-slate-600 dark:text-ink-300 leading-relaxed break-words">{review.content}</p>
                            {review.media_urls?.length > 0 && (
                              <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar">
                                {review.media_urls.map((url, j) => (
                                  <div key={`review-media-${reviewId}-${j}`} className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-100 dark:border-ink-700">
                                    <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </>
                ) : !showReviewForm && (
                  <div className="text-center py-12 border border-dashed border-slate-200 dark:border-ink-700 rounded-2xl">
                    <Images className="w-9 h-9 text-slate-200 dark:text-ink-700 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-600 dark:text-ink-300">{t("product.noReviewsYet")}</p>
                    <p className="text-xs text-slate-400 dark:text-ink-500 mt-1">{t("product.beFirstToReview")}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "questions" && (
              <ProductQuestions
                productId={productId}
                product={product}
                currentUser={currentUser}
              />
            )}

            {activeTab === "shipping" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-orange-500" /> {t("product.tabShipping")}
                  </h3>
                  <ul className="space-y-1.5 text-slate-600 dark:text-ink-300">
                    {delivery?.shipping_enabled && <li>· {t("product.methodShipping")}</li>}
                    {delivery?.delivery_enabled && (
                      <li>
                        · {t("product.methodDelivery")}
                        {delivery.delivery_radius_km ? ` (${t("product.withinRadius", { km: delivery.delivery_radius_km })})` : ""}
                      </li>
                    )}
                    {delivery?.pickup_enabled && <li>· {t("product.methodPickup")}</li>}
                    {delivery?.delivery_time_est && <li>· {t("product.estimatedTime", { time: delivery.delivery_time_est })}</li>}
                    {delivery?.delivery_fee > 0 && <li>· {t("product.deliveryFee", { amount: formatCurrency(delivery.delivery_fee) })}</li>}
                    {delivery?.free_delivery_above > 0 && (
                      <li>· {t("product.freeDeliveryAbove", { amount: formatCurrency(delivery.free_delivery_above) })}</li>
                    )}
                    {!delivery && <li className="text-slate-400">{t("product.deliveryNotSet")}</li>}
                  </ul>
                  {delivery?.pickup_enabled && delivery?.pickup_instructions && (
                    <p className="mt-2.5 text-xs text-slate-500 dark:text-ink-400 whitespace-pre-line">{delivery.pickup_instructions}</p>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-orange-500" /> {t("product.returnsTitle")}
                  </h3>
                  <p className="text-slate-600 dark:text-ink-300 leading-relaxed">{t("product.returnsBody")}</p>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* ===== CUSTOMER REVIEWS SUMMARY ===== */}
        {reviews.length > 0 && (
          <Panel className="p-4 sm:p-5">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 lg:gap-8">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">{t("product.customerReviews")}</h2>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-4xl font-black text-slate-900 dark:text-white">{avgRating.toFixed(1)}</p>
                  <div>
                    <StarRow rating={Math.round(avgRating)} />
                    <p className="text-xs text-slate-400 dark:text-ink-500 mt-0.5">
                      {t("product.basedOnReviews", { count: reviews.length })}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {ratingCounts.map(({ star, count, pct }) => (
                    <div key={`rating-stat-${star}`} className="flex items-center gap-2">
                      <span className="text-xs w-3 text-slate-500 dark:text-ink-400">{star}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-ink-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 dark:text-ink-500 w-7 text-right">{count}</span>
                    </div>
                  ))}
                </div>
                {currentUser && (
                  <Button
                    onClick={() => { setActiveTab("reviews"); setShowReviewForm(true); }}
                    variant="outline"
                    size="sm"
                    className="rounded-xl mt-4 gap-1.5"
                  >
                    <PenLine className="w-3.5 h-3.5" /> {t("product.writeReview")}
                  </Button>
                )}
              </div>

              {/* Review rail */}
              <div className="min-w-0 relative">
                <div ref={reviewRailRef} className="flex gap-3 overflow-x-auto hide-scrollbar snap-x">
                  {reviews.slice(0, 12).map((review, i) => (
                    <div
                      key={review.id || review._id || `rail-${i}`}
                      className="w-[85%] sm:w-[380px] shrink-0 snap-start bg-amber-50/60 dark:bg-ink-800/50 rounded-2xl p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                          {review.reviewer_name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{review.reviewer_name}</span>
                            {review.is_verified_purchase && (
                              <span className="text-[10px] font-bold text-green-600">{t("product.verifiedPurchase")}</span>
                            )}
                          </div>
                          <StarRow rating={review.rating} className="w-3 h-3" />
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-ink-500 shrink-0">
                          {new Date(review.created_at || review.created_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-ink-300 mt-2.5 line-clamp-3 break-words">{review.content}</p>
                      {review.media_urls?.[0] && (
                        <img
                          src={review.media_urls[0]}
                          alt=""
                          loading="lazy"
                          className="w-16 h-16 rounded-xl object-cover mt-2.5 border border-white dark:border-ink-700"
                        />
                      )}
                    </div>
                  ))}
                </div>
                {reviews.length > 1 && (
                  <div className="flex justify-end gap-1.5 mt-3">
                    <button
                      onClick={() => scrollReviews(-1)}
                      aria-label={t("common.previous")}
                      className="w-8 h-8 rounded-full border border-slate-200 dark:border-ink-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-ink-800 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => scrollReviews(1)}
                      aria-label={t("common.next")}
                      className="w-8 h-8 rounded-full border border-slate-200 dark:border-ink-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-ink-800 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        )}

        <BoughtTogether product={product} productId={productId} currentUser={currentUser} />

        <SimilarProducts product={product} />

        <RelatedPosts productId={productId} />

        <ProductTrustFooter />
      </div>

      {/* Floating buy bar — mobile only, once the inline actions scroll away */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] bg-white/95 dark:bg-ink-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-ink-800 transition-transform duration-300 ${
          showBuyBar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="min-w-0">
            <p className="text-base font-bold text-slate-900 dark:text-white leading-none whitespace-nowrap">{formatCurrency(product.price)}</p>
          </div>
          {isSoldOut ? (
            myBooking ? (
              <Button
                disabled
                variant="outline"
                className="flex-1 min-w-0 h-11 rounded-xl text-sm font-semibold border-green-600 text-green-600 disabled:opacity-100"
              >
                <BellRing className="w-4 h-4 mr-1.5 shrink-0" />
                <span className="truncate">{t("product.bookedTitle")}</span>
              </Button>
            ) : (
              <Button
                onClick={handleBook}
                disabled={bookMutation.isPending}
                className="flex-1 min-w-0 h-11 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-700"
              >
                {bookMutation.isPending
                  ? <Loader2 className="w-4 h-4 mr-1.5 shrink-0 animate-spin" />
                  : <BellRing className="w-4 h-4 mr-1.5 shrink-0" />}
                <span className="truncate">{t("product.bookThisItem")}</span>
              </Button>
            )
          ) : (
            <>
              {/* One prominent action. Adding to the cart is still one tap, but
                  it steps back to an icon so nothing competes with Buy Now —
                  the whole point of the page is that buying is the easy path. */}
              <Button
                onClick={isInCart && !addedToCart ? goToCart : handleAddToCart}
                disabled={addToCartMutation.isPending}
                variant="outline"
                aria-label={isInCart && !addedToCart ? t("product.viewInCart") : t("product.addToCart")}
                title={isInCart && !addedToCart ? t("product.viewInCart") : t("product.addToCart")}
                className={`shrink-0 w-12 h-12 p-0 rounded-xl ${addedToCart || isInCart ? "border-green-600 text-green-600" : ""}`}
              >
                {addedToCart ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
              </Button>
              <Button
                onClick={handleBuyNow}
                disabled={buyNowMutation.isPending}
                className="flex-1 min-w-0 h-12 rounded-xl text-[15px] font-bold bg-orange-600 hover:bg-orange-700"
              >
                {buyNowMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 shrink-0 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5 shrink-0" />}
                <span className="truncate">{t("product.buyNow")}</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </ProductPageShell>
  );
}
