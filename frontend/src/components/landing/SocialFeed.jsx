import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, MessageCircle, Play } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";
import { authLink, postPath } from "./authLink";

function PostTile({ post, t, lang }) {
  const postId = post.id || post._id;
  const author = post.author_name || post.author_username;
  const initials = (author || "?").slice(0, 2).toUpperCase();
  const isVideo = post.media_type === "video";
  const poster = post.thumbnail_urls?.[0];
  const media = post.media_urls?.[0];

  return (
    <Link
      {...authLink(postPath(postId))}
      className="group flex flex-col w-[68vw] sm:w-auto shrink-0 snap-start bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 active:scale-[0.98] sm:hover:shadow-xl sm:hover:shadow-slate-100 dark:sm:hover:shadow-black/30 transition-all duration-300"
    >
      {media && (
        <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
          {isVideo ? (
            poster ? (
              <img src={poster} alt="" loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <video
                src={media}
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover pointer-events-none"
              />
            )
          ) : (
            <img
              src={media}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover sm:group-hover:scale-105 transition-transform duration-500"
            />
          )}

          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
              </div>
            </div>
          )}

          {post.media_urls.length > 1 && (
            <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold">
              1/{post.media_urls.length}
            </span>
          )}
        </div>
      )}

      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          {post.author_avatar ? (
            <img src={post.author_avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">{author}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
              {timeAgo(post.created_at, lang)}
            </p>
          </div>
        </div>

        {post.content && (
          <p className={`text-xs text-slate-600 dark:text-slate-300 leading-snug mb-2 ${media ? "line-clamp-2" : "line-clamp-5 flex-1"}`}>
            {post.content}
          </p>
        )}

        <div className="flex items-center gap-3 mt-auto pt-1">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <Heart className="w-3.5 h-3.5" />
            {post.likes_count || 0}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <MessageCircle className="w-3.5 h-3.5" />
            {post.comments_count || 0}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function SocialFeed({ posts, isLoading }) {
  const { t, i18n } = useTranslation();

  return (
    <section id="feed" className="scroll-mt-20">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
            {t("landing.feed.title")}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t("landing.feed.subtitle")}
          </p>
        </div>
        <Link
          {...authLink("/")}
          className="inline-flex items-center gap-1 shrink-0 text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-500 mt-0.5"
        >
          {t("landing.feed.viewAll")}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex sm:grid sm:grid-cols-4 gap-4 overflow-hidden">
          {Array(4).fill(0).map((_, i) => (
            <div
              key={`feed-sk-${i}`}
              className="w-[68vw] sm:w-auto shrink-0 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="aspect-square bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">{t("landing.feed.empty")}</p>
      ) : (
        <div className="flex sm:grid sm:grid-cols-4 gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none -mx-4 sm:mx-0 px-4 sm:px-0 pb-1 sm:pb-0 hide-scrollbar">
          {posts.map((post) => (
            <PostTile key={post.id || post._id} post={post} t={t} lang={i18n.language} />
          ))}
        </div>
      )}
    </section>
  );
}
