import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import AISparkIcon from "@/components/shared/AISparkIcon";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import AIAssistant from "@/pages/AIAssistant";

// Screens where a floating button is noise or in the way: the sign-in flow and
// the legal pages (nothing to ask an assistant about), the admin panel, the
// assistant's own full page, and Chat — whose composer already owns the bottom
// of the screen.
const HIDDEN_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/community-guidelines",
  "/aiassistant",
  "/chat",
]);

// Routes App.jsx renders outside Layout, so they have no mobile bottom nav for
// the button to clear.
const STANDALONE_ROUTES = ["/marketplace", "/storedetail", "/store/", "/cart", "/checkout"];

// How far above the bottom edge the button floats on a handset. Anything the
// app pins to the bottom of a screen has to be cleared, or the button lands on
// top of a nav item or the Buy button.
const MOBILE_BOTTOM = {
  nav: "calc(env(safe-area-inset-bottom) + 4.75rem)", // Layout's bottom nav (h-16)
  buyBar: "calc(env(safe-area-inset-bottom) + 5rem)", // ProductDetail's floating buy bar
  bare: "calc(env(safe-area-inset-bottom) + 1.25rem)", // standalone shop pages
};

// The one-time nudge that says what the button is. Shown once per device —
// after that the icon has to carry it on its own.
const HINT_STORAGE_KEY = "aicon_ai_fab_hint_v1";

function GuestPanel({ onClose }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-4 bg-white/80 dark:bg-ink-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-ink-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-orange-900/40">
            <AISparkIcon tone="gloss" className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{t("ai.title")}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label={t("ai.closeAssistant")}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors"
        >
          <X className="w-4 h-4 text-slate-400 dark:text-ink-500" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-orange-900/40">
          <AISparkIcon tone="gloss" className="w-7 h-7" />
        </div>
        <div>
          <p className="text-base font-bold text-slate-900 dark:text-white">{t("ai.guestTitle")}</p>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-ink-400 leading-relaxed">{t("ai.guestSubtitle")}</p>
        </div>
        <Button
          onClick={() => {
            onClose();
            navigate("/login", { state: { from: location.pathname + location.search } });
          }}
          className="h-11 px-6 rounded-2xl bg-gradient-to-br from-orange-600 to-purple-600 hover:from-orange-700 hover:to-purple-700 text-sm font-semibold"
        >
          <LogIn className="w-4 h-4 mr-2" />
          {t("auth.signIn")}
        </Button>
      </div>
    </div>
  );
}

