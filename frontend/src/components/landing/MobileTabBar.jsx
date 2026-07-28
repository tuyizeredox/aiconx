import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Home, Compass, UserPlus, ShoppingBag, LogIn } from "lucide-react";
import { getGuestCartCount } from "@/lib/guestCart";
import { authLink } from "./authLink";

export default function MobileTabBar() {
  const { t } = useTranslation();
  const [cartCount, setCartCount] = useState(() => getGuestCartCount());

  useEffect(() => {
    const refresh = () => setCartCount(getGuestCartCount());
    window.addEventListener("guestcart:updated", refresh);
    return () => window.removeEventListener("guestcart:updated", refresh);
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 z-50">
      <div className="flex items-center justify-around h-16 px-2">
        <button
          onClick={scrollTop}
          className="flex flex-col items-center gap-0.5 min-w-[3rem] py-1 active:scale-90 transition-transform"
        >
          <Home className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">{t("nav.home")}</span>
        </button>

        <a
          href="#trending"
          className="flex flex-col items-center gap-0.5 min-w-[3rem] py-1 active:scale-90 transition-transform"
        >
          <Compass className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t("nav.explore")}</span>
        </a>

        <Link
          {...authLink("/")}
          aria-label={t("landing.nav.createStore")}
          className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-orange-900/40 -mt-5 active:scale-90 transition-transform"
        >
          <UserPlus className="w-5 h-5 text-white" />
        </Link>

        <Link
          to="/cart"
          className="flex flex-col items-center gap-0.5 relative min-w-[3rem] py-1 active:scale-90 transition-transform"
        >
          <ShoppingBag className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          {cartCount > 0 && (
            <span className="absolute top-0 right-1.5 bg-orange-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center border border-white dark:border-slate-900">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t("nav.cart")}</span>
        </Link>

        <Link
          to="/login"
          className="flex flex-col items-center gap-0.5 min-w-[3rem] py-1 active:scale-90 transition-transform"
        >
          <LogIn className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t("common.login")}</span>
        </Link>
      </div>
    </nav>
  );
}
