// Remove unused imports
import React, { useState, useEffect, memo } from "react";
import { useTranslation } from "react-i18next";
import { postsAPI, bookmarksAPI, followsAPI, affiliateLinksAPI, productsAPI } from "@/api/apiClient";
import { Heart, MessageCircle, Share2, ShoppingBag, MoreHorizontal, Bookmark, ChevronLeft, ChevronRight, Edit, Trash2, Link2, UserPlus, UserMinus, Flag, Copy, Repeat2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl, isVideoUrl, isVideoPost, formatCurrency } from "@/lib/utils";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import ShareModal from "./ShareModal";
import ReportModal from "./ReportModal";
import PostDetailModal from "./PostDetailModal";
import PostContent from "./PostContent";
import FeedVideoPlayer from "./FeedVideoPlayer";
import ReelsPlayer from "./ReelsPlayer";
import AvatarImg from "./AvatarImg";
import { useNativeShare } from "@/hooks/useNativeShare";
import { formatDistanceToNow } from "date-fns";
import useEmblaCarousel from 'embla-carousel-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PostCard = memo(function PostCard({ post, currentUser, fullView = false, feedPosts }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // A repost wraps another post: interactions (like/comment/share/bookmark)
  // and the header/media/tags shown all act on the original content, with a
  // small "Reposted by X" banner layered on top.
  const isRepost = !!post?.repost_of;
  const displayPost = isRepost && post?.original_post ? post.original_post : post;

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [reelsIndex, setReelsIndex] = useState(null);
  const nativeShare = useNativeShare({ post: displayPost, onFallback: () => setIsShareModalOpen(true) });
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });

  const postId = (displayPost?.id || displayPost?._id)?.toString();
  const authorUsername = displayPost?.author_username;
  const isLiked = !!displayPost?.is_liked;
  const isOwner = currentUser?.username === authorUsername;
  const [optimisticLiked, setOptimisticLiked] = useState(isLiked);
  const [optimisticCount, setOptimisticCount] = useState(displayPost?.likes_count || 0);
  const isReposted = !!displayPost?.is_reposted;
  const [optimisticReposted, setOptimisticReposted] = useState(isReposted);
  const [optimisticRepostsCount, setOptimisticRepostsCount] = useState(displayPost?.reposts_count || 0);
  const isRepostOwner = isRepost && currentUser?.username === post?.author_username;

  // Follow status check
  const { data: followStatus } = useQuery({
    queryKey: ["followStatus", currentUser?.username, authorUsername],
    queryFn: () => followsAPI.check({
      follower_username: currentUser?.username,
      following_username: authorUsername
    }),
    enabled: !!currentUser?.username && !!authorUsername && !isOwner,
  });

  const isFollowing = followStatus?.is_following || false;

  const firstAffiliateLinkId = displayPost?.affiliate_links?.[0];
  const { data: postAffiliateLink } = useQuery({
    queryKey: ["postAffiliateLink", firstAffiliateLinkId],
    queryFn: () => affiliateLinksAPI.get(firstAffiliateLinkId),
    enabled: !!firstAffiliateLinkId,
    staleTime: 5 * 60 * 1000,
  });

  // The affiliate link only caches a title/price snapshot from when it was
  // created — pull the live product so the embed can show a real image and
  // current price instead of a bare text link.
  const { data: affiliateProduct } = useQuery({
    queryKey: ["postAffiliateProduct", postAffiliateLink?.product_id],
    queryFn: async () => {
      const res = await productsAPI.get(postAffiliateLink.product_id);
      return res?.data || res;
    },
    enabled: !!postAffiliateLink?.product_id,
    staleTime: 5 * 60 * 1000,
  });

  const taggedProductIds = displayPost?.tagged_products;
  const { data: taggedProducts } = useQuery({
    queryKey: ["postTaggedProducts", taggedProductIds],
    queryFn: async () => {
      const results = await Promise.all((taggedProductIds || []).map(async (id) => {
        try {
          const res = await productsAPI.get(id);
          return res?.data || res;
        } catch {
          return null;
        }
      }));
      return results.filter(Boolean);
    },
    enabled: !!taggedProductIds?.length,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setOptimisticLiked(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setOptimisticCount(displayPost?.likes_count || 0);
  }, [displayPost?.likes_count]);

  useEffect(() => {
    setOptimisticReposted(isReposted);
  }, [isReposted]);

  useEffect(() => {
    setOptimisticRepostsCount(displayPost?.reposts_count || 0);
  }, [displayPost?.reposts_count]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();
  }, [emblaApi]);

  // Follow state - lazy loaded only when needed (profile page optimization)
  const [showFollowButton, setShowFollowButton] = useState(false);

  const likeMutation = useMutation({
    mutationFn: async (wasLiked) => {
      if (wasLiked) {
        return await postsAPI.unlike(postId);
      } else {
        return await postsAPI.like(postId);
      }
    },
    onMutate: (wasLiked) => {
      setOptimisticLiked(!wasLiked);
      setOptimisticCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);
    },
    onSuccess: (data) => {
      if (data && data.likes_count !== undefined) {
        setOptimisticCount(data.likes_count);
      }
      if (data && data.is_liked !== undefined) {
        setOptimisticLiked(data.is_liked);
      }
      const updatePostInCache = (queryKey) => {
        queryClient.setQueriesData({ queryKey }, (old) => {
          if (!old) return old;
          if (old.pages) {
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: page.data?.map((p) =>
                  (p.id || p._id)?.toString() === postId
                    ? { ...p, likes_count: data?.likes_count ?? p.likes_count, is_liked: data?.is_liked ?? p.is_liked }
                    : p
                ),
              })),
            };
          }
          if (Array.isArray(old)) {
            return old.map((p) =>
              (p.id || p._id)?.toString() === postId
                ? { ...p, likes_count: data?.likes_count ?? p.likes_count, is_liked: data?.is_liked ?? p.is_liked }
                : p
            );
          }
          return old;
        });
      };
      updatePostInCache(["posts"]);
      updatePostInCache(["communityPosts"]);
      updatePostInCache(["userPosts"]);
      updatePostInCache(["likedPosts"]);
      updatePostInCache(["userLikes"]);
      queryClient.setQueryData(["postDetail", postId, currentUser?.username], (old) =>
        old ? { ...old, likes_count: data?.likes_count ?? old.likes_count, is_liked: data?.is_liked ?? old.is_liked } : old
      );
    },
    onError: (error) => {
      if (error?.status === 409) {
        // A concurrent request already registered this like server-side;
        // resync from the server instead of reverting the optimistic state.
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        return;
      }
      if (error.status === 404) {
        toast.error("This post is no longer available");
        queryClient.invalidateQueries({ queryKey: ["posts"] });
      } else {
        toast.error("Failed to update like");
      }
      setOptimisticLiked(isLiked);
      setOptimisticCount(displayPost?.likes_count || 0);
    },
  });

  const repostMutation = useMutation({
    mutationFn: async (wasReposted) => {
      if (wasReposted) {
        return await postsAPI.unrepost(postId);
      } else {
        return await postsAPI.repost(postId, {});
      }
    },
    onMutate: (wasReposted) => {
      setOptimisticReposted(!wasReposted);
      setOptimisticRepostsCount((prev) => (wasReposted ? Math.max(0, prev - 1) : prev + 1));
    },
    onSuccess: (data) => {
      if (data?.reposts_count !== undefined) setOptimisticRepostsCount(data.reposts_count);
      if (data?.is_reposted !== undefined) setOptimisticReposted(data.is_reposted);
      toast.success(data?.is_reposted === false ? (t("common.repostRemoved") || "Repost removed") : (t("common.repostedSuccess") || "Reposted to your feed"));
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["userPosts"] });
    },
    onError: (error) => {
      toast.error(error?.message || (t("common.repostFailed") || "Failed to update repost"));
      setOptimisticReposted(isReposted);
      setOptimisticRepostsCount(displayPost?.reposts_count || 0);
    },
  });

  // Bookmark state - only check when needed
  const [isBookmarked, setIsBookmarked] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isBookmarked) {
        await bookmarksAPI.remove("post", postId);
      } else {
        await bookmarksAPI.add({ target_type: "post", target_id: postId });
      }
    },
    onSuccess: () => {
      setIsBookmarked(!isBookmarked);
      toast.success(isBookmarked ? "Removed from saved" : "Post saved!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await postsAPI.delete(postId);
    },
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["userPosts"] });
    },
    onError: () => {
      toast.error("Failed to delete post");
    },
  });

  // Undo just this repost (removes the repost card, leaves the original untouched)
  const removeRepostMutation = useMutation({
    mutationFn: async () => {
      await postsAPI.unrepost(postId);
    },
    onSuccess: () => {
      toast.success(t("common.repostRemoved") || "Repost removed");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["userPosts"] });
    },
    onError: (error) => {
      toast.error(error?.message || (t("common.repostFailed") || "Failed to remove repost"));
    },
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await followsAPI.unfollow({
          follower_username: currentUser.username,
          following_username: authorUsername
        });
      } else {
        await followsAPI.follow(authorUsername, 'user');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followStatus", currentUser?.username, authorUsername] });
      queryClient.invalidateQueries({ queryKey: ["followCounts"] });
      toast.success(isFollowing ? "Unfollowed" : "Following");
    },
    onError: () => {
      toast.error("Failed to update follow status");
    },
  });

  if (!post) return null;

  // Posts with a video, in feed order, so the fullscreen player can swipe
  // between them the way Reels/TikTok do. Falls back to just this post when
  // the caller didn't supply the surrounding feed (e.g. a single-post page).
  // Reposts are resolved to the original post they wrap, matching what's
  // actually rendered (and playable) in each card.
  const resolveDisplayPost = (p) => (p?.repost_of && p?.original_post) ? p.original_post : p;
  const feedDisplayPosts = (Array.isArray(feedPosts) && feedPosts.length > 0 ? feedPosts : [post]).map(resolveDisplayPost);
  const videoQueue = feedDisplayPosts.filter(isVideoPost);
  if (videoQueue.length === 0 && isVideoPost(displayPost)) videoQueue.push(displayPost);

  const triggerLike = () => {
    if (currentUser && !optimisticLiked && !likeMutation.isPending) {
      likeMutation.mutate(optimisticLiked);
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden hover:shadow-lg hover:shadow-slate-100 dark:hover:shadow-slate-950 transition-all duration-300"
      >
        <ShareModal
          isOpen={isShareModalOpen}
          onOpenChange={setIsShareModalOpen}
          post={displayPost}
          currentUser={currentUser}
        />

      {isRepost && (
        <Link
          to={createPageUrl("Profile") + `?username=${post.author_username}`}
          className="flex items-center gap-2 px-4 pt-3 text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
        >
          <Repeat2 className="w-3.5 h-3.5" />
          <span>{t("common.repostedBy", { name: post.author_name || post.author_username }) || `Reposted by ${post.author_name || post.author_username}`}</span>
        </Link>
      )}

      {isRepost && post.content && (
        <div className="px-4 pt-2">
          <PostContent content={post.content} clamp={!fullView} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-4">
        <Link to={createPageUrl("Profile") + `?username=${authorUsername}`} className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-semibold text-sm ring-2 ring-white dark:ring-slate-900 overflow-hidden shadow-sm shrink-0">
            <AvatarImg
              src={displayPost.author_avatar}
              alt={displayPost.author_name}
              className="w-full h-full object-cover"
              fallback={
                <div className="w-full h-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white">
                  {displayPost.author_name?.[0]?.toUpperCase() || "U"}
                </div>
              }
            />
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 hover:text-orange-600 dark:hover:text-orange-400 transition-colors truncate">{displayPost.author_name || "User"}</p>
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">@{authorUsername}</p>
              <span className="text-[10px] text-slate-300 dark:text-slate-600 shrink-0">•</span>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                {formatDistanceToNow(new Date(displayPost.created_at || displayPost.created_date), { addSuffix: true })}
              </p>
              {displayPost.is_sponsored && (
                <span className="ml-1 px-1.5 py-0 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded text-[9px] font-bold uppercase tracking-wider shrink-0">Sponsored</span>
              )}
            </div>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isOwner && currentUser && (
              <DropdownMenuItem
                onClick={() => followMutation.mutate()}
                className="flex items-center gap-2 cursor-pointer"
              >
                {isFollowing ? (
                  <>
                    <UserMinus className="w-4 h-4" />
                    <span>Unfollow</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Follow</span>
                  </>
                )}
              </DropdownMenuItem>
            )}
            {isRepostOwner && (
              <DropdownMenuItem
                onClick={() => removeRepostMutation.mutate()}
                className="flex items-center gap-2 cursor-pointer text-red-600"
              >
                <Repeat2 className="w-4 h-4" />
                <span>{t("common.removeRepost") || "Remove repost"}</span>
              </DropdownMenuItem>
            )}
            {isOwner && (
              <DropdownMenuItem asChild>
                <Link to={createPageUrl("CreatePost") + `?edit=${postId}`} className="flex items-center gap-2 cursor-pointer">
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </Link>
              </DropdownMenuItem>
            )}
            {isOwner && (
              <DropdownMenuItem
                onClick={() => {
                  if (confirm("Are you sure you want to delete this post?")) {
                    deleteMutation.mutate();
                  }
                }}
                className="flex items-center gap-2 cursor-pointer text-red-600"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
            {!isOwner && (
              <DropdownMenuItem
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin + createPageUrl("Home").replace("Home", "") + `post/${postId}`);
                toast.success("Link copied to clipboard");
              }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>Copy link</span>
            </DropdownMenuItem>
            {!isOwner && currentUser && (
              <DropdownMenuItem
                onClick={() => setIsReportModalOpen(true)}
                className="flex items-center gap-2 cursor-pointer text-red-600"
              >
                <Flag className="w-4 h-4" />
                <span>Report</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ReportModal
        isOpen={isReportModalOpen}
        onOpenChange={setIsReportModalOpen}
        targetId={postId}
        targetType="post"
      />

      {/* Content */}
      {displayPost.content && (
        <div className="px-4 py-2">
          <PostContent content={displayPost.content} clamp={!fullView} />
        </div>
      )}

      {/* Media */}
      {displayPost.media_urls?.length > 0 && (
        <div className="mt-2 relative group select-none bg-slate-50 dark:bg-slate-950 overflow-hidden">
          <div
            className="overflow-hidden cursor-pointer"
            ref={emblaRef}
            onClick={() => !fullView && setIsDetailModalOpen(true)}
            onDoubleClick={triggerLike}
          >
            <div className="flex">
              {displayPost.media_urls.map((url, i) => {
                const isVid = displayPost.media_type === "video" || isVideoUrl(url);
                return (
                  <div key={`${url}-${i}`} className="flex-[0_0_100%] min-w-0 relative">
                    {isVid ? (
                      <FeedVideoPlayer
                        src={url}
                        poster={displayPost.thumbnail_urls?.[i]}
                        onDoubleTap={triggerLike}
                        suspended={reelsIndex !== null}
                        onExpand={!fullView ? () => {
                          const queueIndex = videoQueue.findIndex(p => ((p.id || p._id)?.toString()) === postId);
                          setReelsIndex({ queueIndex: queueIndex >= 0 ? queueIndex : 0, mediaIndex: i });
                        } : undefined}
                      />
                    ) : (
                      <img
                        src={url}
                        alt=""
                        className="w-full h-auto max-h-[600px] object-contain"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.target.src = "https://placehold.co/600x600/f8fafc/64748b?text=Image+Not+Found";
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Pagination Indicators */}
          {displayPost.media_urls.length > 1 && (
            <>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10 pointer-events-none">
                {displayPost.media_urls.map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-1.5 h-1.5 rounded-full shadow-sm transition-all duration-300 ${
                      i === selectedIndex ? "bg-white w-3" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>

              {/* Navigation Buttons */}
              {canScrollPrev && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    emblaApi?.scrollPrev();
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-full shadow-md z-20 opacity-0 group-hover:opacity-100 transition-all duration-200"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {canScrollNext && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    emblaApi?.scrollNext();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-full shadow-md z-20 opacity-0 group-hover:opacity-100 transition-all duration-200"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </>
          )}

          {/* Double Tap Heart Animation */}
          <AnimatePresence>
            {showHeartAnimation && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              >
                <Heart className="w-24 h-24 fill-white text-white drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tagged Products */}
      {displayPost.tagged_products?.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          {(taggedProducts?.length > 0 ? taggedProducts : displayPost.tagged_products.map(id => ({ id }))).map((p) => {
            const pid = p.id || p._id;
            return (
              <Link
                key={pid}
                to={createPageUrl("ProductDetail") + `?id=${pid}`}
                className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 overflow-hidden shrink-0 flex items-center justify-center">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-4 h-4" />
                  )}
                </div>
                <span className="flex-1 truncate">{p.title || t("common.viewTaggedProduct") || "View tagged product"}</span>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      {/* Affiliate Links */}
      {displayPost.affiliate_links?.length > 0 && postAffiliateLink && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl">
            <Link
              to={createPageUrl("ProductDetail") + `?id=${postAffiliateLink.product_id}&ref=${postAffiliateLink.ref_code}`}
              className="w-16 h-16 rounded-xl bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-800/60 overflow-hidden shrink-0 shadow-sm flex items-center justify-center"
            >
              {affiliateProduct?.images?.[0] ? (
                <img src={affiliateProduct.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <Link2 className="w-5 h-5 text-purple-400" />
              )}
            </Link>
            <Link
              to={createPageUrl("ProductDetail") + `?id=${postAffiliateLink.product_id}&ref=${postAffiliateLink.ref_code}`}
              className="flex-1 min-w-0"
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {affiliateProduct?.title || postAffiliateLink.product_title || "Shop this product"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(affiliateProduct?.price ?? postAffiliateLink.product_price ?? 0)}
                </span>
                {affiliateProduct?.compare_at_price > (affiliateProduct?.price ?? 0) && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 line-through">
                    {formatCurrency(affiliateProduct.compare_at_price)}
                  </span>
                )}
              </div>
            </Link>
            <Link
              to={createPageUrl("ProductDetail") + `?id=${postAffiliateLink.product_id}&ref=${postAffiliateLink.ref_code}`}
              className="shrink-0 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm shadow-purple-200 dark:shadow-purple-950 transition-colors"
            >
              {t("common.buyNow") || "Buy Now"}
            </Link>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50 dark:border-slate-800/50">
        <div className="flex items-center gap-5">
          <button
            onClick={() => currentUser && !likeMutation.isPending && likeMutation.mutate(optimisticLiked)}
            disabled={likeMutation.isPending}
            title={optimisticCount > 0 ? `${optimisticCount.toLocaleString()} ${t("common.like")}` : t("common.like")}
            aria-label={t("common.like")}
            className="flex items-center outline-none group disabled:opacity-60"
          >
            <motion.div
              whileTap={{ scale: 1.4 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Heart
                className={`w-5 h-5 transition-colors duration-200 ${
                  optimisticLiked ? "fill-red-500 text-red-500" : "text-slate-500 dark:text-slate-400 group-hover:text-red-400"
                }`}
              />
            </motion.div>
          </button>

          <button
            onClick={() => setIsDetailModalOpen(true)}
            title={displayPost.comments_count > 0 ? `${displayPost.comments_count.toLocaleString()} ${t("common.comment")}` : t("common.comment")}
            aria-label={t("common.comment")}
            className="flex items-center outline-none group"
          >
            <MessageCircle className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-orange-500 transition-colors" />
          </button>

          <button
            onClick={() => currentUser && !isOwner && !repostMutation.isPending && repostMutation.mutate(optimisticReposted)}
            disabled={repostMutation.isPending || isOwner}
            title={isOwner ? (t("common.cannotRepostOwn") || "You can't repost your own post") : (optimisticRepostsCount > 0 ? `${optimisticRepostsCount.toLocaleString()} ${t("common.repost") || "Repost"}` : (t("common.repost") || "Repost"))}
            aria-label={t("common.repost") || "Repost"}
            className="flex items-center outline-none group disabled:opacity-40"
          >
            <Repeat2
              className={`w-5 h-5 transition-colors duration-200 ${
                optimisticReposted ? "text-green-500" : "text-slate-500 dark:text-slate-400 group-hover:text-green-500"
              }`}
            />
          </button>

          <button
            onClick={() => currentUser && nativeShare()}
            title={displayPost.shares_count > 0 ? `${displayPost.shares_count.toLocaleString()} ${t("common.share")}` : t("common.share")}
            aria-label={t("common.share")}
            className="flex items-center outline-none group"
          >
            <Share2 className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-orange-500 transition-colors" />
          </button>
        </div>

        <button 
          onClick={() => currentUser && saveMutation.mutate()}
          className={`p-1.5 rounded-full transition-all duration-200 ${
            isBookmarked 
              ? "text-orange-600 bg-orange-50 dark:bg-orange-900/30" 
              : "text-slate-500 dark:text-slate-400 hover:text-orange-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
        </button>
      </div>
      </motion.div>

      <PostDetailModal
        isOpen={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        post={displayPost}
        currentUser={currentUser}
      />

      <AnimatePresence>
        {reelsIndex !== null && (
          <ReelsPlayer
            queue={videoQueue}
            startIndex={reelsIndex.queueIndex}
            startMediaIndex={reelsIndex.mediaIndex}
            currentUser={currentUser}
            onClose={() => setReelsIndex(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
});

export default PostCard;
