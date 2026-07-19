import React, { useState, useRef, useEffect, useCallback, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX, Play, ShoppingBag, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { createPageUrl, getPostVideoIndex, formatCurrency } from "@/lib/utils";
import { postsAPI, bookmarksAPI, productsAPI, affiliateLinksAPI } from "@/api/apiClient";
import { useNativeShare } from "@/hooks/useNativeShare";
import ShareModal from "./ShareModal";
import PostDetailModal from "./PostDetailModal";
import AvatarImg from "./AvatarImg";

function postKey(post) {
  return (post?.id || post?._id)?.toString();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// A single reel: video + its tap/double-tap gestures. Kept isolated so each
// slide manages its own <video> element and play state independently.
//
// Exposes the raw <video> element via ref so the parent can drive seeking
// directly — the scrub bar itself lives in the parent, *outside* the
// swipe-to-navigate drag element. Framer Motion's drag="y" attaches its
// pointerdown listener with a plain addEventListener on that element, which
// fires during native DOM bubbling before React ever gets to run a nested
// onPointerDown handler — so a scrub bar nested in here could never reliably
// stopPropagation() in time and would occasionally hijack the swipe gesture.
const ReelSlide = React.forwardRef(function ReelSlide(
  { post, mediaIndex, isActive, onDoubleTapLike, preload, onTimeUpdate, onDurationChange },
  forwardedRef
) {
  const videoRef = useRef(null);
  useImperativeHandle(forwardedRef, () => videoRef.current, []);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef(null);

  const src = post?.media_urls?.[mediaIndex];
  const poster = post?.thumbnail_urls?.[mediaIndex];

  // Start muted immediately (browsers allow this with no delay), then flip to
  // unmuted right as playback actually begins — unmuting an already-playing
  // video needs no permission check, so this feels instant instead of waiting
  // on the network before unmuted autoplay is allowed to start.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;
    video.muted = true;
    video.play().catch(() => {});
  }, [isActive, src]);

  useEffect(() => {
    if (!isActive) {
      const video = videoRef.current;
      if (video) video.pause();
    }
  }, [isActive]);

  // Swap the poster for the real frame as soon as one is decoded (loadeddata),
  // rather than waiting for playback to actually start (playing) — the video
  // is visible sooner even if it's still buffering ahead in the background.
  const handleLoadedData = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handlePlaying = useCallback(() => {
    setIsLoaded(true);
    const video = videoRef.current;
    if (video && video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) onDurationChange?.(video.duration || 0);
  }, [onDurationChange]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) onTimeUpdate?.(video.currentTime);
  }, [onTimeUpdate]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
      setShowPauseIcon(true);
      setTimeout(() => setShowPauseIcon(false), 500);
    }
  }, []);

  const handleDoubleTap = useCallback(() => {
    onDoubleTapLike?.();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  }, [onDoubleTapLike]);

  const handleTap = useCallback((e) => {
    e.stopPropagation();
    const now = Date.now();
    const delta = now - lastTapRef.current;
    if (delta > 0 && delta < 300) {
      clearTimeout(tapTimerRef.current);
      lastTapRef.current = 0;
      handleDoubleTap();
    } else {
      lastTapRef.current = now;
      tapTimerRef.current = setTimeout(() => togglePlay(), 300);
    }
  }, [handleDoubleTap, togglePlay]);

  useEffect(() => () => clearTimeout(tapTimerRef.current), []);

  if (!src) return null;

  return (
    <div className="absolute inset-0" onClick={handleTap}>
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        className={`w-full h-full object-contain transition-opacity duration-150 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        playsInline
        loop
        muted={isMuted}
        preload={isActive || preload ? "auto" : "none"}
        fetchPriority={isActive ? "high" : "low"}
        onLoadedData={handleLoadedData}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlaying={handlePlaying}
      />

      {!isLoaded && (
        poster ? (
          <img src={poster} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="w-9 h-9 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )
      )}

      {/* Mute toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleMute(); }}
        className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-20 hover:bg-black/60 transition-colors"
      >
        {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>

      <AnimatePresence>
        {showHeart && (
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

      <AnimatePresence>
        {showPauseIcon && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const slideVariants = {
  enter: (dir) => ({ y: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir) => ({ y: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

// Fullscreen, swipeable reels-style player. Swipe up/down (or drag) moves
// between the videos in `queue`, mirroring Instagram/TikTok Reels.
export default function ReelsPlayer({ queue = [], startIndex = 0, startMediaIndex, currentUser, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const clampedStart = Math.min(Math.max(startIndex, 0), Math.max(queue.length - 1, 0));
  const [[activeIndex, direction], setActiveState] = useState([clampedStart, 0]);
  const [interactions, setInteractions] = useState({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  // Scrub timeline state, owned here (not inside ReelSlide) so the bar can be
  // rendered as a sibling of the swipe-drag element instead of nested inside
  // it — see the comment on ReelSlide for why nesting it there is unsafe.
  const activeVideoRef = useRef(null);
  const scrubBarRef = useRef(null);
  const scrubbingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const activePost = queue[activeIndex];
  const activeMediaIndex = activeIndex === clampedStart && startMediaIndex != null
    ? startMediaIndex
    : getPostVideoIndex(activePost);
  const activeId = postKey(activePost);

  // Tagged products link straight to the product page — no credit to anyone.
  // An affiliate link is different: it must carry the affiliate's ref_code
  // through to ProductDetail so the click (and any resulting sale) is
  // attributed to whoever shared it, same as the feed card's "Buy Now".
  const taggedProductIds = activePost?.tagged_products;
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

  const firstAffiliateLinkId = activePost?.affiliate_links?.[0];
  const { data: postAffiliateLink } = useQuery({
    queryKey: ["postAffiliateLink", firstAffiliateLinkId],
    queryFn: () => affiliateLinksAPI.get(firstAffiliateLinkId),
    enabled: !!firstAffiliateLinkId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: affiliateProduct } = useQuery({
    queryKey: ["postAffiliateProduct", postAffiliateLink?.product_id],
    queryFn: async () => {
      const res = await productsAPI.get(postAffiliateLink.product_id);
      return res?.data || res;
    },
    enabled: !!postAffiliateLink?.product_id,
    staleTime: 5 * 60 * 1000,
  });

  // Reset the bar and caption whenever the active reel changes — durations
  // and an expanded caption don't carry over between videos.
  useEffect(() => {
    setDuration(0);
    setCurrentTime(0);
    scrubbingRef.current = false;
    setIsScrubbing(false);
    setCaptionExpanded(false);
  }, [activeId]);

  const seekFromClientX = useCallback((clientX) => {
    const bar = scrubBarRef.current;
    const video = activeVideoRef.current;
    if (!bar || !video || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const time = ratio * duration;
    setCurrentTime(time);
    video.currentTime = time;
  }, [duration]);

  const handleScrubStart = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const video = activeVideoRef.current;
    const bar = scrubBarRef.current;
    if (!video || !bar || !duration) return;
    bar.setPointerCapture?.(e.pointerId);
    wasPlayingRef.current = !video.paused;
    video.pause();
    scrubbingRef.current = true;
    setIsScrubbing(true);
    seekFromClientX(e.clientX);
  }, [duration, seekFromClientX]);

  const handleScrubMove = useCallback((e) => {
    if (!scrubbingRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    seekFromClientX(e.clientX);
  }, [seekFromClientX]);

  const handleScrubEnd = useCallback((e) => {
    if (!scrubbingRef.current) return;
    e.stopPropagation();
    scrubbingRef.current = false;
    setIsScrubbing(false);
    scrubBarRef.current?.releasePointerCapture?.(e.pointerId);
    if (wasPlayingRef.current) activeVideoRef.current?.play().catch(() => {});
  }, []);

  const nativeShare = useNativeShare({ post: activePost, onFallback: () => setIsShareModalOpen(true) });

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowDown") paginate(1);
      else if (e.key === "ArrowUp") paginate(-1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, activeIndex]);

  const paginate = useCallback((dir) => {
    setActiveState(([idx]) => {
      const next = idx + dir;
      if (next < 0 || next >= queue.length) return [idx, 0];
      return [next, dir];
    });
  }, [queue.length]);

  const getInteraction = useCallback((post) => {
    const id = postKey(post);
    return interactions[id] || {
      liked: !!post?.is_liked,
      likesCount: post?.likes_count || 0,
      isBookmarked: false,
    };
  }, [interactions]);

  const syncListCaches = (postId, patch) => {
    const updateInCache = (queryKey) => {
      queryClient.setQueriesData({ queryKey }, (old) => {
        if (!old) return old;
        const apply = (p) => (postKey(p) === postId ? { ...p, ...patch } : p);
        if (old.pages) return { ...old, pages: old.pages.map((page) => ({ ...page, data: page.data?.map(apply) })) };
        if (Array.isArray(old)) return old.map(apply);
        return old;
      });
    };
    ["posts", "communityPosts", "userPosts", "likedPosts", "userLikes"].forEach(updateInCache);
  };

  const likeMutation = useMutation({
    mutationFn: ({ postId, wasLiked }) => (wasLiked ? postsAPI.unlike(postId) : postsAPI.like(postId)),
    onSuccess: (data, { postId }) => {
      const patch = { likes_count: data?.likes_count, is_liked: data?.is_liked };
      setInteractions((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          liked: data?.is_liked ?? prev[postId]?.liked,
          likesCount: data?.likes_count ?? prev[postId]?.likesCount,
        },
      }));
      syncListCaches(postId, patch);
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: ({ postId, wasBookmarked }) => (
      wasBookmarked ? bookmarksAPI.remove("post", postId) : bookmarksAPI.add({ target_type: "post", target_id: postId })
    ),
  });

  const toggleLike = useCallback((post) => {
    if (!currentUser || likeMutation.isPending) return;
    const id = postKey(post);
    const current = getInteraction(post);
    setInteractions((prev) => ({
      ...prev,
      [id]: {
        ...current,
        liked: !current.liked,
        likesCount: current.liked ? Math.max(0, current.likesCount - 1) : current.likesCount + 1,
      },
    }));
    likeMutation.mutate({ postId: id, wasLiked: current.liked });
  }, [currentUser, getInteraction, likeMutation]);

  const toggleBookmark = useCallback((post) => {
    if (!currentUser) return;
    const id = postKey(post);
    const current = getInteraction(post);
    setInteractions((prev) => ({ ...prev, [id]: { ...current, isBookmarked: !current.isBookmarked } }));
    bookmarkMutation.mutate({ postId: id, wasBookmarked: current.isBookmarked });
    toast.success(current.isBookmarked ? "Removed from saved" : "Post saved!");
  }, [currentUser, getInteraction, bookmarkMutation]);

  if (!activePost) return null;

  const activeInteraction = getInteraction(activePost);

  // Portaled straight to <body>: a framer-motion ancestor further up the tree
  // (the post card that was tapped) applies a CSS transform while animating,
  // which turns it into the containing block for any `position: fixed`
  // descendant — without this, the fullscreen player ends up pinned to that
  // card's box instead of the viewport, leaving a gap and mis-stacking the
  // comments dialog underneath it.
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none"
      style={{ overscrollBehavior: "none", WebkitTapHighlightColor: "transparent" }}
    >
      <div className="relative w-full h-full max-w-md mx-auto overflow-hidden bg-black">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={activeId || activeIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: "easeOut" }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.5}
            onDragEnd={(e, info) => {
              if (info.offset.y < -70) paginate(1);
              else if (info.offset.y > 70) paginate(-1);
            }}
            className="absolute inset-0"
          >
            <ReelSlide
              ref={activeVideoRef}
              post={activePost}
              mediaIndex={activeMediaIndex}
              isActive={!isDetailModalOpen && !isShareModalOpen}
              onDoubleTapLike={() => !activeInteraction.liked && toggleLike(activePost)}
              onDurationChange={setDuration}
              onTimeUpdate={(t) => { if (!scrubbingRef.current) setCurrentTime(t); }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Hidden preloaders for the neighboring reels so swiping feels instant.
            The very next/prev reel is warmed fully (auto); one further out only
            fetches metadata + a small head start, so a fast swipe still has a
            connection primed without spending bandwidth on reels not yet close. */}
        {queue[activeIndex + 1] && (
          <video
            key={`preload-next-${postKey(queue[activeIndex + 1])}`}
            src={queue[activeIndex + 1].media_urls?.[getPostVideoIndex(queue[activeIndex + 1])]}
            preload="auto"
            fetchPriority="high"
            muted
            playsInline
            className="hidden"
          />
        )}
        {queue[activeIndex + 2] && (
          <video
            key={`preload-next2-${postKey(queue[activeIndex + 2])}`}
            src={queue[activeIndex + 2].media_urls?.[getPostVideoIndex(queue[activeIndex + 2])]}
            preload="metadata"
            fetchPriority="low"
            muted
            playsInline
            className="hidden"
          />
        )}
        {queue[activeIndex - 1] && (
          <video
            key={`preload-prev-${postKey(queue[activeIndex - 1])}`}
            src={queue[activeIndex - 1].media_urls?.[getPostVideoIndex(queue[activeIndex - 1])]}
            preload="auto"
            fetchPriority="low"
            muted
            playsInline
            className="hidden"
          />
        )}

        {/* Scrub timeline — a sibling of the drag="y" slide, not nested in it,
            so dragging it can never be mistaken for the swipe-between-reels
            gesture (see the note on ReelSlide). Pointer capture keeps the
            drag tracking the finger/cursor even if it strays off the thin
            bar, and touch-action:none plus preventDefault stop the browser
            from turning the same gesture into a page scroll on mobile. */}
        {duration > 0 && (
          <div className="absolute left-0 right-16 bottom-0 z-30 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-3">
            <div
              ref={scrubBarRef}
              className="relative w-full h-8 flex items-center select-none"
              style={{
                touchAction: "none",
                WebkitTapHighlightColor: "transparent",
                WebkitUserSelect: "none",
                cursor: isScrubbing ? "grabbing" : "pointer",
              }}
              onPointerDown={handleScrubStart}
              onPointerMove={handleScrubMove}
              onPointerUp={handleScrubEnd}
              onPointerCancel={handleScrubEnd}
            >
              {isScrubbing && (
                <div
                  className="absolute bottom-8 -translate-x-1/2 px-2 py-1 rounded-md bg-black/80 text-white text-xs font-semibold pointer-events-none whitespace-nowrap"
                  style={{ left: `${Math.min((currentTime / duration) * 100, 100)}%` }}
                >
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              )}
              <div className="relative w-full h-1 rounded-full bg-white/25 overflow-visible">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${Math.min((currentTime / duration) * 100, 100)}%` }}
                />
                <div
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow transition-[width,height] ${isScrubbing ? "w-4 h-4" : "w-3 h-3"}`}
                  style={{ left: `${Math.min((currentTime / duration) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 pt-[max(1rem,env(safe-area-inset-top))] px-4 pb-3 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent z-30 pointer-events-none">
          <button
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center pointer-events-auto"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Bottom overlay: author + caption. Bottom padding is pushed down
            further than the text itself needs so the caption never sits
            under the scrub bar (which is a sibling with a higher z-index,
            positioned at the very bottom edge) — see the scrub bar block
            above. */}
        <div className="absolute bottom-0 left-0 right-0 pb-[max(3.5rem,calc(env(safe-area-inset-bottom)+3rem))] pt-16 px-4 pr-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20 pointer-events-none">
          <Link
            to={createPageUrl("Profile") + `?username=${activePost.author_username}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 mb-2 pointer-events-auto w-fit"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/70 bg-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
              <AvatarImg
                src={activePost.author_avatar}
                className="w-full h-full object-cover"
                fallback={activePost.author_name?.[0]?.toUpperCase() || "U"}
              />
            </div>
            <span className="text-white text-sm font-bold [text-shadow:0_1px_3px_rgb(0_0_0_/_0.8)]">@{activePost.author_username}</span>
          </Link>

          {/* Tagged products — plain links to the product page, no credit to anyone */}
          {taggedProducts?.length > 0 && (
            <div className="flex items-center gap-2 mb-2 overflow-x-auto pointer-events-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {taggedProducts.map((p) => (
                <Link
                  key={p.id || p._id}
                  to={createPageUrl("ProductDetail") + `?id=${p.id || p._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 shrink-0 pl-1 pr-3 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 text-white text-xs font-semibold"
                >
                  <span className="w-6 h-6 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-3 h-3" />
                    )}
                  </span>
                  <span className="truncate max-w-[110px]">{p.title}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Affiliate link — must keep ref_code in the URL so the click (and
              any resulting sale) is credited to whoever shared it, unlike the
              plain tagged-product links above. */}
          {postAffiliateLink && (
            <Link
              to={createPageUrl("ProductDetail") + `?id=${postAffiliateLink.product_id}&ref=${postAffiliateLink.ref_code}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2.5 mb-2 pointer-events-auto pl-1.5 pr-2.5 py-1.5 rounded-2xl bg-purple-600/40 backdrop-blur-md border border-purple-300/30 w-fit max-w-full"
            >
              <span className="w-8 h-8 rounded-xl overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
                {affiliateProduct?.images?.[0] ? (
                  <img src={affiliateProduct.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Link2 className="w-3.5 h-3.5 text-white" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-white text-xs font-semibold truncate max-w-[140px]">
                  {affiliateProduct?.title || postAffiliateLink.product_title || "Shop this product"}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-purple-200 text-xs font-bold">
                    {formatCurrency(affiliateProduct?.price ?? postAffiliateLink.product_price ?? 0)}
                  </span>
                  {affiliateProduct?.compare_at_price > (affiliateProduct?.price ?? 0) && (
                    <span className="text-white/50 text-[10px] line-through">{formatCurrency(affiliateProduct.compare_at_price)}</span>
                  )}
                </span>
              </span>
              <span className="ml-1 shrink-0 px-2.5 py-1 rounded-full bg-white text-purple-700 text-[10px] font-bold">
                {t("common.buyNow")}
              </span>
            </Link>
          )}

          {activePost.content && (
            <div className="pointer-events-auto max-h-[40vh] overflow-y-auto">
              <p className={`text-white text-sm leading-snug whitespace-pre-wrap [text-shadow:0_1px_3px_rgb(0_0_0_/_0.8)] ${captionExpanded ? "" : "line-clamp-2"}`}>
                {activePost.content}
              </p>
              {activePost.content.length > 90 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setCaptionExpanded((v) => !v); }}
                  className="mt-1 text-white/80 text-xs font-bold hover:text-white transition-colors"
                >
                  {captionExpanded ? (t("common.seeLess") || "Minimize") : (t("common.seeMore") || "View more")}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right action bar */}
        <div className="absolute right-3 bottom-[max(6rem,calc(env(safe-area-inset-bottom)+6rem))] flex flex-col items-center gap-5 z-30">
          <button
            onClick={(e) => { e.stopPropagation(); toggleLike(activePost); }}
            className="flex flex-col items-center gap-1"
          >
            <div className={`w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center transition-transform ${activeInteraction.liked ? "scale-110" : ""}`}>
              <Heart className={`w-6 h-6 ${activeInteraction.liked ? "fill-red-500 text-red-500" : "text-white"}`} />
            </div>
            <span className="text-white text-[11px] font-semibold drop-shadow">{activeInteraction.likesCount > 0 ? activeInteraction.likesCount.toLocaleString() : ""}</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setIsDetailModalOpen(true); }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-[11px] font-semibold drop-shadow">{activePost.comments_count > 0 ? activePost.comments_count.toLocaleString() : ""}</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); currentUser && nativeShare(); }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
              <Share2 className="w-6 h-6 text-white" />
            </div>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); toggleBookmark(activePost); }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
              <Bookmark className={`w-6 h-6 ${activeInteraction.isBookmarked ? "fill-white text-white" : "text-white"}`} />
            </div>
          </button>
        </div>
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        post={activePost}
        currentUser={currentUser}
        contentClassName="z-[110]"
      />
      <PostDetailModal
        isOpen={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        post={activePost}
        currentUser={currentUser}
        contentClassName="z-[110]"
      />
    </motion.div>,
    document.body
  );
}