export default function AIAssistantLauncher() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const hintTimersRef = useRef([]);

  const path = location.pathname.toLowerCase();
  const hidden =
    isLoadingAuth ||
    user?.role === "super_admin" ||
    path.startsWith("/admin-dashboard") ||
    HIDDEN_ROUTES.has(path);

  // The panel belongs to the screen it was opened from — a question asked about
  // one product shouldn't follow the user onto the next page.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // The sheet covers the whole handset screen; letting the page keep scrolling
  // behind it drags the feed away under the user's thumb.
  useEffect(() => {
    if (!open || !isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (hidden || open) return;
    try {
      if (localStorage.getItem(HINT_STORAGE_KEY)) return;
    } catch (_) {
      return;
    }
    hintTimersRef.current = [
      setTimeout(() => setShowHint(true), 1800),
      setTimeout(() => {
        setShowHint(false);
        try {
          localStorage.setItem(HINT_STORAGE_KEY, "1");
        } catch (_) {}
      }, 9000),
    ];
    return () => {
      hintTimersRef.current.forEach(clearTimeout);
      hintTimersRef.current = [];
    };
  }, [hidden, open]);

  if (hidden) return null;

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_STORAGE_KEY, "1");
    } catch (_) {}
  };

  const mobileBottom = path.startsWith("/productdetail")
    ? MOBILE_BOTTOM.buyBar
    : STANDALONE_ROUTES.some((route) => path.startsWith(route))
      ? MOBILE_BOTTOM.bare
      : MOBILE_BOTTOM.nav;

  return (
    <>
      {/* Launcher. Icon-only on a handset so it never covers more of the feed
          than it has to; a labelled pill on desktop, where there is room to say
          what it does. It sits below the app's own bars (z-40 against the nav's
          z-50) so it can never swallow a tap meant for navigation. */}
      <div
        style={{ "--ai-fab-bottom": mobileBottom }}
        className={`fixed right-4 bottom-[var(--ai-fab-bottom)] lg:right-6 lg:bottom-6 z-40 items-center gap-2 ${
          open ? "hidden lg:flex" : "flex"
        }`}
      >
        <AnimatePresence>
          {showHint && !open && (
            <motion.button
              key="hint"
              initial={{ opacity: 0, x: 10, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.94 }}
              onClick={dismissHint}
              className="max-w-[10rem] sm:max-w-none rounded-2xl bg-ink-900 dark:bg-white px-3 py-2 text-[11px] sm:text-xs font-semibold text-white dark:text-ink-900 shadow-xl text-left leading-snug"
            >
              {t("ai.fabHint")}
            </motion.button>
          )}
        </AnimatePresence>

        <button
          onClick={() => {
            dismissHint();
            setOpen((prev) => !prev);
          }}
          aria-expanded={open}
          aria-label={open ? t("ai.closeAssistant") : t("ai.openAssistant")}
          title={open ? t("ai.closeAssistant") : t("ai.openAssistant")}
          className="group flex items-center justify-center gap-2 h-14 w-14 lg:w-auto lg:px-5 rounded-full bg-gradient-to-br from-pink-500 via-orange-500 to-orange-600 text-white ring-1 ring-white/40 dark:ring-white/10 shadow-lg shadow-orange-500/30 dark:shadow-orange-900/50 transition-all hover:shadow-xl hover:shadow-orange-500/40 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-900"
        >
          {open ? (
            <X className="w-6 h-6 lg:w-5 lg:h-5 shrink-0" />
          ) : (
            <AISparkIcon
              tone="gloss"
              className="w-7 h-7 lg:w-6 lg:h-6 shrink-0 transition-transform duration-500 ease-out group-hover:rotate-[10deg] group-hover:scale-110"
            />
          )}
          <span className="hidden lg:inline text-sm font-semibold whitespace-nowrap">{t("ai.fabLabel")}</span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop is mobile-only: on desktop the panel is a corner widget
                you keep open while you browse, not a modal. */}
            <motion.div
              key="ai-panel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="lg:hidden fixed inset-0 z-[85] bg-ink-900/50 backdrop-blur-sm"
            />

            <motion.div
              key="ai-panel"
              role="dialog"
              aria-modal={isMobile ? "true" : undefined}
              aria-label={t("ai.title")}
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              style={isMobile ? { maxHeight: "88dvh" } : undefined}
              className="fixed z-[90] flex flex-col overflow-hidden bg-slate-50 dark:bg-ink-900 shadow-2xl
                inset-x-0 bottom-0 h-[88vh] rounded-t-3xl border-t border-slate-200 dark:border-ink-800
                lg:inset-x-auto lg:right-6 lg:bottom-24 lg:w-[24rem] xl:w-[26rem] lg:h-[34rem] lg:max-h-[calc(100vh-9rem)] lg:rounded-3xl lg:border"
            >
              {/* Grab handle, painted like the header underneath it so the two
                  read as one block rather than a bar with a strip above it. */}
              <div className="lg:hidden shrink-0 flex justify-center pt-2.5 pb-1 bg-white/80 dark:bg-ink-900/80 backdrop-blur-xl">
                <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-ink-700" />
              </div>

              <div className="flex-1 min-h-0 flex flex-col pb-[env(safe-area-inset-bottom)] lg:pb-0">
                {isAuthenticated ? (
                  <AIAssistant embedded onClose={() => setOpen(false)} />
                ) : (
                  <GuestPanel onClose={() => setOpen(false)} />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
