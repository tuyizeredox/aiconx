import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, Store } from "lucide-react";
import { StoreSkeleton } from "@/components/shared/LoadingSkeleton";
import EmptyState from "./EmptyState";
import { authLink, storePath } from "./authLink";

function StoreItem({ store, t }) {
  return (
    <div className="flex flex-col items-center text-center gap-1.5 w-[30vw] sm:w-auto shrink-0 snap-start bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 active:scale-[0.97] transition-transform">
      <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900 dark:to-orange-900 flex items-center justify-center text-sm font-bold text-orange-600 dark:text-orange-300 shrink-0">
        {store.logo_url ? (
          <img src={store.logo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          store.name?.[0]?.toUpperCase()
        )}
      </div>
      <p className="text-xs font-bold text-slate-900 dark:text-white truncate w-full">{store.name}</p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        {t("landing.stores.followers", { count: store.follower_count || 0 })}
      </p>
      <Link
        {...authLink(storePath(store))}
        className="mt-1 w-full text-[11px] font-bold text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 rounded-lg py-1.5 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
      >
        {t("landing.stores.follow")}
      </Link>
    </div>
  );
}

export default function CommunitySection({ stores, storesLoading }) {
  const { t } = useTranslation();

  return (
    <section id="stores" className="scroll-mt-20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{t("landing.stores.title")}</h2>
        <Link {...authLink("/marketplace")} className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-500">
          {t("landing.stores.viewAll")}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {!storesLoading && stores.length === 0 ? (
        <EmptyState
          variant="subtle"
          icon={Store}
          title={t("landing.stores.emptyTitle")}
          description={t("landing.stores.emptyDesc")}
          cta={t("landing.stores.emptyCta")}
          to={authLink("/mystore")}
        />
      ) : (
        <div className="flex sm:grid sm:grid-cols-5 gap-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none -mx-4 sm:mx-0 px-4 sm:px-0 pb-1 sm:pb-0 hide-scrollbar">
          {storesLoading
            ? Array(5).fill(0).map((_, i) => (
                <div key={`pop-store-sk-${i}`} className="w-[30vw] sm:w-auto shrink-0">
                  <StoreSkeleton />
                </div>
              ))
            : stores.map((store, idx) => (
                <StoreItem key={store.id || store._id || `pop-store-${idx}`} store={store} t={t} />
              ))}
        </div>
      )}
    </section>
  );
}
