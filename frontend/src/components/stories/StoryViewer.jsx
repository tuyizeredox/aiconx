import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Send, Volume2, VolumeX, BarChart3, Trash2, Video } from "lucide-react";
import { storiesAPI } from "@/api/apiClient";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { authAPI } from "@/api/apiClient";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import AvatarImg from "@/components/shared/AvatarImg";

export default function StoryViewer({ stories = [], startIndex = 0, onClose, onNext, onPrev, guestMode = false }) {
  const [current, setCurrent] = useState(startIndex >= stories.length ? 0 : startIndex);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Own copy of the group: the parent hands the array down as a snapshot taken
  // when the viewer opened, so removing a story has to happen here too.
  const [items, setItems] = useState(stories);
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // When stories array changes (e.g. next group), reset state
  useEffect(() => {
    setItems(stories);
    setCurrent(startIndex >= stories.length ? 0 : startIndex);
    setReplyText("");
    setIsPaused(false);
    setIsMuted(true);
    setShowAnalytics(false);
    setConfirmDelete(null);
  }, [stories, startIndex]);

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authAPI.me(),
    enabled: !guestMode,
  });

  useEffect(() => {
    if (!items || items.length === 0) {
      onClose();
    }
  }, [items, onClose]);

  const story = items[current];
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
    // A panel over the story counts as paused - otherwise it advances behind
    // the overlay and the confirm ends up aimed at a different story.
    if (isPaused || confirmDelete || showAnalytics || !story || isVideo) return;

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
  }, [current, isPaused, confirmDelete, showAnalytics, story]);

  useEffect(() => {
    if (progress < 100) return;

    if (current < items.length - 1) {
      setCurrent(c => c + 1);
      setProgress(0);
    } else {
      if (onNext) onNext();
      else onClose();
    }
  }, [progress, current, items.length, onNext, onClose]);

  // Hold video playback behind an open panel so the story does not run on
  // under it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (confirmDelete || showAnalytics) video.pause();
    else video.play().catch(() => {});
  }, [confirmDelete, showAnalytics]);

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

  const openDeleteConfirm = () => {
    if (!story) return;
    setShowAnalytics(false);
    setIsPaused(true);
    setConfirmDelete(story);
  };

  const closeDeleteConfirm = () => {
    setConfirmDelete(null);
    setIsPaused(false);
  };

  const handleDelete = async () => {
    if (isDeleting || !confirmDelete) return;
    const deletedId = confirmDelete._id || confirmDelete.id;

    setIsDeleting(true);
    try {
      await storiesAPI.delete(deletedId);

      // Drop it locally, then land on whatever is still there: the story after
      // it, or the one before it when the deleted story was last in the group.
      const remaining = items.filter((s) => (s._id || s.id) !== deletedId);
      setItems(remaining);
      setCurrent((c) => Math.min(c, Math.max(0, remaining.length - 1)));
      setProgress(0);
      setConfirmDelete(null);
      setIsPaused(false);

      toast.success("Story deleted");
      queryClient.invalidateQueries({ queryKey: ["stories"] });

      if (remaining.length === 0) onClose();
    } catch (error) {
      toast.error(error.message || "Failed to delete story");
    } finally {
      setIsDeleting(false);
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
          {items.map((_, i) => (
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
            <AvatarImg
              src={story.author_avatar}
              className="w-full h-full object-cover"
              fallback={
                <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {story.author_name?.[0]?.toUpperCase() || story.author_username?.[0]?.toUpperCase() || "U"}
                </div>
              }
            />
          </div>
          <div>
            <p className="text-white text-sm font-bold drop-shadow-md">{story.author_name || `@${story.author_username}`}</p>
            <p className="text-white/80 text-[10px] drop-shadow-md">{new Date(story.created_at || story.created_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isOwner && !guestMode && (
              <button
                onClick={openDeleteConfirm}
                aria-label="Delete story"
                title="Delete story"
                className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-red-500/70 transition-colors"
              >
                <Trash2 className="w-[18px] h-[18px] text-white" />
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/40 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
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
                      if (current < items.length - 1) {
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
            <div className="bg-white dark:bg-ink-800 rounded-2xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Story Analytics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-ink-400">Views</span>
                  <span className="text-2xl font-bold text-orange-600">{story.views_count || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-ink-400">Likes</span>
                  <span className="text-2xl font-bold text-red-500">{story.likes_count || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-ink-400">Replies</span>
                  <span className="text-2xl font-bold text-blue-500">{story.reply_count || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-ink-400">Posted</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {new Date(story.created_at || story.created_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="mt-6 space-y-2">
                <button
                  onClick={openDeleteConfirm}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Story
                </button>
                <button
                  onClick={() => setShowAnalytics(false)}
                  className="w-full py-3 bg-gray-200 dark:bg-ink-700 rounded-xl text-gray-900 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-ink-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {confirmDelete && isOwner && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-ink-800 p-5 shadow-2xl"
            >
              <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-500/15 flex items-center justify-center mb-3">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete this story?</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-ink-400">
                It disappears for everyone right away, along with its views and replies. This can't be undone.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-semibold transition-colors"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  onClick={closeDeleteConfirm}
                  disabled={isDeleting}
                  className="w-full py-3 rounded-xl bg-slate-100 dark:bg-ink-700 hover:bg-slate-200 dark:hover:bg-ink-600 disabled:opacity-60 text-slate-900 dark:text-white font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
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
                if (current < items.length - 1) {
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
