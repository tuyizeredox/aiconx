import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Share2, CheckCircle, ShoppingBag, Store as StoreIcon } from "lucide-react";
import { createPageUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { cartAPI } from "@/api/apiClient";
import { getGuestCartCount } from "@/lib/guestCart";
import { useAuth } from "@/lib/AuthContext";

// Minimal persistent header used on both the default and custom storefront
// templates — StoreDetail renders standalone (no app sidebar, see App.jsx),
// so this is the only way visitors can get to their cart or back out of a
// vendor's store while browsing it.
export default function StoreHeaderBar({ store, onShare, backTo, backLabel, shopLink }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [guestCartCount, setGuestCartCount] = React.useState(() => getGuestCartCount());

  React.useEffect(() => {
    if (currentUser) return;
    const refresh = () => setGuestCartCount(getGuestCartCount());
    refresh();
    window.addEventListener("guestcart:updated", refresh);
    return () => window.removeEventListener("guestcart:updated", refresh);
  }, [currentUser]);

  const { data: cartResponse = {} } = useQuery({
    queryKey: ["cart", currentUser?.username],
    queryFn: () => cartAPI.get(),
    enabled: !!currentUser?.username,
  });
  const cartItemCount = currentUser
    ? (Array.isArray(cartResponse?.items) ? cartResponse.items.length : 0)
    : guestCartCount;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between gap-3">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-ink-400 hover:text-slate-700 dark:hover:text-ink-200 transition-colors shrink-0 min-w-0"
      >
        <ArrowLeft className="w-4 h-4 shrink-0" /> <span className="truncate">{backLabel}</span>
      </Link>

      <div className="hidden sm:flex items-center gap-2 min-w-0">
        {store?.logo_url ? (
          <img src={store.logo_url} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
        ) : (
          <StoreIcon className="w-4 h-4 text-slate-300 dark:text-ink-600 shrink-0" />
        )}
        <span className="text-sm font-bold text-slate-700 dark:text-ink-200 truncate max-w-[10rem]">{store?.name}</span>
        {store?.is_verified && <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {shopLink && (
          <Link
            to={shopLink}
            className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 dark:text-ink-300 hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors"
          >
            {t("storeDetail.allProducts")}
          </Link>
        )}
        <Link
          to={createPageUrl("Cart")}
          aria-label={t("nav.cart")}
          className="relative w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-ink-200 hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors"
        >
          <ShoppingBag className="w-4 h-4" />
          {cartItemCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-600 text-white text-[9px] font-bold flex items-center justify-center">
              {cartItemCount > 9 ? "9+" : cartItemCount}
            </span>
          )}
        </Link>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            aria-label={t("storeDetail.shareStore")}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-ink-200 hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
