import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import { Star, Heart, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { wishlistAPI } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ShareModal from "./ShareModal";

export default function ProductCard({ product, compact = false, currentUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const productId = product?.id || product?._id;

  // Only fetch wishlist for authenticated users with username
  const { data: wishlistItems = [] } = useQuery({
    queryKey: ["wishlist", currentUser?.username],
    queryFn: async () => {
      const res = await wishlistAPI.list({ sort: "-created_date", limit: 200 });
      return res.items || res.data || (Array.isArray(res) ? res : []);
    },
    staleTime: 60000,
    enabled: !!currentUser?.username, // Only run query when user is authenticated
  });

  const isWishlisted = wishlistItems.some(w => (w.product_id === productId || w.product_id === product?.id || w.product_id === product?._id));

  const wishlistMutation = useMutation({
    mutationFn: async () => {
      if (isWishlisted) {
        await wishlistAPI.remove(productId);
      } else {
        const vendorUsername = product.vendor_username || product.store_username || "";
        
        if (!vendorUsername) {
          console.error("Missing vendor username for product", product);
        }

        await wishlistAPI.add({
          product_id: productId,
          product_title: product.title,
          product_image: product.images?.[0],
          product_price: product.price,
          compare_at_price: product.compare_at_price,
          store_id: product.store_id,
          store_name: product.store_name,
          vendor_username: vendorUsername,
        });
        toast.success("Saved to wishlist!");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist", currentUser?.username] }),
  });

  const discount = product.compare_at_price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    wishlistMutation.mutate();
  };

  return (
    <>
      <Link to={createPageUrl("ProductDetail") + `?id=${productId}`}>
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-100 dark:hover:shadow-slate-950 transition-all duration-300 group"
        >
          <div className="relative aspect-square overflow-hidden">
            <img
              src={product.images?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"}
              alt={product.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {discount > 0 && (
              <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
                -{discount}%
              </div>
            )}
            {product.status === "sold_out" && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white font-bold text-sm uppercase tracking-wider">{t("product.outOfStock")}</span>
              </div>
            )}
            <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={handleWishlist}
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors ${
                  isWishlisted
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800"
                }`}
              >
                <Heart className={`w-4 h-4 transition-all ${
                  isWishlisted ? "fill-white text-white" : "text-slate-600 dark:text-slate-300"
                }`} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsShareModalOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors"
              >
                <Share2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </motion.button>
            </div>
          </div>
          <div className={compact ? "p-2" : "p-3"}>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1">{product.store_name || "Store"}</p>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">{product.title}</h3>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-base font-bold text-slate-900 dark:text-slate-100">{formatCurrency(product.price)}</span>
              {product.compare_at_price > 0 && (
                <span className="text-xs text-slate-400 dark:text-slate-500 line-through">{formatCurrency(product.compare_at_price)}</span>
              )}
            </div>
            {product.rating_avg > 0 && (
              <div className="flex items-center gap-1 mt-1.5">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{product.rating_avg?.toFixed(1)}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">({product.rating_count})</span>
              </div>
            )}
          </div>
        </motion.div>
      </Link>
      <ShareModal
        isOpen={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        product={product}
        currentUser={currentUser}
      />
    </>
  );
}
