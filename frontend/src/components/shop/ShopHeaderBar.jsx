import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingBag, Share2, Package } from "lucide-react";
import { createPageUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { cartAPI } from "@/api/apiClient";
import { getGuestCartCount } from "@/lib/guestCart";
import { useAuth } from "@/lib/AuthContext";
import Logo from "@/components/layout/Logo";
import LanguagePicker from "@/components/layout/LanguagePicker";

// Sticky chrome for the standalone shop flow (ProductDetail / Cart / Checkout).
// Those pages render outside the app's sidebar layout (see App.jsx) so the
// product/cart content gets the full viewport width — this bar is then the only
// way back into the app, and the only place a guest sees their cart count.
// `onBack` (from useBackLink) turns the arrow into a real history "back" while
// `backTo` stays the href — so a click returns the visitor to the page they came
// from, and middle-click / open-in-new-tab still resolve to a URL.
export default function ShopHeaderBar({ backTo, backLabel, onBack, onShare, showCart = true }) {
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

  const iconButton = "w-9 h-9 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors";

  return (
    <header className="sticky top-0 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70 pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center">
          <Link
            to={backTo}
            onClick={onBack}
            className="inline-flex items-center gap-1.5 min-w-0 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">{backLabel}</span>
          </Link>
        </div>

        <Link to={createPageUrl("Home")} aria-label={t("nav.home")} className="shrink-0">
          <Logo size="sm" showText />
        </Link>

        <div className="flex-1 min-w-0 flex items-center justify-end gap-0.5 sm:gap-1">
          {onShare && (
            <button type="button" onClick={onShare} aria-label={t("common.share")} className={iconButton}>
              <Share2 className="w-4 h-4" />
            </button>
          )}
          <div className="hidden sm:block">
            <LanguagePicker compact />
          </div>
          {currentUser && (
            <Link to={createPageUrl("Orders")} aria-label={t("nav.orders")} className={`hidden sm:flex ${iconButton}`}>
              <Package className="w-4 h-4" />
            </Link>
          )}
          {showCart && (
            <Link to={createPageUrl("Cart")} aria-label={t("nav.cart")} className={`relative ${iconButton}`}>
              <ShoppingBag className="w-4 h-4" />
              {cartItemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-600 text-white text-[9px] font-bold flex items-center justify-center">
                  {cartItemCount > 9 ? "9+" : cartItemCount}
                </span>
              )}
            </Link>
          )}
          {!currentUser && (
            <Link
              to="/login"
              className="ml-1 inline-flex items-center h-8 px-3 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors whitespace-nowrap"
            >
              {t("common.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
