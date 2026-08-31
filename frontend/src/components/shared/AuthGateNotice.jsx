import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, LogIn } from "lucide-react";

/**
 * Why this sign-in screen is being shown.
 *
 * A visitor who lands here by tapping "sign in" already knows why they came.
 * This is for the other kind: someone who was reading a post, tapped the heart
 * and found themselves on a form. It names the action they were in the middle
 * of, promises they will be returned to it, and — since most people who hit
 * this wall have no account at all — puts creating one right next to it
 * instead of at the bottom of the page.
 *
 * `intent` arrives in router state from useAuthGate. With no intent (someone
 * who navigated here deliberately) this renders nothing at all.
 */
export default function AuthGateNotice({ variant = "login" }) {
  const { t } = useTranslation();
  const location = useLocation();
  const intent = location.state?.intent;

  if (!intent) return null;

  // The intent names only the action ("like this post"), so the same string
  // reads correctly under either heading — this page asks you to sign in, the
  // register page asks you to create an account. An intent with no phrase of
  // its own still gets a sentence that makes sense.
  const isRegister = variant === "register";
  const action = t(`auth.intents.${intent}`, { defaultValue: "" });
  const message = action
    ? t(isRegister ? "auth.gateCreateTo" : "auth.gateSignInTo", { action })
    : t(isRegister ? "auth.gateCreateTitle" : "auth.gateTitle");

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3.5 dark:border-orange-500/25 dark:bg-orange-500/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400">
          <LogIn className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{message}</p>
          <p className="text-xs text-slate-600 dark:text-ink-400">{t("auth.gateBackTo")}</p>

          {/* The register link carries this same router state on, so someone
              who signs up instead of signing in still lands back where they
              started. */}
          {!isRegister && (
            <p className="pt-1 text-xs text-slate-600 dark:text-ink-400">
              {t("auth.gateNoAccount")}{" "}
              <Link
                to="/register"
                state={location.state}
                className="inline-flex items-center gap-1 font-semibold text-orange-600 hover:text-orange-500 dark:text-orange-400"
              >
                {t("auth.gateCreateAccount")}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
