import React, { useRef, useState, useEffect, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Fallback aspect ratio used only until the real video metadata loads, so the
// container isn't 0-height (and doesn't collapse the poster) in the meantime.
const DEFAULT_RATIO = 4 / 5;

// How far ahead of the viewport a player does each thing. Mounting the
// <video> only costs a metadata request, so it happens early; pulling actual
// media bytes is expensive, so it waits until the post is nearly on screen —
// but still far enough out that the first frame is decoded and ready before
// the scroll reaches it, which is what makes a feed feel instant.
const MOUNT_MARGIN = "1600px 0px";
const WARM_MARGIN = "700px 0px";

// Playback hysteresis: start once a third of the post is showing, stop only
// once it has mostly left. A single threshold makes videos flicker on and off
// around the boundary while scrolling, which is both ugly and expensive.
const PLAY_AT = 0.35;
const PAUSE_BELOW = 0.2;

// Only one feed video ever plays at a time. Several <video> elements decoding
// at once is the single biggest cause of scroll jank on mid-range Android —
// and two soundtracks at once is wrong anyway. Whoever starts playing evicts
// the previous one; a module-level ref is enough since there is one feed.
let activePlayer = null;

function claimPlayback(video) {
  if (activePlayer && activePlayer !== video) {
    activePlayer.pause();
  }
  activePlayer = video;
}

function releasePlayback(video) {
  if (activePlayer === video) activePlayer = null;
}

// Instagram-feed-style video player: autoplays muted while in view, loops,
// single tap toggles sound, double tap likes (delegated to the caller).
const FeedVideoPlayer = React.forwardRef(function FeedVideoPlayer(
  { src, poster, onDoubleTap, onExpand, suspended = false, className = "", videoClassName = "" },
  ref
) {
  const internalRef = useRef(null);
  const videoRef = ref || internalRef;
  const containerRef = useRef(null);

  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showMuteHint, setShowMuteHint] = useState(false);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  // Lazy-load gate: the <video> gets no src (and issues no network request)
  // until its container is within MOUNT_MARGIN of the viewport, so a feed with
  // many video posts doesn't fire off a request for every one of them the
  // moment the page mounts.
  const [shouldLoad, setShouldLoad] = useState(false);
  // Second gate: buffer the media itself once the post is close enough that
  // the reader is likely to reach it.
  const [shouldWarm, setShouldWarm] = useState(false);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef(null);
  const muteHintTimerRef = useRef(null);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video?.videoWidth && video?.videoHeight) {
      setRatio(video.videoWidth / video.videoHeight);
    }
  }, [videoRef]);

  // Mount and warm gates. Both watch the container, at different distances.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || shouldWarm) return;

    const observers = [];
    const watch = (rootMargin, apply) => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            apply();
            observer.disconnect();
          }
        },
        { rootMargin, threshold: 0 }
      );
      observer.observe(container);
      observers.push(observer);
    };

    if (!shouldLoad) watch(MOUNT_MARGIN, () => setShouldLoad(true));
    watch(WARM_MARGIN, () => { setShouldLoad(true); setShouldWarm(true); });

    return () => observers.forEach((o) => o.disconnect());
  }, [shouldLoad, shouldWarm]);

  // Chromium keeps buffering when `preload` is raised on a live element, so
  // the warm gate can upgrade a player that already fetched its metadata
  // without calling load() and throwing that buffer away.
  useEffect(() => {
    const video = videoRef.current;
    if (video && shouldWarm) video.preload = "auto";
  }, [videoRef, shouldWarm, src]);

  // Autoplay while sufficiently in view, pause otherwise
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || !shouldLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[entries.length - 1].intersectionRatio;
        if (visible >= PLAY_AT && !suspended) {
          claimPlayback(video);
          video.play().catch(() => {});
        } else if (visible < PAUSE_BELOW) {
          video.pause();
          releasePlayback(video);
        }
      },
      { threshold: [0, PAUSE_BELOW, PLAY_AT, 0.6, 0.9] }
    );
    observer.observe(container);
    return () => {
      observer.disconnect();
      releasePlayback(video);
    };
  }, [videoRef, src, shouldLoad, suspended]);

  // The fullscreen reel viewer plays its own (unmuted) copy of a video on top
  // of the feed — without this, this player keeps autoplaying underneath it
  // and, if the user had unmuted it, both would speak over each other.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !suspended) return;
    video.pause();
    releasePlayback(video);
    video.muted = true;
    setIsMuted(true);
  }, [suspended, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      clearTimeout(tapTimerRef.current);
      clearTimeout(muteHintTimerRef.current);
      if (video) releasePlayback(video);
    };
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    setShowMuteHint(true);
    clearTimeout(muteHintTimerRef.current);
    muteHintTimerRef.current = setTimeout(() => setShowMuteHint(false), 650);
  }, [videoRef]);

  // Manual tap/double-tap detection so a single toggle-mute tap never fires twice
  // mid-double-tap, and so we can reliably stop the parent's own click handlers.
  // When onExpand is provided (feed context), a single tap opens the fullscreen
  // reels-style player instead of just toggling mute — the dedicated mute button
  // still handles muting without leaving the feed.
  const handleTap = useCallback(
    (e) => {
      e.stopPropagation();
      const now = Date.now();
      const delta = now - lastTapRef.current;
      if (delta > 0 && delta < 300) {
        clearTimeout(tapTimerRef.current);
        lastTapRef.current = 0;
        onDoubleTap?.(e);
      } else {
        lastTapRef.current = now;
        tapTimerRef.current = setTimeout(() => {
          if (onExpand) {
            onExpand();
          } else {
            toggleMute();
          }
        }, 300);
      }
    },
    [onDoubleTap, onExpand, toggleMute]
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden select-none max-h-[85vh] ${className}`}
      style={{ aspectRatio: ratio }}
      onClick={handleTap}
    >
      {shouldLoad && (
        <video
          ref={videoRef}
          src={src}
          poster={poster || undefined}
          className={`w-full h-full object-contain transition-opacity duration-200 ${isLoaded ? "opacity-100" : "opacity-0"} ${videoClassName}`}
          playsInline
          muted
          loop
          preload={shouldWarm ? "auto" : "metadata"}
          disableRemotePlayback
          onLoadedMetadata={handleLoadedMetadata}
          onLoadedData={() => setIsLoaded(true)}
          onCanPlay={() => setIsLoaded(true)}
        />
      )}

      {/* Poster / loading placeholder shown until the first frame is ready.
          Eager, not lazy: this is the thing the reader actually looks at while
          the video buffers, so deferring it defeats its whole purpose. */}
      {!isLoaded && (
        poster ? (
          <img
            src={poster}
            alt=""
            decoding="async"
            fetchPriority={shouldWarm ? "high" : "auto"}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-ink-800 dark:to-ink-900">
            <div className="w-8 h-8 rounded-full border-2 border-slate-400/40 border-t-slate-500 animate-spin" />
          </div>
        )
      )}

      {/* Mute toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleMute(); }}
        className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-10 hover:bg-black/60 transition-colors"
      >
        {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>

      {/* Brief mute/unmute confirmation */}
      <AnimatePresence>
        {showMuteHint && (
          <motion.div
            key="mute-hint"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default FeedVideoPlayer;
