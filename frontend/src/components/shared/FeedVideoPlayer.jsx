import React, { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const FeedVideoPlayer = React.forwardRef(function FeedVideoPlayer({ src, onVideoClick }, ref) {
  const internalRef = useRef(null);
  const videoRef = ref || internalRef;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showPlayPulse, setShowPlayPulse] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hideControlsTimer = useRef(null);

  const scheduleHideControls = useCallback(() => {
    clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  }, [isPlaying]);

  useEffect(() => {
    return () => clearTimeout(hideControlsTimer.current);
  }, []);

  const handlePlayPause = useCallback(
    (e) => {
      e.stopPropagation();
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.play().catch(() => {});
        setShowPlayPulse(true);
        setTimeout(() => setShowPlayPulse(false), 600);
      } else {
        video.pause();
        setShowControls(true);
      }
      scheduleHideControls();
    },
    [videoRef, scheduleHideControls]
  );

  const handleMute = useCallback(
    (e) => {
      e.stopPropagation();
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      setIsMuted(video.muted);
    },
    [videoRef]
  );

  const handleProgressClick = useCallback(
    (e) => {
      e.stopPropagation();
      const video = videoRef.current;
      if (!video || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      video.currentTime = ratio * duration;
    },
    [videoRef, duration]
  );

  const handleFullscreen = useCallback(
    (e) => {
      e.stopPropagation();
      const video = videoRef.current;
      if (!video) return;
      if (video.requestFullscreen) video.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    },
    [videoRef]
  );

  const handleContainerClick = useCallback(
    (e) => {
      setShowControls(true);
      scheduleHideControls();
      if (onVideoClick) onVideoClick(e);
    },
    [onVideoClick, scheduleHideControls]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => { setIsPlaying(false); setShowControls(true); };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
    };
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onEnded = () => { setIsPlaying(false); setShowControls(true); setProgress(0); };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoRef]);

  return (
    <div
      className="relative w-full bg-black overflow-hidden select-none"
      style={{ aspectRatio: "16/9" }}
      onClick={handleContainerClick}
      onMouseMove={() => { setShowControls(true); scheduleHideControls(); }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        playsInline
        muted
        preload="metadata"
        loop={false}
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* Play/Pause pulse animation */}
      <AnimatePresence>
        {showPlayPulse && (
          <motion.div
            key="pulse"
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 1.3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center">
              <Play className="w-8 h-8 fill-white text-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            key="controls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col justify-between pointer-events-none"
          >
            {/* Top gradient */}
            <div className="h-16 bg-gradient-to-b from-black/40 to-transparent" />

            {/* Center play/pause button */}
            <div className="flex items-center justify-center pointer-events-auto">
              <button
                onClick={handlePlayPause}
                className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-white text-white" />
                ) : (
                  <Play className="w-7 h-7 fill-white text-white ml-1" />
                )}
              </button>
            </div>

            {/* Bottom controls */}
            <div className="h-20 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end pb-2.5 px-3 gap-1.5 pointer-events-auto">
              {/* Progress bar */}
              <div
                className="w-full h-1 bg-white/30 rounded-full cursor-pointer group/bar relative"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full bg-white rounded-full relative transition-all duration-100"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Time + Mute + Fullscreen */}
              <div className="flex items-center justify-between">
                <span className="text-white text-[11px] font-medium tabular-nums drop-shadow">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMute}
                    className="w-7 h-7 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>
                  <button
                    onClick={handleFullscreen}
                    className="w-7 h-7 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default FeedVideoPlayer;
