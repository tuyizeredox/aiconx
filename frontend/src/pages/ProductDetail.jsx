import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import ReviewGallery from "@/components/reviews/ReviewGallery";
import ReviewForm from "@/components/reviews/ReviewForm";
import SimilarProducts from "@/components/product/SimilarProducts";
import SentimentSummary from "@/components/product/SentimentSummary";
import ShareModal from "@/components/shared/ShareModal";
import { useNativeShare } from "@/hooks/useNativeShare";
import { productsAPI, reviewsAPI, cartAPI, wishlistAPI } from "@/api/apiClient";
import { addToGuestCart } from "@/lib/guestCart";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "react-i18next";
import {
  Star, Heart, ShoppingCart, Share2, Truck, Shield, ArrowLeft,
  ChevronLeft, ChevronRight, Minus, Plus, Store, Check, PenLine, Images, Zap, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

function StarRow({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`w-4 h-4 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
      ))}
    </div>
  );
}

export default function ProductDetail() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

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
  const nativeShare = useNativeShare({ product, onFallback: () => setIsShareModalOpen(true) });

  const { data: reviews = [] } = useQuery({
    queryKey: ["productReviews", productId],
    queryFn: async () => {
      const res = await reviewsAPI.list({ product_id: productId, sort: "-created_date", limit: 50 });
      return res.data || [];
    },
    enabled: !!productId,
    retry: false,
  });

  const buildCartItem = () => ({
    product_id: productId,
    product_title: product.title,
    product_image: product.images?.[0],
    product_price: product.price,
    store_id: product.store_id,
    store_name: product.store_name,
    quantity,
  });

  const goToCart = () => navigate(createPageUrl("Cart"));

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      await cartAPI.add(buildCartItem());
    },
    onSuccess: () => {
      setAddedToCart(true);
      toast.success(t("product.addedToCart"), {
        action: { label: t("product.viewCart"), onClick: goToCart },
      });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setTimeout(() => setAddedToCart(false), 2000);
    },
  });

  const handleAddToCart = () => {
    if (!currentUser) {
      addToGuestCart(buildCartItem());
      setAddedToCart(true);
      toast.success(t("product.addedToCart"), {
        action: { label: t("product.viewCart"), onClick: goToCart },
      });
      setTimeout(() => setAddedToCart(false), 2000);
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

  const { data: wishlistItems = [] } = useQuery({
    queryKey: ["wishlist", currentUser?.username],
    queryFn: async () => {
      const res = await wishlistAPI.list({ user_username: currentUser?.username, sort: "-created_date", limit: 200 });
      return res.items || res.data || (Array.isArray(res) ? res : []);
    },
    enabled: !!currentUser?.username,
  });

  const isWishlisted = wishlistItems.some(w => (w.product_id === productId || w.product_id === product?.id || w.product_id === product?._id));

  const wishlistMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        toast.error(t("product.signInToSave"));
        return;
      }
      
      // Double check state to avoid race conditions
      if (isWishlisted) {
        await wishlistAPI.remove(productId);
      } else {
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

  // Early return if no productId (moved after all hooks)
  if (!productId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-500">
        {t("product.noProductId")}
      </div>
    );
  }

  // Handle 404 or other errors
  if (productError) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-500">
        {productError.status === 404 ? t("product.productNotFound") : t("product.errorLoadingProduct")}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 animate-pulse">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="aspect-square bg-slate-200 dark:bg-slate-700 rounded-3xl" />
          <div className="space-y-4">
            <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-1/2 bg-slate-100 dark:bg-slate-700 rounded" />
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return <div className="text-center py-20 text-slate-400 dark:text-slate-500">{t("product.productNotFound")}</div>;

  const images = product.images?.length > 0 ? product.images : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"];
  const discount = product.compare_at_price ? Math.round((1 - product.price / product.compare_at_price) * 100) : 0;

  // Rating breakdown
  const ratingCounts = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length,
    pct: reviews.length > 0 ? Math.round((reviews.filter(r => r.rating === s).length / reviews.length) * 100) : 0,
  }));
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
      <ShareModal 
        isOpen={isShareModalOpen} 
        onOpenChange={setIsShareModalOpen} 
        product={product} 
        currentUser={currentUser} 
      />
      <Link to={createPageUrl("Marketplace")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> {t("product.backToMarketplace")}
      </Link>

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
        {/* Image Gallery */}
        <div>
          <div className="relative aspect-square rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3">
            <AnimatePresence mode="wait">
              <motion.img
                key={selectedImage}
                src={images[selectedImage]}
                alt={product.title}
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </AnimatePresence>
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedImage(i => Math.max(0, i - 1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedImage(i => Math.min(images.length - 1, i + 1))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            {discount > 0 && (
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-xl">
                -{discount}%
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {images.map((img, i) => (
                <button
                  key={`thumb-${i}-${img}`}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                    selectedImage === i ? "border-orange-500 ring-2 ring-orange-100" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="lg:py-2">
          {product.store_name && (
            <Link
              to={createPageUrl("StoreDetail") + `?id=${product.store_id || product.store?._id}`}
              className="inline-flex items-center gap-1.5 text-sm text-orange-600 font-medium mb-2 hover:underline"
            >
              <Store className="w-4 h-4" />
              {product.store_name}
            </Link>
          )}

          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mb-3">{product.title}</h1>

          {avgRating > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <StarRow rating={Math.round(avgRating)} />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-slate-400 dark:text-slate-500">({t("product.reviewsCount", { count: reviews.length })})</span>
            </div>
          )}

          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(product.price)}</span>
            {product.compare_at_price > 0 && (
              <span className="text-lg text-slate-400 line-through">{formatCurrency(product.compare_at_price)}</span>
            )}
          </div>

          {product.description && (
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">{product.description}</p>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("product.quantity")}:</span>
            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-medium text-sm">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-3">
            <Button
              onClick={handleAddToCart}
              disabled={addToCartMutation.isPending || product.status === "sold_out"}
              variant="outline"
              className={`flex-1 h-12 rounded-xl text-base font-semibold transition-all ${
                addedToCart ? "border-green-600 text-green-600" : ""
              }`}
            >
              {addedToCart ? <><Check className="w-5 h-5 mr-2" /> {t("product.added")}</> : <><ShoppingCart className="w-5 h-5 mr-2" /> {t("product.addToCart")}</>}
            </Button>
            <Button
              onClick={() => buyNowMutation.mutate()}
              disabled={buyNowMutation.isPending || product.status === "sold_out"}
              className="flex-1 h-12 rounded-xl text-base font-semibold bg-orange-600 hover:bg-orange-700 transition-all"
            >
              {buyNowMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Zap className="w-5 h-5 mr-2" />} {t("product.buyNow")}
            </Button>
          </div>
          <div className="flex gap-3 mb-6">
            <Button
              onClick={() => wishlistMutation.mutate()}
              variant="outline"
              size="icon"
              className={`h-11 w-11 rounded-xl transition-colors ${isWishlisted ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900 text-red-500" : ""}`}
            >
              <Heart className={`w-5 h-5 ${isWishlisted ? "fill-current" : ""}`} />
            </Button>
            <Button
              onClick={() => nativeShare()}
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <Truck className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{t("product.fastShipping")}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{t("product.businessDays")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <Shield className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{t("product.buyerProtection")}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{t("product.moneyBackGuarantee")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== REVIEWS SECTION ===== */}
      <div className="mt-12 border-t border-slate-100 dark:border-slate-700 pt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("product.customerReviews")}</h2>
          {currentUser && !showReviewForm && (
            <Button
              onClick={() => setShowReviewForm(true)}
              variant="outline"
              className="rounded-xl gap-1.5"
            >
              <PenLine className="w-4 h-4" /> {t("product.writeReview")}
            </Button>
          )}
        </div>

        {/* AI Sentiment Summary */}
        <SentimentSummary productId={productId} reviews={reviews} />

        {/* Review Form */}
        {showReviewForm && currentUser && (
          <div className="mb-6">
            <ReviewForm
              productId={productId}
              storeId={product?.store_id}
              currentUser={currentUser}
              onClose={() => setShowReviewForm(false)}
            />
          </div>
        )}

        {reviews.length > 0 && (
          <>
            {/* Rating Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="text-center shrink-0">
                <p className="text-6xl font-bold text-slate-900 dark:text-white">{avgRating.toFixed(1)}</p>
                <StarRow rating={Math.round(avgRating)} />
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{t("product.reviewsCount", { count: reviews.length })}</p>
              </div>
              <div className="flex-1 w-full space-y-1.5">
                {ratingCounts.map(({ star, count, pct }) => (
                  <div key={`rating-stat-${star}`} className="flex items-center gap-2">
                    <span className="text-xs w-4 text-slate-500 dark:text-slate-400">{star}</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Review Gallery */}
            <ReviewGallery reviews={reviews} />

            {/* Review List */}
            <div className="mt-6 space-y-4">
              {reviews.map((review, i) => {
                const reviewId = review.id || review._id || `review-${i}-${review.reviewer_name || "anon"}`;
                return (
                  <motion.div
                    key={reviewId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5"
                  >
                  <div className="flex items-start justify-between gap-3 mb-3">
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
                        <StarRow rating={review.rating} />
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap">{new Date(review.created_at || review.created_date).toLocaleDateString()}</span>
                  </div>

                  {review.title && (
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{review.title}</p>
                  )}
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{review.content}</p>

                  {review.media_urls?.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar">
                      {review.media_urls.map((url, j) => (
                        <div key={`review-media-${review.id || review._id}-${j}`} className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-700">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
            </div>
          </>
        )}

        {/* Similar Products */}
        <SimilarProducts product={product} />

        {reviews.length === 0 && !showReviewForm && (
          <div className="text-center py-14 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <Images className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="font-medium text-slate-500 dark:text-slate-400">{t("product.noReviewsYet")}</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-4">{t("product.beFirstToReview")}</p>
            {currentUser && (
              <Button onClick={() => setShowReviewForm(true)} className="bg-orange-600 hover:bg-orange-700 rounded-xl">
                <PenLine className="w-4 h-4 mr-2" /> {t("product.writeReview")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
