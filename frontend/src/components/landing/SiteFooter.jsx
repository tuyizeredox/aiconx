import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Apple, Mail, Play } from "lucide-react";
import Logo from "@/components/layout/Logo";
import { authLink } from "./authLink";

// Kept in sync with Support.jsx, which is auth-gated — a logged-out visitor bounces
// to /welcome — so the footer links to the mailbox directly instead of the page.
const SUPPORT_EMAIL = "support@iqon.ai";

// The Android project (capacitor.config.ts, appId com.aiconx.app) exists but no
// listing URL is checked in anywhere, and there is no iOS project at all. Badges
// are therefore driven by env vars: each one renders only once a real store URL
// is set, so the footer never advertises an app a visitor cannot install.
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL;
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL;

function StoreBadge({ href, icon: Icon, line1, line2 }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 h-11 px-4 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 hover:opacity-90 active:scale-[0.98] transition-all"
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-left leading-tight">
        <span className="block text-[9px] font-medium opacity-70">{line1}</span>
        <span className="block text-xs font-bold">{line2}</span>
      </span>
    </a>
  );
}

function FooterColumn({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3">{title}</h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

const linkClass =
  "text-sm text-slate-500 dark:text-ink-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors";

export default function SiteFooter() {
  const { t } = useTranslation();
  const hasApps = Boolean(PLAY_STORE_URL || APP_STORE_URL);

  return (
    <footer className="border-t border-slate-100 dark:border-ink-800 bg-slate-50/60 dark:bg-ink-900/40">
      {/* Extra bottom padding clears the fixed MobileTabBar on small screens. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] lg:pb-14">
        <div className="grid gap-8 sm:gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Logo size="sm" showText />
            <p className="text-sm text-slate-500 dark:text-ink-400 mt-3 max-w-xs leading-relaxed">
              {t("landing.footer.tagline")}
            </p>

            {hasApps && (
              <div className="flex flex-wrap gap-2.5 mt-5">
                {PLAY_STORE_URL && (
                  <StoreBadge
                    href={PLAY_STORE_URL}
                    icon={Play}
                    line1={t("landing.footer.getItOn")}
                    line2={t("landing.footer.googlePlay")}
                  />
                )}
                {APP_STORE_URL && (
                  <StoreBadge
                    href={APP_STORE_URL}
                    icon={Apple}
                    line1={t("landing.footer.downloadOn")}
                    line2={t("landing.footer.appStore")}
                  />
                )}
              </div>
            )}
          </div>

          <FooterColumn title={t("landing.footer.platform")}>
            <li>
              <a href="#trending" className={linkClass}>{t("landing.nav.shop")}</a>
            </li>
            <li>
              <a href="#stores" className={linkClass}>{t("landing.nav.stores")}</a>
            </li>
            <li>
              <a href="#catalogue" className={linkClass}>{t("shop.products")}</a>
            </li>
            <li>
              <Link {...authLink("/mystore")} className={linkClass}>{t("landing.nav.sell")}</Link>
            </li>
          </FooterColumn>

          <FooterColumn title={t("landing.footer.account")}>
            <li>
              <Link to="/login" className={linkClass}>{t("common.login")}</Link>
            </li>
            <li>
              <Link to="/register" className={linkClass}>{t("common.register")}</Link>
            </li>
            <li>
              <Link {...authLink("/mystore")} className={linkClass}>{t("landing.nav.createStore")}</Link>
            </li>
          </FooterColumn>

          <FooterColumn title={t("landing.footer.legal")}>
            <li>
              <Link to="/terms" className={linkClass}>{t("common.terms")}</Link>
            </li>
            <li>
              <Link to="/privacy" className={linkClass}>{t("common.privacy")}</Link>
            </li>
            <li>
              <Link to="/community-guidelines" className={linkClass}>{t("common.communityGuidelines")}</Link>
            </li>
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`} className={`${linkClass} inline-flex items-center gap-1.5`}>
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {t("landing.footer.contact")}
              </a>
            </li>
          </FooterColumn>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-10 pt-6 border-t border-slate-200/70 dark:border-ink-800">
          <p className="text-xs text-slate-400 dark:text-ink-500">
            {t("landing.footer.copyright", { year: new Date().getFullYear() })}
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-xs font-semibold text-slate-500 dark:text-ink-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
