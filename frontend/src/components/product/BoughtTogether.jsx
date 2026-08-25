import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import { productsAPI, cartAPI } from "@/api/apiClient";
import { addToGuestCart } from "@/lib/guestCart";
import EarnBadge from "@/components/shared/EarnBadge";
import { estimateEarnings } from "@/lib/affiliate";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useAuth } from "@/lib/AuthContext";

function BundleItem({ product, isAnchor }) {
  const id = product.id || product._id;
  const { user: currentUser } = useAuth();
  const { isSubscriptionEnforced } = usePlatformSettings();
  const earnings = estimateEarnings(product, {
    subscriptionEnforced: isSubscriptionEnforced,
    viewerUsername: currentUser?.username,
  });
  const body = (
    <div className={`flex items-center gap-2.5 rounded-2xl border p-2.5 w-[240px] shrink-0 ${
      isAnchor
        ? "border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/30"
        : "border-slate-100 dark:border-ink-800 bg-white dark:bg-ink-900"
    }`}>
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-ink-800 overflow-hidden shrink-0">
        {product.images?.[0] && (
          <img src={product.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-800 dark:text-ink-100 line-clamp-2 leading-tight">{product.title}</p>
        <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{formatCurrency(product.price)}</p>
        <EarnBadge amount={earnings?.amount} className="mt-1" />
      </div>
    </div>
  );

  return isAnchor ? body : (
    <Link to={createPageUrl("ProductDetail") + `?id=${id}`} className="shrink-0 hover:opacity-90 transition-opacity">
      {body}
    </Link>
  );
}

/**
 * Bundle strip under the product.
 *
 * The heading follows the data: when the backend found genuine co-purchases in
 * paid orders it says so, and when it fell back to the store's other products
 * it says *that* instead — claiming a buying pattern nobody measured would be
 * a lie told to a shopper at the moment they're deciding.
 */
export default function BoughtTogether({ product, productId, currentUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["boughtTogether", productId],
    queryFn: () => productsAPI.getBoughtTogether(productId, 3),
    enabled: !!productId,
    staleTime: 5 * 60_000,
  });

  const extras = Array.isArray(data?.data) ? data.data : [];
  const source = data?.source;

  const addAllMutation = useMutation({
    mutationFn: async () => {
      const items = [product, ...extras].map(p => ({
        product_id: p.id || p._id,
        product_title: p.title,
        product_image: p.images?.[0],
        product_price: p.price,
        store_id: p.store_id,
        store_name: p.store_name,
        quantity: 1,
      }));

      // Variant-bearing products can't be added blind — the shopper has to pick
      // a colour/size first, so those are skipped and reported rather than
      // silently added with no selection.
      for (const item of items) {
        if (currentUser) {
          await cartAPI.add(item);
        } else {
          addToGuestCart(item);
        }
      }
      return items.length;
    },
    onSuccess: (count) => {
      toast.success(t("product.addedItemsToCart", { count }));
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (error) => toast.error(error?.message || t("product.addAllFailed")),
  });

  if (extras.length === 0) return null;

  const total = [product, ...extras].reduce((sum, p) => sum + (p.price || 0), 0);
  const heading = source === "store" ? t("product.completeYourSetup") : t("product.boughtTogether");
  const subheading = source === "store" ? t("product.moreFromStore") : t("product.boughtTogetherNote");

  return (
    <section className="bg-white dark:bg-ink-900 rounded-2xl border border-slate-100 dark:border-ink-800 p-4 sm:p-5">
      <h2 className="text-base font-bold text-slate-900 dark:text-white">{heading}</h2>
      <p className="text-xs text-slate-400 dark:text-ink-500 mb-4">{subheading}</p>

      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar flex-1 min-w-0 pb-1">
          <BundleItem product={product} isAnchor />
          {extras.map((extra, i) => (
            <React.Fragment key={extra.id || extra._id || `extra-${i}`}>
              <Plus className="w-4 h-4 text-slate-300 dark:text-ink-600 shrink-0" />
              <BundleItem product={extra} />
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center justify-between xl:justify-end gap-3 xl:gap-4 shrink-0 border-t xl:border-t-0 border-slate-100 dark:border-ink-800 pt-3 xl:pt-0">
          <div className="xl:text-right">
            <p className="text-[11px] text-slate-400 dark:text-ink-500">{t("product.totalPrice")}</p>
            <p className="text-lg font-black text-orange-600 whitespace-nowrap">{formatCurrency(total)}</p>
          </div>
          <Button
            onClick={() => addAllMutation.mutate()}
            disabled={addAllMutation.isPending}
            className="rounded-xl bg-orange-600 hover:bg-orange-700 h-10 gap-1.5 shrink-0"
          >
            {addAllMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ShoppingCart className="w-4 h-4" />}
            {t("product.addAllToCart")}
          </Button>
        </div>
      </div>
    </section>
  );
}
