import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Send, Volume2, VolumeX, BarChart3, Trash2, Video } from "lucide-react";
import { storiesAPI } from "@/api/apiClient";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { authAPI } from "@/api/apiClient";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

export default function StoryViewer({ stories = [], startIndex = 0, onClose, onNext, onPrev, guestMode = false }) {
  const [current, setCurrent] = useState(startIndex >= stories.length ? 0 : startIndex);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // When stories array changes (e.g. next group), reset state
  useEffect(() => {
    setCurrent(startIndex >= stories.length ? 0 : startIndex);
    setReplyText("");
    setIsPaused(false);
    setIsMuted(true);
    setShowAnalytics(false);
  }, [stories, startIndex]);

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authAPI.me(),
    enabled: !guestMode,
  });

  useEffect(() => {
    if (!stories || stories.length === 0) {
      onClose();
    }
  }, [stories, onClose]);

  const story = stories[current];
  const isOwner = currentUser?.username && story?.author_username ? currentUser.username === story.author_username : false;
  const isLoadingUser = !currentUser;

  useEffect(() => {
    if (story?._id || story?.id) {
      storiesAPI.view(story._id || story.id).catch(() => {});
    }
  }, [story?._id, story?.id]);

  // Reset progress and liked status only when the story actually changes
  useEffect(() => {
    setProgress(0);
    setLiked(false);
    setVideoLoaded(false);
  }, [current, story?._id, story?.id]);

  // Handle auto-progress timer
  useEffect(() => {
    const isVideo = story?.media_type === "video" && story?.media_url;
    if (isPaused || !story || isVideo) return;

    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        return p + 1;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [current, isPaused, story]);

  useEffect(() => {
    if (progress < 100) return;

    if (current < stories.length - 1) {
      setCurrent(c => c + 1);
      setProgress(0);
    } else {
      if (onNext) onNext();
      else onClose();
    }
  }, [progress, current, stories.length, onNext, onClose]);

  const handleLike = async () => {
    if (guestMode) { navigate("/register"); return; }
    if (liked) return;
    try {
      setLiked(true);
      await storiesAPI.like(story._id || story.id);
    } catch (error) {
      setLiked(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (guestMode) { navigate("/register"); return; }
    if (!replyText.trim() || isOwner) return;

    try {
      await storiesAPI.reply(story._id || story.id, replyText);
      toast.success("Reply sent!");
      setReplyText("");
      setIsPaused(false);
      inputRef.current?.blur();
    } catch (error) {
      toast.error(error.message || "Failed to send reply");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this story?")) return;

    try {
      await storiesAPI.delete(story._id || story.id);
      toast.success("Story deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["stories"] });
      await queryClient.refetchQueries({ queryKey: ["stories"] });
      onClose();
    } catch (error) {
      toast.error(error.message || "Failed to delete story");
    }
  };

  if (!story) return null;

  const BG_GRADIENTS = {
    "#6366f1": "from-orange-600 to-orange-700",
    "#ec4899": "from-pink-500 to-rose-600",
    "#f59e0b": "from-amber-500 to-orange-600",
    "#10b981": "from-emerald-500 to-teal-600",
    "#3b82f6": "from-orange-500 to-cyan-600",
  };
  const gradClass = BG_GRADIENTS[story.bg_color] || "from-orange-600 to-orange-700";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
    >
      <div className="relative w-full max-w-sm h-full max-h-screen overflow-hidden bg-black shadow-2xl">
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-30">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{ width: i < current ? "100%" : i === current ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-0 right-0 px-4 flex items-center gap-3 z-30">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center relative overflow-hidden ring-2 ring-white/50 shadow-lg">
            {story.author_avatar ? (
              <img src={story.author_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white text-[10px] font-bold">
                {story.author_name?.[0]?.toUpperCase() || story.author_username?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>
          <div>
            <p className="text-white text-sm font-bold drop-shadow-md">{story.author_name || `@${story.author_username}`}</p>
            <p className="text-white/80 text-[10px] drop-shadow-md">{new Date(story.created_at || story.created_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <button onClick={onClose} className="ml-auto w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/40 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Story Content */}
        <div 
          className="w-full h-full relative"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              {(story.media_type === "image" || story.media_type === "video") && story.media_url ? (
                story.media_type === "video" ? (
                  <>
                    {!videoLoaded && (
                      <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradClass}`}>
                        <Video className="w-12 h-12 text-white/70" />
                      </div>
                    )}
                    <video
                    ref={videoRef}
                    src={story.media_url}
                    className={`w-full h-full object-cover transition-opacity duration-200 ${videoLoaded ? "opacity-100" : "opacity-0"}`}
                    autoPlay
                    playsInline
                    muted={isMuted}
                    controls={false}
                    onLoadedData={() => setVideoLoaded(true)}
                    onPlay={() => setIsPaused(false)}
                    onEnded={() => {
                      setProgress(100);
                      if (current < stories.length - 1) {
                        setCurrent(c => c + 1);
                        setProgress(0);
                      } else {
                        if (onNext) onNext();
                        else onClose();
                      }
                    }}
                    />
                  </>
                ) : (
                  <img src={story.media_url} alt="" className="w-full h-full object-cover" />
                )
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradClass} flex items-center justify-center`}>
                  <p className="text-white text-3xl font-extrabold text-center px-8 leading-relaxed drop-shadow-xl">{story.caption || "✨"}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Caption overlay */}
        {story.media_url && story.caption && (
          <div className="absolute bottom-20 left-0 right-0 px-6 z-20 pointer-events-none">
            <p className="text-white text-base font-semibold bg-black/30 rounded-2xl px-4 py-3 backdrop-blur-md border border-white/10 shadow-lg">{story.caption}</p>
          </div>
        )}

        {/* Mute/Unmute button for videos */}
        {story.media_type === "video" && (
          <button
            onClick={() => {
              setIsMuted(!isMuted);
              if (videoRef.current) {
                videoRef.current.muted = !isMuted;
              }
            }}
            className="absolute top-8 right-16 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/40 transition-colors z-30"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </button>
        )}

        {/* Analytics overlay for owner */}
        {showAnalytics && isOwner && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-40 flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Story Analytics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Views</span>
                  <span className="text-2xl font-bold text-orange-600">{story.view_count || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Likes</span>
                  <span className="text-2xl font-bold text-red-500">{story.like_count || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Replies</span>
                  <span className="text-2xl font-bold text-blue-500">{story.reply_count || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Posted</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {new Date(story.created_at || story.created_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="mt-6 space-y-2">
                <button
                  onClick={handleDelete}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Story
                </button>
                <button
                  onClick={() => setShowAnalytics(false)}
                  className="w-full py-3 bg-gray-200 dark:bg-slate-700 rounded-xl text-gray-900 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-0 right-0 px-4 flex items-center gap-3 z-30">
          {(guestMode || (!isOwner && !isLoadingUser)) ? (
            <form onSubmit={handleReply} className="flex-1 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => { if (guestMode) { navigate("/register"); } else setIsPaused(true); }}
                onBlur={() => setIsPaused(false)}
                placeholder={guestMode ? "Sign in to reply..." : "Send message..."}
                className="flex-1 bg-black/40 hover:bg-black/60 focus:bg-black/70 backdrop-blur-xl border border-white/20 rounded-full h-12 px-5 text-white text-sm outline-none transition-all placeholder:text-white/40 shadow-inner"
              />
              {replyText.trim() && (
                <button type="submit" className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                  <Send className="w-5 h-5 text-white" />
                </button>
              )}
            </form>
          ) : isOwner ? (
            <div className="flex-1 flex items-center gap-2">
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="flex-1 flex items-center justify-center py-3 bg-blue-600/80 hover:bg-blue-600 backdrop-blur-md rounded-full border border-white/10 transition-colors"
              >
                <BarChart3 className="w-4 h-4 text-white mr-2" />
                <p className="text-white text-xs font-medium">{showAnalytics ? 'Hide Analytics' : 'View Analytics'}</p>
              </button>
              <button
                onClick={() => {
                  onClose();
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('open-create-story'));
                  }, 100);
                }}
                className="flex-1 flex items-center justify-center py-3 bg-orange-600/80 hover:bg-orange-600 backdrop-blur-md rounded-full border border-white/10 transition-colors"
              >
                <p className="text-white text-xs font-medium">+ Add New Story</p>
              </button>
            </div>
          ) : (
            <div className="flex-1 h-12" />
          )}
          {(guestMode || (!isOwner && !isLoadingUser)) && !replyText.trim() && (
            <button 
              onClick={handleLike} 
              className={`w-12 h-12 rounded-full backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all ${liked ? 'bg-red-500/20 border-red-500/50 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-black/40 hover:bg-black/60 active:scale-90'}`}
            >
              <Heart className={`w-6 h-6 ${liked ? "fill-red-500 text-red-500 animate-bounce" : "text-white"}`} />
            </button>
          )}
        </div>

        {/* Nav zones */}
        {!isPaused && (
          <>
            <button
              onClick={() => {
                if (current > 0) {
                  setCurrent(c => c - 1);
                } else if (onPrev) {
                  onPrev();
                } else {
                  setProgress(0);
                  setLiked(false);
                }
              }}
              className="absolute left-0 top-20 w-1/4 h-3/4 z-20 opacity-0 cursor-default"
            />
            <button
              onClick={() => {
                if (current < stories.length - 1) {
                  setCurrent(c => c + 1);
                } else if (onNext) {
                  onNext();
                } else {
                  onClose(); // Close if it's the last story
                }
              }}
              className="absolute right-0 top-20 w-1/4 h-3/4 z-20 opacity-0 cursor-default"
            />
          </>
        )}
      </div>
    </motion.div>
  );
}
