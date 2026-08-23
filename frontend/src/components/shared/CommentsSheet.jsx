import React from "react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { usePostComments, CommentList, CommentComposer } from "./CommentThread";

/**
 * Comments as a bottom sheet — the mobile answer to "who replied to this?".
 *
 * Tapping the comment icon used to reopen the entire post in a full-screen
 * modal: the shopper lost their place in the feed and had to reconcile a
 * second copy of the post they were already looking at. This slides the
 * thread up over the feed instead, leaving the post visible behind it, so
 * dismissing it returns them exactly where they were.
 *
 * The composer is pinned to the bottom of the sheet; vaul repositions it
 * above the on-screen keyboard.
 */
export default function CommentsSheet({ open, onOpenChange, post, currentUser, contentClassName = "", overlayClassName = "" }) {
  const { t } = useTranslation();
  const postId = (post?.id || post?._id)?.toString();

  const { topLevelComments, repliesMap, isLoading, error } = usePostComments(
    postId,
    currentUser,
    open
  );

  // Until the thread loads, the post's own counter is the honest number —
  // showing "0" and then correcting it reads like comments were lost.
  const count = isLoading ? (post?.comments_count || 0) : topLevelComments.length;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        overlayClassName={overlayClassName}
        className={`h-[85vh] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none ${contentClassName}`}
      >
        <div className="shrink-0 px-4 pt-1 pb-3 border-b border-slate-100 dark:border-slate-800">
          <DrawerTitle className="text-center text-[15px] font-bold text-slate-900 dark:text-white">
            {count > 0 ? t("common.commentsCount", { count }) : t("common.comments")}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {t("common.commentsOnPostBy", { name: post?.author_name || post?.author_username || "" })}
          </DrawerDescription>
        </div>

        <CommentList
          postId={postId}
          currentUser={currentUser}
          topLevelComments={topLevelComments}
          repliesMap={repliesMap}
          isLoading={isLoading}
          error={error}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-5"
        />

        <CommentComposer
          postId={postId}
          currentUser={currentUser}
          className="shrink-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
        />
      </DrawerContent>
    </Drawer>
  );
}
