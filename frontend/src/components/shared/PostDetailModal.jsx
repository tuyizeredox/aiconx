import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent 
} from "@/components/ui/dialog";
import PostCard from "@/components/shared/PostCard";
import { Send, Loader2, MessageCircle, Heart, CornerDownRight, ChevronDown, ChevronUp, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { postsAPI, commentsAPI } from "@/api/apiClient";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/AuthContext";
import { useSocket } from "@/lib/SocketContext";

function ReplyItem({ reply, currentUser }) {
  const queryClient = useQueryClient();
  const { on } = useSocket();
  const replyId = (reply.id || reply._id)?.toString();
  const [isLiked, setIsLiked] = useState(!!reply.is_liked);
  const [likesCount, setLikesCount] = useState(reply.likes_count || 0);
  const replyAuthorProfile = createPageUrl("Profile") + `?username=${reply.author_username || "anonymous"}`;

  React.useEffect(() => { setIsLiked(!!reply.is_liked); }, [reply.is_liked]);
  React.useEffect(() => { setLikesCount(reply.likes_count || 0); }, [reply.likes_count]);

  React.useEffect(() => {
    if (!replyId) return;
    const unsubscribe = on('comment_updated', (data) => {
      if (data.comment_id === replyId) {
        if (data.likes_count !== undefined) setLikesCount(data.likes_count);
        if (data.user_username && currentUser?.username &&
            data.user_username.toLowerCase() === currentUser.username.toLowerCase()) {
          if (data.type === 'like') setIsLiked(true);
          else if (data.type === 'unlike') setIsLiked(false);
        }
      }
    });
    return unsubscribe;
  }, [replyId, currentUser?.username, on]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      return isLiked ? await commentsAPI.unlike(replyId) : await commentsAPI.like(replyId);
    },
    onMutate: () => {
      const next = !isLiked;
      setIsLiked(next);
      setLikesCount(prev => next ? prev + 1 : Math.max(0, prev - 1));
    },
    onSuccess: (data) => {
      if (data?.likes_count !== undefined) setLikesCount(data.likes_count);
      if (data?.is_liked !== undefined) setIsLiked(data.is_liked);
      queryClient.setQueriesData({ queryKey: ["postComments"] }, (old) => {
        if (!old) return old;
        const updateReply = (c) =>
          (c.id || c._id)?.toString() === replyId
            ? { ...c, likes_count: data?.likes_count ?? c.likes_count, is_liked: data?.is_liked ?? c.is_liked }
            : c;
        if (Array.isArray(old)) return old.map(updateReply);
        if (old.comments) return { ...old, comments: old.comments.map(updateReply) };
        return old;
      });
    },
    onError: () => {
      setIsLiked(!!reply.is_liked);
      setLikesCount(reply.likes_count || 0);
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2.5 ml-10 mt-3"
    >
      <Link to={replyAuthorProfile} className="shrink-0">
        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-[10px] font-bold shrink-0 overflow-hidden border border-white dark:border-slate-800 shadow-sm hover:ring-2 hover:ring-orange-200 dark:hover:ring-orange-700 transition-all">
          {reply.author_avatar ? (
            <img src={reply.author_avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            reply.author_name?.[0]?.toUpperCase() || "U"
          )}
        </div>
      </Link>
      <div className="flex-1">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-3.5 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Link to={replyAuthorProfile} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{reply.author_name || "User"}</span>
              <span className="text-[10px] text-slate-400">@{reply.author_username || "anonymous"}</span>
            </Link>
            <span className="text-[10px] text-slate-300">·</span>
            <span className="text-[10px] text-slate-400">
              {new Date(reply.created_at || reply.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{reply.content}</p>
        </div>
        <button
          onClick={() => currentUser && likeMutation.mutate()}
          className={`flex items-center gap-1 text-[10px] font-bold mt-1.5 ml-1 transition-colors ${isLiked ? "text-red-500" : "text-slate-400 hover:text-red-400"}`}
        >
          <Heart className={`w-3 h-3 ${isLiked ? "fill-current" : ""}`} />
          {likesCount > 0 && likesCount} {isLiked ? "Liked" : "Like"}
        </button>
      </div>
    </motion.div>
  );
}

function CommentItem({ comment, currentUser, replies, postId, onReplyPosted }) {
  const queryClient = useQueryClient();
  const { on } = useSocket();
  const { t } = useTranslation();
  const commentId = (comment.id || comment._id)?.toString();
  const [isLiked, setIsLiked] = useState(!!comment.is_liked);
  const [likesCount, setLikesCount] = useState(comment.likes_count || 0);
  const commentAuthorProfile = createPageUrl("Profile") + `?username=${comment.author_username || "anonymous"}`;
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const replyInputRef = useRef(null);

  React.useEffect(() => { setIsLiked(!!comment.is_liked); }, [comment.is_liked]);
  React.useEffect(() => { setLikesCount(comment.likes_count || 0); }, [comment.likes_count]);

  useEffect(() => {
    if (showReplyInput && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [showReplyInput]);

  React.useEffect(() => {
    if (!commentId) return;
    const unsubscribe = on('comment_updated', (data) => {
      if (data.comment_id === commentId) {
        if (data.likes_count !== undefined) setLikesCount(data.likes_count);
        if (data.user_username && currentUser?.username &&
            data.user_username.toLowerCase() === currentUser.username.toLowerCase()) {
          if (data.type === 'like') setIsLiked(true);
          else if (data.type === 'unlike') setIsLiked(false);
        }
      }
    });
    return unsubscribe;
  }, [commentId, currentUser?.username, on]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      return isLiked ? await commentsAPI.unlike(commentId) : await commentsAPI.like(commentId);
    },
    onMutate: () => {
      const next = !isLiked;
      setIsLiked(next);
      setLikesCount(prev => next ? prev + 1 : Math.max(0, prev - 1));
    },
    onSuccess: (data) => {
      if (data?.likes_count !== undefined) setLikesCount(data.likes_count);
      if (data?.is_liked !== undefined) setIsLiked(data.is_liked);
      queryClient.setQueriesData({ queryKey: ["postComments"] }, (old) => {
        if (!old) return old;
        const updateComment = (c) =>
          (c.id || c._id)?.toString() === commentId
            ? { ...c, likes_count: data?.likes_count ?? c.likes_count, is_liked: data?.is_liked ?? c.is_liked }
            : c;
        if (Array.isArray(old)) return old.map(updateComment);
        if (old.comments) return { ...old, comments: old.comments.map(updateComment) };
        return old;
      });
    },
    onError: () => {
      setIsLiked(!!comment.is_liked);
      setLikesCount(comment.likes_count || 0);
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      await commentsAPI.create({
        post_id: postId,
        parent_comment_id: commentId,
        content: replyText.trim(),
      });
    },
    onSuccess: () => {
      setReplyText("");
      setShowReplyInput(false);
      setShowReplies(true);
      queryClient.invalidateQueries({ queryKey: ["postComments"] });
      queryClient.invalidateQueries({ queryKey: ["postDetail"] });
      if (onReplyPosted) onReplyPosted();
    },
  });

  const replyCount = replies?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 group"
    >
      <Link to={commentAuthorProfile} className="shrink-0">
        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-bold shrink-0 border border-white dark:border-slate-800 shadow-sm overflow-hidden hover:ring-2 hover:ring-orange-200 dark:hover:ring-orange-700 transition-all">
          {comment.author_avatar ? (
            <img src={comment.author_avatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            comment.author_name?.[0]?.toUpperCase() || "U"
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm p-4 hover:shadow-md hover:shadow-slate-100 dark:hover:shadow-slate-700/50 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Link to={commentAuthorProfile} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{comment.author_name || "User"}</span>
                <span className="text-[10px] text-slate-400 font-medium">@{comment.author_username || "anonymous"}</span>
              </Link>
            </div>
            <span className="text-[10px] font-medium text-slate-400">
              {new Date(comment.created_at || comment.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">{comment.content}</p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => currentUser && likeMutation.mutate()}
              className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${isLiked ? "text-red-500" : "text-slate-400 hover:text-red-400"}`}
            >
              <Heart className={`w-3 h-3 ${isLiked ? "fill-current" : ""}`} />
              {likesCount > 0 && likesCount} {isLiked ? "Liked" : "Like"}
            </button>
            {currentUser && (
              <button
                onClick={() => setShowReplyInput(prev => !prev)}
                className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${showReplyInput ? "text-orange-600" : "text-slate-400 hover:text-orange-500"}`}
              >
                <CornerDownRight className="w-3 h-3" />
                {t("common.reply") || "Reply"}
              </button>
            )}
          </div>
        </div>

        {/* Reply input */}
        <AnimatePresence>
          {showReplyInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mt-2 ml-2 pl-2 border-l-2 border-orange-200">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {currentUser?.full_name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 flex gap-2">
                  <Input
                    ref={replyInputRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`${t("common.replyTo") || "Reply to"} @${comment.author_username || "User"}...`}
                    className="rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400 h-9 text-sm focus:ring-orange-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && replyText.trim() && !replyMutation.isPending) {
                        e.preventDefault();
                        replyMutation.mutate();
                      }
                      if (e.key === "Escape") {
                        setShowReplyInput(false);
                        setReplyText("");
                      }
                    }}
                  />
                  <Button
                    onClick={() => replyText.trim() && replyMutation.mutate()}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    size="icon"
                    className="rounded-xl bg-orange-600 hover:bg-orange-700 w-9 h-9 shrink-0"
                  >
                    {replyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View / hide replies */}
        {replyCount > 0 && (
          <button
            onClick={() => setShowReplies(prev => !prev)}
            className="flex items-center gap-1.5 ml-2 mt-2 text-[11px] font-bold text-orange-600 hover:text-orange-700 transition-colors"
          >
            {showReplies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showReplies
              ? (t("common.hideReplies") || "Hide replies")
              : `${t("common.viewReplies") || "View"} ${replyCount} ${replyCount === 1 ? (t("common.reply") || "reply") : (t("common.replies") || "replies")}`
            }
          </button>
        )}

        {/* Replies list */}
        <AnimatePresence>
          {showReplies && replyCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-1 space-y-1"
            >
              {replies.map((reply, i) => (
                <ReplyItem
                  key={reply.id || reply._id || i}
                  reply={reply}
                  currentUser={currentUser}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function PostDetailModal({ isOpen, onOpenChange, post, currentUser }) {
  const { t } = useTranslation();
  const postId = (post?.id || post?._id)?.toString();
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();

  const { data: commentsData = [], isLoading: commentsLoading, error: commentsError } = useQuery({
    queryKey: ["postComments", postId, currentUser?.username],
    queryFn: () => {
      const p = { sort: "created_at", limit: 100 };
      if (currentUser?.username) p.user_username = currentUser.username;
      return commentsAPI.list(postId, p);
    },
    enabled: !!isOpen && !!postId,
    retry: false,
  });

  const allComments = Array.isArray(commentsData) ? commentsData : commentsData?.comments || [];

  const topLevelComments = allComments.filter(c => !c.parent_comment_id);
  const repliesMap = allComments
    .filter(c => !!c.parent_comment_id)
    .reduce((acc, reply) => {
      const pid = reply.parent_comment_id;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(reply);
      return acc;
    }, {});

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      await commentsAPI.create({
        post_id: postId,
        content: commentText,
      });
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["postComments"] });
      queryClient.invalidateQueries({ queryKey: ["postDetail"] });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full max-w-4xl sm:max-w-5xl md:max-w-6xl lg:max-w-7xl p-0 gap-0 overflow-hidden border-0 rounded-none sm:rounded-2xl bg-slate-50 dark:bg-[#0a0a0c]">
        <div className="flex flex-col lg:flex-row h-full max-h-[100vh]">
          {/* Left side - Post */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-semibold text-sm ring-2 ring-white dark:ring-slate-900 overflow-hidden shadow-sm">
                  {post.author_avatar ? (
                    <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white">
                      {post.author_name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{post.author_name || "User"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">@{post.author_username}</p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <PostCard post={post} currentUser={currentUser} fullView={true} />
            </div>
          </div>

          {/* Right side - Comments */}
          <div className="w-full lg:w-[400px] xl:w-[450px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col max-h-[50vh] lg:max-h-full">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {t("common.comments")}
                <span className="text-sm font-normal text-slate-400">({topLevelComments.length || post?.comments_count || 0})</span>
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
              {commentsError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-2xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Failed to load comments. Please refresh.
                </div>
              )}

              {commentsLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700" />
                    <div className="flex-1 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-2">
                      <div className="h-2.5 w-24 bg-slate-100 dark:bg-slate-700 rounded" />
                      <div className="h-2 w-full bg-slate-50 dark:bg-slate-700/50 rounded" />
                    </div>
                  </div>
                ))
              ) : topLevelComments.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                  <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-medium">No comments yet. Be the first!</p>
                </div>
              ) : (
                topLevelComments.map((comment, i) => (
                  <CommentItem
                    key={comment.id || comment._id || i}
                    comment={comment}
                    currentUser={currentUser}
                    replies={repliesMap[(comment.id || comment._id)?.toString()] || []}
                    postId={postId}
                    onReplyPosted={() => queryClient.invalidateQueries({ queryKey: ["postComments"] })}
                  />
                ))
              )}
            </div>

            {/* Add Comment */}
            {currentUser && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0 border-2 border-white shadow-sm">
                    {currentUser.full_name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={t("chat.typeMessage")}
                      className="rounded-2xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400 h-11 focus:ring-orange-100"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && commentText.trim() && !addCommentMutation.isPending) {
                          e.preventDefault();
                          addCommentMutation.mutate();
                        }
                      }}
                    />
                    <Button
                      onClick={() => commentText.trim() && addCommentMutation.mutate()}
                      disabled={!commentText.trim() || addCommentMutation.isPending}
                      size="icon"
                      className="rounded-2xl bg-orange-600 hover:bg-orange-700 w-11 h-11 shrink-0 shadow-lg shadow-orange-100 transition-all active:scale-95"
                    >
                      {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
