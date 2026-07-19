import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPageUrl, getPostVideoIndex } from "@/lib/utils";
import { postsAPI, bookmarksAPI } from "@/api/apiClient";
import { useNativeShare } from "@/hooks/useNativeShare";
import ShareModal from "./ShareModal";
import PostDetailModal from "./PostDetailModal";

function postKey(post) {
  return (post?.id || post?._id)?.toString();
}

// A single reel: video + its tap/double-tap gestures. Kept isolated so each
// slide manages its own <video> element and play state independently.
function ReelSlide({ post, mediaIndex, isActive, onDoubleTapLike, preload }) {
  const videoRef = useRef(null);
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

  const handlePlaying = useCallback(() => {
    setIsLoaded(true);
    const video = videoRef.current;
    if (video && video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, []);

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
        className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-10 hover:bg-black/60 transition-colors"
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
}

const slideVariants = {
  enter: (dir) => ({ y: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir) => ({ y: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

// Fullscreen, swipeable reels-style player. Swipe up/down (or drag) moves
// between the videos in `queue`, mirroring Instagram/TikTok Reels.
export default function ReelsPlayer({ queue = [], startIndex = 0, startMediaIndex, currentUser, onClose }) {
  const queryClient = useQueryClient();
  const clampedStart = Math.min(Math.max(startIndex, 0), Math.max(queue.length - 1, 0));
  const [[activeIndex, direction], setActiveState] = useState([clampedStart, 0]);
  const [interactions, setInteractions] = useState({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const activePost = queue[activeIndex];
  const activeMediaIndex = activeIndex === clampedStart && startMediaIndex != null
    ? startMediaIndex
    : getPostVideoIndex(activePost);
  const activeId = postKey(activePost);

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
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
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
              post={activePost}
              mediaIndex={activeMediaIndex}
              isActive={!isDetailModalOpen && !isShareModalOpen}
              onDoubleTapLike={() => !activeInteraction.liked && toggleLike(activePost)}
            />
          </motion.div>
        </AnimatePresence>

        {/* Hidden preloaders for the neighboring reels so swiping feels instant */}
        {queue[activeIndex + 1] && (
          <video
            key={`preload-next-${postKey(queue[activeIndex + 1])}`}
            src={queue[activeIndex + 1].media_urls?.[getPostVideoIndex(queue[activeIndex + 1])]}
            preload="auto"
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
            muted
            playsInline
            className="hidden"
          />
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

        {/* Bottom overlay: author + caption */}
        <div className="absolute bottom-0 left-0 right-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16 px-4 pr-20 bg-gradient-to-t from-black/70 to-transparent z-20 pointer-events-none">
          <Link
            to={createPageUrl("Profile") + `?username=${activePost.author_username}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 mb-2 pointer-events-auto w-fit"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/70 bg-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {activePost.author_avatar ? (
                <img src={activePost.author_avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                activePost.author_name?.[0]?.toUpperCase() || "U"
              )}
            </div>
            <span className="text-white text-sm font-bold drop-shadow">@{activePost.author_username}</span>
          </Link>
          {activePost.content && (
            <p className="text-white text-sm leading-snug line-clamp-2 drop-shadow">{activePost.content}</p>
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
