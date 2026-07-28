import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";
import { StoreSkeleton } from "@/components/shared/LoadingSkeleton";
import { authLink, storePath } from "./authLink";

function StoreItem({ store, t }) {
  const storeId = store.id || store._id;
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
        {...authLink(storePath(storeId))}
        className="mt-1 w-full text-[11px] font-bold text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 rounded-lg py-1.5 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
      >
        {t("landing.stores.follow")}
      </Link>
    </div>
  );
}

function ActivityRow({ item }) {
  const initials = (item.name || "?").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl active:bg-slate-50 dark:active:bg-slate-800/60 sm:hover:bg-slate-50 dark:sm:hover:bg-slate-800/60 transition-colors">
      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
          <span className="font-bold text-slate-900 dark:text-white">{item.name}</span> {item.text}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.rating > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-semibold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {item.rating}
            </span>
          )}
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{item.time}</p>
        </div>
      </div>
      {item.thumbnail && (
        <img src={item.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
      )}
    </div>
  );
}

export default function CommunitySection({ stores, storesLoading, activity, activityLoading }) {
  const { t, i18n } = useTranslation();

  const activityItems = activity.map((a) => ({
    ...a,
    time: timeAgo(a.timestamp, i18n.language),
  }));

  return (
    <section id="community" className="grid lg:grid-cols-2 gap-6 scroll-mt-20">
      <div id="stores" className="scroll-mt-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{t("landing.stores.title")}</h2>
          <Link {...authLink("/marketplace")} className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-500">
            {t("landing.stores.viewAll")}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="flex sm:grid sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5 gap-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none -mx-4 sm:mx-0 px-4 sm:px-0 pb-1 sm:pb-0 hide-scrollbar">
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
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{t("landing.activity.title")}</h2>
          <Link {...authLink("/")} className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-500">
            {t("landing.activity.viewAll")}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-2">
          {activityLoading ? (
            <div className="p-4 space-y-3">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : activityItems.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8 px-4">{t("landing.activity.empty")}</p>
          ) : (
            activityItems.map((item) => <ActivityRow key={item.id} item={item} />)
          )}
        </div>
      </div>
    </section>
  );
}
