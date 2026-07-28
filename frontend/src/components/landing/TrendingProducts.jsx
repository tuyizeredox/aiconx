import React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Heart, ShoppingCart, Star, Store } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { addToGuestCart } from "@/lib/guestCart";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import { authLink, productPath } from "./authLink";

function TrendingCard({ product, t, navigate }) {
  const productId = product?.id || product?._id;

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { alreadyInCart } = addToGuestCart({
      product_id: productId,
      product_title: product.title,
      product_image: product.images?.[0],
      product_price: product.price,
      store_id: product.store_id,
      store_name: product.store_name,
      quantity: 1,
    });
    const toastFn = alreadyInCart ? toast.info : toast.success;
    toastFn(alreadyInCart ? t("product.alreadyInCart") : t("product.addedToCart"), {
      action: { label: t("product.viewCart"), onClick: () => navigate("/cart") },
    });
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toast.error(t("product.signInToSave"), {
      action: {
        label: t("common.register"),
        onClick: () => navigate("/register", { state: { from: productPath(productId) } }),
      },
    });
  };

  return (
    <Link
      {...authLink(productPath(productId))}
      className="group block w-[44vw] sm:w-auto shrink-0 snap-start bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 active:scale-[0.98] sm:hover:shadow-xl sm:hover:shadow-slate-100 dark:sm:hover:shadow-black/30 transition-all duration-300"
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={product.images?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"}
          alt={product.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <button
          onClick={handleWishlist}
          aria-label="Save to wishlist"
          className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center shadow-md backdrop-blur-sm transition-colors active:scale-90"
        >
          <Heart className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </button>
      </div>
      <div className="p-3">
        <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium mb-1">
          <Store className="w-3 h-3 shrink-0" />
          <span className="truncate">{product.store_name || t("profile.store")}</span>
        </p>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight mb-1.5">{product.title}</h3>
        {product.rating_avg > 0 && (
          <div className="flex items-center gap-1 mb-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{product.rating_avg?.toFixed(1)}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">({product.rating_count})</span>
          </div>
        )}
        <p className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">{formatCurrency(product.price)}</p>
        <button
          onClick={handleAddToCart}
          className="w-full h-9 rounded-lg border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 text-xs font-bold hover:bg-orange-50 dark:hover:bg-orange-500/10 active:scale-[0.97] flex items-center justify-center gap-1.5 transition-all"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          {t("landing.trending.addToCart")}
        </button>
      </div>
    </Link>
  );
}

export default function TrendingProducts({ products, isLoading }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section id="trending" className="scroll-mt-20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-lg sm:text-xl font-black text-slate-900 dark:text-white">
          <span>🔥</span> {t("landing.trending.title")}
        </h2>
        <a href="#catalogue" className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-500">
          {t("landing.trending.viewAll")}
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
      <div className="flex sm:grid sm:grid-cols-4 gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none -mx-4 sm:mx-0 px-4 sm:px-0 pb-1 sm:pb-0 hide-scrollbar">
        {isLoading
          ? Array(4).fill(0).map((_, i) => (
              <div key={`trend-sk-${i}`} className="w-[44vw] sm:w-auto shrink-0">
                <ProductSkeleton />
              </div>
            ))
          : products.map((product) => (
              <TrendingCard key={product.id || product._id} product={product} t={t} navigate={navigate} />
            ))}
      </div>
    </section>
  );
}
