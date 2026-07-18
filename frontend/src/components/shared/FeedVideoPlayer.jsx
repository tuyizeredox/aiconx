import React, { useRef, useState, useEffect, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Instagram-feed-style video player: autoplays muted while in view, loops,
// single tap toggles sound, double tap likes (delegated to the caller).
const FeedVideoPlayer = React.forwardRef(function FeedVideoPlayer(
  { src, poster, onDoubleTap, className = "", videoClassName = "" },
  ref
) {
  const internalRef = useRef(null);
  const videoRef = ref || internalRef;
  const containerRef = useRef(null);

  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showMuteHint, setShowMuteHint] = useState(false);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef(null);
  const muteHintTimerRef = useRef(null);

  // Autoplay while sufficiently in view, pause otherwise
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.6 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [videoRef, src]);

  useEffect(() => {
    return () => {
      clearTimeout(tapTimerRef.current);
      clearTimeout(muteHintTimerRef.current);
    };
  }, []);

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
          toggleMute();
        }, 300);
      }
    },
    [onDoubleTap, toggleMute]
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden select-none ${className}`}
      onClick={handleTap}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        className={`w-full h-auto max-h-[600px] object-contain transition-opacity duration-200 ${isLoaded ? "opacity-100" : "opacity-0"} ${videoClassName}`}
        playsInline
        muted
        loop
        preload="metadata"
        onLoadedData={() => setIsLoaded(true)}
      />

      {/* Poster / loading placeholder shown until the first frame is ready */}
      {!isLoaded && (
        poster ? (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900">
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
