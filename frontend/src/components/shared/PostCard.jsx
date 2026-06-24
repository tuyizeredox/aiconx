// Remove unused imports
import React, { useState, useEffect, memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { postsAPI, bookmarksAPI } from "@/api/apiClient";
import { Heart, MessageCircle, Share2, ShoppingBag, MoreHorizontal, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ShareModal from "./ShareModal";
import { formatDistanceToNow } from "date-fns";
import useEmblaCarousel from 'embla-carousel-react';

const PostCard = memo(function PostCard({ post, currentUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const videoRefs = useRef({});

  const postId = (post?.id || post?._id)?.toString();
  const authorUsername = post?.author_username;
  const isLiked = !!post?.is_liked;
  const [optimisticLiked, setOptimisticLiked] = useState(isLiked);
  const [optimisticCount, setOptimisticCount] = useState(post?.likes_count || 0);

  useEffect(() => {
    setOptimisticLiked(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setOptimisticCount(post?.likes_count || 0);
  }, [post?.likes_count]);

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

  // Autoplay video logic - only observe videos that exist
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.6 }
    );

    const videos = Object.values(videoRefs.current).filter(Boolean);
    videos.forEach(video => observer.observe(video));

    return () => {
      videos.forEach(video => observer.unobserve(video));
      observer.disconnect();
    };
  }, [post?.media_urls]);

  // Follow state - lazy loaded only when needed (profile page optimization)
  const [showFollowButton, setShowFollowButton] = useState(false);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (optimisticLiked) {
        return await postsAPI.unlike(postId);
      } else {
        return await postsAPI.like(postId);
      }
    },
    onMutate: () => {
      setOptimisticLiked(!optimisticLiked);
      setOptimisticCount(prev => optimisticLiked ? Math.max(0, prev - 1) : prev + 1);
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
      if (error.status === 404) {
        toast.error("This post is no longer available");
        queryClient.invalidateQueries({ queryKey: ["posts"] });
      } else {
        toast.error("Failed to update like");
      }
      setOptimisticLiked(isLiked);
      setOptimisticCount(post?.likes_count || 0);
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

  if (!post) return null;

  const isVideoUrl = (url) => {
    if (!url) return false;
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".m4v"];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || url.includes("video/upload");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden hover:shadow-lg hover:shadow-slate-100 dark:hover:shadow-slate-950 transition-all duration-300"
    >
      <ShareModal 
        isOpen={isShareModalOpen} 
        onOpenChange={setIsShareModalOpen} 
        post={post} 
        currentUser={currentUser} 
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Link to={createPageUrl("Profile") + `?username=${authorUsername}`} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-semibold text-sm ring-2 ring-white dark:ring-slate-900 overflow-hidden shadow-sm">
            {post.author_avatar ? (
              <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                {post.author_name?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{post.author_name || "User"}</p>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">@{authorUsername}</p>
              <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {formatDistanceToNow(new Date(post.created_at || post.created_date), { addSuffix: true })}
              </p>
              {post.is_sponsored && (
                <span className="ml-1 px-1.5 py-0 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded text-[9px] font-bold uppercase tracking-wider">Sponsored</span>
              )}
            </div>
          </div>
        </Link>
        <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 py-2">
          <p className={`text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap ${!showFullContent && "line-clamp-3"}`}>
            {post.content}
          </p>
          {post.content.length > 150 && (
            <button
              onClick={() => setShowFullContent(!showFullContent)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              {showFullContent ? t("common.seeLess") : t("common.seeMore")}
            </button>
          )}
        </div>
      )}

      {/* Media */}
      {post.media_urls?.length > 0 && (
        <div className="mt-2 relative group select-none bg-slate-50 dark:bg-slate-950 aspect-square overflow-hidden">
          <div 
            className="h-full overflow-hidden cursor-pointer" 
            ref={emblaRef}
            onDoubleClick={() => {
              if (currentUser && !optimisticLiked) {
                likeMutation.mutate();
                setShowHeartAnimation(true);
                setTimeout(() => setShowHeartAnimation(false), 1000);
              }
            }}
          >
            <div className="flex h-full">
              {post.media_urls.map((url, i) => {
                const isVid = post.media_type === "video" || isVideoUrl(url);
                return (
                  <div key={`${url}-${i}`} className="flex-[0_0_100%] min-w-0 relative h-full">
                    {isVid ? (
                      <video 
                        ref={el => videoRefs.current[i] = el}
                        src={url} 
                        className="w-full h-full object-cover" 
                        controls 
                        muted 
                        loop 
                        playsInline 
                      />
                    ) : (
                      <img 
                        src={url} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        loading="lazy"
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
          {post.media_urls.length > 1 && (
            <>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10 pointer-events-none">
                {post.media_urls.map((_, i) => (
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
      {post.tagged_products?.length > 0 && (
        <div className="px-4 py-3">
          <Link
            to={createPageUrl("ProductDetail") + `?id=${post.tagged_products[0]}`}
            className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="flex-1">View tagged product</span>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </Link>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50 dark:border-slate-800/50">
        <div className="flex items-center gap-6">
          <button
            onClick={() => currentUser && likeMutation.mutate()}
            className="flex items-center gap-1.5 group outline-none"
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
            <span className={`text-[13px] font-semibold transition-colors ${optimisticLiked ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}>
              {optimisticCount > 0 ? optimisticCount.toLocaleString() : t("common.like")}
            </span>
          </button>

          <Link to={createPageUrl("PostDetail") + `?id=${postId}`} className="flex items-center gap-1.5 group outline-none">
            <MessageCircle className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 transition-colors">
              {post.comments_count > 0 ? post.comments_count.toLocaleString() : t("common.comment")}
            </span>
          </Link>

          <button 
            onClick={() => currentUser && setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 group outline-none"
          >
            <Share2 className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 transition-colors">
              {post.shares_count > 0 ? post.shares_count.toLocaleString() : t("common.share")}
            </span>
          </button>
        </div>

        <button 
          onClick={() => currentUser && saveMutation.mutate()}
          className={`p-1.5 rounded-full transition-all duration-200 ${
            isBookmarked 
              ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" 
              : "text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
        </button>
      </div>
    </motion.div>
  );
});

export default PostCard;
