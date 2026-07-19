import React, { useState, useEffect } from "react";
import { storiesAPI } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import StoryViewer from "./StoryViewer";
import CreateStoryModal from "./CreateStoryModal";
import AvatarImg from "@/components/shared/AvatarImg";

export default function StoriesRow({ currentUser }) {
  const [viewingGroup, setViewingGroup] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [uploadingStory, setUploadingStory] = useState(false);

  // Listen for custom event to open create story modal
  useEffect(() => {
    const handleOpenCreate = () => setShowCreate(true);
    window.addEventListener('open-create-story', handleOpenCreate);
    return () => window.removeEventListener('open-create-story', handleOpenCreate);
  }, []);

  // Story publishing happens in the background after the modal closes, so
  // reflect that as a subtle uploading state on "Your Story" instead of
  // blocking the whole app while the upload completes.
  useEffect(() => {
    const handleStart = () => setUploadingStory(true);
    const handleEnd = () => setUploadingStory(false);
    window.addEventListener('story-upload-start', handleStart);
    window.addEventListener('story-upload-end', handleEnd);
    return () => {
      window.removeEventListener('story-upload-start', handleStart);
      window.removeEventListener('story-upload-end', handleEnd);
    };
  }, []);

  const { data: response } = useQuery({
    queryKey: ["stories"],
    queryFn: () => storiesAPI.list({ is_active: true, sort: "-created_at", limit: 30 }),
    refetchInterval: 60000, // Reduced from 30s to 60s to decrease server load
    staleTime: 30000,
  });

  const rawStories = response?.data || response?.stories || [];

  // Filter to active (within 24h)
  const now = Date.now();
  const stories = rawStories.filter(s => !s.expires_at || new Date(s.expires_at).getTime() > now);

  // Group by author
  const authorMap = {};
  stories.forEach(s => {
    const username = s.author_username?.toLowerCase();
    if (!authorMap[username]) {
      authorMap[username] = {
        username: username,
        name: s.author_name,
        avatar: s.author_avatar,
        stories: []
      };
    }
    authorMap[username].stories.push(s);
  });
  const groups = Object.values(authorMap);

  // Check if current user has a story (case-insensitive comparison)
  const myStory = groups.find(g => g.username === currentUser?.username?.toLowerCase());

  // Helper to change groups
  const playGroup = (index) => {
    if (index >= 0 && index < groups.length) {
      setViewingGroup({ 
        stories: groups[index].stories, 
        startIndex: 0,
        groupIndex: index 
      });
    } else {
      setViewingGroup(null);
    }
  };

  return (
    <>
      <div className="py-3 -mx-4 px-4 overflow-x-auto hide-scrollbar">
        <div className="flex gap-3">
          {/* Add story button / View My Story */}
          <button
            onClick={() => {
              if (myStory) {
                const myIndex = groups.findIndex(g => g.username === currentUser?.username?.toLowerCase());
                playGroup(myIndex);
              } else {
                setShowCreate(true);
              }
            }}
            className="shrink-0 flex flex-col items-center gap-1.5"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center relative overflow-hidden ${uploadingStory ? 'p-0.5 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 shadow-sm animate-pulse' : myStory ? 'p-0.5 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 shadow-sm' : 'bg-orange-50 border-2 border-dashed border-orange-200'}`}>
              <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center relative overflow-hidden">
                {myStory ? (
                  // Show preview of the latest story
                  (() => {
                    const latest = myStory.stories[0];
                    const hasMedia = !!latest.media_url?.trim();
                    const isVideo = latest.media_type === "video";
                    const isText = latest.media_type === "text" || (!hasMedia && !!latest.caption);

                    if (hasMedia) {
                      return isVideo ? (
                        <video src={latest.media_url} className="w-full h-full object-cover rounded-full" muted playsInline />
                      ) : (
                        <img src={latest.media_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover rounded-full" />
                      );
                    }
                    if (isText) {
                      return (
                        <div className="w-full h-full rounded-full flex items-center justify-center p-2" style={{ backgroundColor: latest.bg_color || "#6366f1" }}>
                          <span className="text-white text-[8px] font-bold text-center leading-tight truncate-multiline line-clamp-3">
                            {latest.caption || "Story"}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-sm">
                        {currentUser?.display_name?.[0]?.toUpperCase() || currentUser?.full_name?.[0]?.toUpperCase() || "U"}
                      </div>
                    );
                  })()
                ) : (
                  // Empty state / Add button
                  <AvatarImg
                    src={currentUser?.avatar_url}
                    className="w-full h-full object-cover rounded-full opacity-50"
                    fallback={<Plus className="w-5 h-5 text-orange-400" />}
                  />
                )}
              </div>

              {/* User Avatar Badge (Small overlay) */}
              {myStory && currentUser?.avatar_url && (
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 overflow-hidden shadow-sm">
                  <AvatarImg src={currentUser.avatar_url} className="w-full h-full object-cover" />
                </div>
              )}

              {!myStory && !uploadingStory && (
                <div className="absolute bottom-0 right-0 w-5 h-5 bg-orange-600 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-sm">
                  <Plus className="w-3 h-3 text-white" />
                </div>
              )}

              {uploadingStory && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">{uploadingStory ? "Uploading..." : "Your Story"}</span>
          </button>

          {/* Other stories */}
          {groups.filter(g => g.username !== currentUser?.username?.toLowerCase()).map(group => {
            const latestStory = group.stories[0];
            const hasMedia = !!latestStory.media_url?.trim();
            const isVideo = latestStory.media_type === "video";
            const isText = latestStory.media_type === "text" || (!hasMedia && !!latestStory.caption);

            return (
              <button
                key={group.username}
                onClick={() => {
                  const idx = groups.findIndex(g => g.username === group.username);
                  playGroup(idx);
                }}
                className="shrink-0 flex flex-col items-center gap-1.5"
              >
                <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 shadow-sm relative">
                  <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center relative overflow-hidden">
                    {hasMedia ? (
                      isVideo ? (
                        <video 
                          src={latestStory.media_url} 
                          className="w-full h-full object-cover rounded-full" 
                          muted
                          playsInline
                        />
                      ) : (
                        <img src={latestStory.media_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover rounded-full" />
                      )
                    ) : isText ? (
                      <div className="w-full h-full rounded-full flex items-center justify-center p-2" style={{ backgroundColor: latestStory.bg_color || "#6366f1" }}>
                        <span className="text-white text-[8px] font-bold text-center leading-tight overflow-hidden break-words line-clamp-3">
                          {latestStory.caption || "Story"}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-orange-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                        {group.name?.[0]?.toUpperCase() || group.username?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                  {/* Small Avatar Overlay for other users */}
                  {(hasMedia || isText) && (group.avatar || latestStory.author_avatar) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 overflow-hidden shadow-sm">
                      <AvatarImg src={group.avatar || latestStory.author_avatar} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-medium max-w-[56px] truncate">
                  {(group.name && !group.name.includes("@")) ? group.name.split(" ")[0] : `@${group.username}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {viewingGroup && (
          <StoryViewer
            stories={viewingGroup.stories}
            startIndex={viewingGroup.startIndex}
            onNext={() => playGroup(viewingGroup.groupIndex + 1)}
            onPrev={() => playGroup(viewingGroup.groupIndex - 1)}
            onClose={() => setViewingGroup(null)}
          />
        )}
        {showCreate && (
          <CreateStoryModal currentUser={currentUser} onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
