import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import PostCard from "@/components/shared/PostCard";
import AvatarImg from "@/components/shared/AvatarImg";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePostComments, CommentList, CommentComposer } from "./CommentThread";

/**
 * The desktop post view: the post on the left, its comments in a column on
 * the right.
 *
 * On mobile this is the wrong shape — CommentsSheet slides the thread up over
 * the feed instead of reopening the post — so PostCard only reaches for this
 * on wide screens, where there is room to show both at once.
 *
 * The thread itself lives in CommentThread and is shared with the sheet.
 */
export default function PostDetailModal({ isOpen, onOpenChange, post, currentUser, contentClassName = "" }) {
  const { t } = useTranslation();
  const postId = (post?.id || post?._id)?.toString();

  const { topLevelComments, repliesMap, isLoading, error } = usePostComments(
    postId,
    currentUser,
    isOpen
  );

  const count = isLoading ? (post?.comments_count || 0) : topLevelComments.length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`w-full h-full max-w-4xl sm:max-w-5xl md:max-w-6xl lg:max-w-7xl p-0 gap-0 overflow-hidden border-0 rounded-none sm:rounded-2xl bg-slate-50 dark:bg-ink-900 ${contentClassName}`}
      >
        <DialogTitle className="sr-only">
          {t("common.postBy", { name: post?.author_name || post?.author_username || "" })}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {count > 0 ? t("common.commentsCount", { count }) : t("common.comments")}
        </DialogDescription>

        <div className="flex flex-col lg:flex-row h-full max-h-[100vh] overflow-y-auto lg:overflow-hidden custom-scrollbar">
          {/* Post */}
          <div className="flex-1 lg:overflow-y-auto custom-scrollbar lg:min-h-0">
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-ink-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-ink-800 pt-[max(1rem,env(safe-area-inset-top))] px-4 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-ink-800 flex items-center justify-center text-slate-600 dark:text-ink-400 font-semibold text-sm ring-2 ring-white dark:ring-ink-900 overflow-hidden shadow-sm shrink-0">
                  <AvatarImg
                    src={post.author_avatar}
                    alt={post.author_name}
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="w-full h-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white">
                        {post.author_name?.[0]?.toUpperCase() || "U"}
                      </div>
                    }
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-ink-100 truncate">{post.author_name || "User"}</p>
                  <p className="text-xs text-slate-500 dark:text-ink-400 truncate">@{post.author_username}</p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                aria-label={t("common.close")}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-400 dark:text-ink-500 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <PostCard post={post} currentUser={currentUser} fullView={true} />
            </div>
          </div>

          {/* Comments */}
          <div className="w-full lg:w-[400px] xl:w-[450px] border-l border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 flex flex-col lg:max-h-full lg:min-h-0">
            <div className="p-4 border-b border-slate-100 dark:border-ink-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {t("common.comments")}
                <span className="text-sm font-normal text-slate-400">({count})</span>
              </h3>
            </div>

            <CommentList
              postId={postId}
              currentUser={currentUser}
              topLevelComments={topLevelComments}
              repliesMap={repliesMap}
              isLoading={isLoading}
              error={error}
              className="lg:flex-1 lg:overflow-y-auto custom-scrollbar p-4 space-y-5"
            />

            <CommentComposer
              postId={postId}
              currentUser={currentUser}
              className="sticky bottom-0 lg:static bg-white/95 dark:bg-ink-900/95 backdrop-blur-xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-100 dark:border-ink-800"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
