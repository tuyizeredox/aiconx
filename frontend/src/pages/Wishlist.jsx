import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import EmptyState from "@/components/shared/EmptyState";
import { wishlistAPI, cartAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "react-i18next";

export default function Wishlist() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: wishlistItems = [], isLoading } = useQuery({
    queryKey: ["wishlist", currentUser?.username],
    queryFn: async () => {
      const res = await wishlistAPI.list({ user_username: currentUser?.username, sort: "-created_date", limit: 100 });
      return res.data || [];
    },
    enabled: !!currentUser?.username,
  });

  const removeMutation = useMutation({
    mutationFn: (id) => wishlistAPI.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success(t("wishlist.removedFromWishlist"));
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: (item) => cartAPI.add({
      user_username: currentUser.username,
      product_id: item.product_id,
      product_title: item.product_title,
      product_image: item.product_image,
      product_price: item.product_price,
      store_id: item.store_id,
      store_name: item.store_name,
      quantity: 1,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success(t("wishlist.addedToCart"));
    },
  });

  const moveAllToCart = async () => {
    for (const item of wishlistItems) {
      await cartAPI.add({
        user_username: currentUser.username,
        product_id: item.product_id,
        product_title: item.product_title,
        product_image: item.product_image,
        product_price: item.product_price,
        store_id: item.store_id,
        store_name: item.store_name,
        quantity: 1,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["cart"] });
    toast.success(t("wishlist.allAddedToCart", { count: wishlistItems.length }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Heart className="w-6 h-6 fill-red-500 text-red-500" />
            {t("common.wishlist")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{t("wishlist.savedItems_other", { count: wishlistItems.length })}</p>
        </div>
        {wishlistItems.length > 0 && (
          <Button
            onClick={moveAllToCart}
            className="bg-orange-600 hover:bg-orange-700 rounded-xl gap-1.5"
          >
            <ShoppingCart className="w-4 h-4" /> {t("wishlist.addAllToCart")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-200 dark:bg-slate-700" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : wishlistItems.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("wishlist.empty")}
          description={t("wishlist.emptyDesc")}
          action={
            <Link to={createPageUrl("Marketplace")}>
              <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl">{t("wishlist.browseProducts")}</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AnimatePresence>
            {wishlistItems.map(item => {
              const discount = item.compare_at_price > 0
                ? Math.round((1 - item.product_price / item.compare_at_price) * 100) : 0;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden group hover:shadow-lg hover:shadow-slate-100 dark:hover:shadow-slate-900 transition-all"
                >
                  <Link to={createPageUrl("ProductDetail") + `?id=${item.product_id}`}>
                    <div className="relative aspect-square overflow-hidden">
                      <img
                        src={item.product_image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"}
                        alt={item.product_title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {discount > 0 && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-md">
                          -{discount}%
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-3">
                    <p className="text-[10px] text-slate-400 font-medium mb-0.5">{item.store_name}</p>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 leading-tight mb-2">{item.product_title}</p>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(item.product_price)}</span>
                      {item.compare_at_price > 0 && (
                        <span className="text-xs text-slate-400 line-through">{formatCurrency(item.compare_at_price)}</span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => addToCartMutation.mutate(item)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl transition-colors"
                      >
                        <ShoppingCart className="w-3 h-3" /> {t("wishlist.addToCart")}
                      </button>
                      <button
                        onClick={() => removeMutation.mutate(item.product_id)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
