import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storesAPI, followsAPI, usersAPI } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { UserPlus, Store, UserMinus, User, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function SuggestedUsers({ currentUser }) {
  const queryClient = useQueryClient();
  const [localFollowedUsers, setLocalFollowedUsers] = useState(new Set());

  // Fetch top stores
  const { data: topStoresResponse } = useQuery({
    queryKey: ["suggestedStores"],
    queryFn: () => storesAPI.list({ limit: 3, sort: "-follower_count" }),
    staleTime: 300000,
    enabled: !!currentUser?.username,
  });

  const topStores = (topStoresResponse?.data || [])
    .filter(store => store.owner_username !== currentUser?.username)
    .map(store => ({
      username: store.owner_username,
      display_name: store.name,
      avatar_url: store.logo_url,
      id: store._id || store.id,
      type: 'store'
    }));

  // Fetch suggested users (random users with high follower count)
  const { data: suggestedUsersResponse } = useQuery({
    queryKey: ["suggestedUsers"],
    queryFn: () => usersAPI.getSuggested({ limit: 5 }),
    staleTime: 300000,
    enabled: !!currentUser?.username,
  });

  const suggestedUsers = (suggestedUsersResponse?.users || [])
    .filter(user => user.username !== currentUser?.username)
    .slice(0, 3)
    .map(user => ({
      username: user.username,
      display_name: user.display_name || user.full_name,
      avatar_url: user.avatar_url,
      id: user._id || user.id,
      type: 'user'
    }));

  // Combine all potential suggestions
  const allSuggestions = [...suggestedUsers, ...topStores];

  // Check follow status for all potential suggestions
  const { data: followStatuses } = useQuery({
    queryKey: ["followStatuses", currentUser?.username],
    queryFn: async () => {
      const statuses = {};
      for (const suggestion of allSuggestions) {
        try {
          const status = await followsAPI.check({
            follower_username: currentUser.username,
            following_username: suggestion.username,
            follow_type: suggestion.type
          });
          statuses[suggestion.username] = status.is_following;
        } catch (e) {
          statuses[suggestion.username] = false;
        }
      }
      return statuses;
    },
    enabled: allSuggestions.length > 0 && !!currentUser?.username,
  });

  // Filter out already followed - use useMemo to react to followStatuses changes
  const suggestions = useMemo(() => {
    return allSuggestions.filter(item => {
      const apiSaysFollowing = followStatuses?.[item.username] === true;
      const localSaysFollowing = localFollowedUsers.has(item.username);
      const isFollowing = apiSaysFollowing || localSaysFollowing;
      return !isFollowing;
    }).slice(0, 5);
  }, [allSuggestions, followStatuses, localFollowedUsers]);

  const followMutation = useMutation({
    mutationFn: async ({ username, type, targetId, isFollowing }) => {
      if (isFollowing) {
        return await followsAPI.unfollow({
          follower_username: currentUser.username,
          following_username: username,
          follow_type: type,
          target_id: targetId
        });
      } else {
        return await followsAPI.follow(username, type, targetId);
      }
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["followStatuses", currentUser?.username] });

      // Snapshot previous value
      const previousFollowStatuses = queryClient.getQueryData(["followStatuses", currentUser?.username]);

      // Optimistically update follow status
      queryClient.setQueryData(["followStatuses", currentUser?.username], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          [variables.username]: !variables.isFollowing
        };
      });

      // Update local state for immediate UI update
      setLocalFollowedUsers(prev => {
        const newSet = new Set(prev);
        if (!variables.isFollowing) {
          newSet.add(variables.username);
        } else {
          newSet.delete(variables.username);
        }
        return newSet;
      });

      return { previousFollowStatuses };
    },
    onError: (error, variables, context) => {
      // Revert optimistic update on error
      queryClient.setQueryData(["followStatuses", currentUser?.username], context.previousFollowStatuses);
      setLocalFollowedUsers(prev => {
        const newSet = new Set(prev);
        if (!variables.isFollowing) {
          newSet.delete(variables.username);
        } else {
          newSet.add(variables.username);
        }
        return newSet;
      });
      toast.error(error.message || "Failed to update follow status");
    },
    onSuccess: (_, variables) => {
      toast.success(variables.isFollowing ? "Unfollowed" : `Following ${variables.display_name || variables.username}`);
      queryClient.invalidateQueries({ queryKey: ["followStatus"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedUsers"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedStores"] });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["followStatuses", currentUser?.username] });
    }
  });

  if (suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-white to-orange-50/30 dark:from-slate-800 dark:to-slate-900/50 rounded-2xl border border-orange-100 dark:border-slate-700 overflow-hidden mb-6 shadow-sm"
    >
      <div className="p-4 border-b border-orange-100/50 dark:border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Suggested for you</h3>
        </div>
        <Link
          to={createPageUrl("Explore") + "?tab=suggestions"}
          className="text-[11px] font-bold text-orange-600 hover:text-orange-700 transition-colors"
        >
          See All
        </Link>
      </div>

      {/* Horizontal scroll for mobile, grid for larger screens */}
      <div className="p-4">
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0 scrollbar-hide">
          {suggestions.map((item, idx) => {
            const isFollowing = followStatuses?.[item.username] || false;
            const linkTo = item.type === 'store'
              ? createPageUrl("StoreDetail") + `?id=${item.id}`
              : createPageUrl("Profile") + `?username=${item.username}`;

            return (
              <motion.div
                key={`${item.type}-${item.username}-${idx}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-800 hover:shadow-md transition-all duration-200 flex-shrink-0 w-72 sm:w-auto"
              >
                <Link to={linkTo} className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900 dark:to-orange-800 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm group-hover:scale-105 transition-transform">
                    {item.avatar_url ? (
                      <img src={item.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : item.type === 'store' ? (
                      <Store className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    ) : (
                      <User className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.display_name}</p>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter flex-shrink-0 ${
                        item.type === 'store'
                          ? 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400'
                          : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{item.username}</p>
                  </div>
                </Link>
                <button
                  onClick={() => followMutation.mutate({
                    username: item.username,
                    type: item.type,
                    targetId: item.type === 'store' ? item.id : null,
                    display_name: item.display_name,
                    isFollowing
                  })}
                  disabled={followMutation.isPending}
                  className={`mt-2 w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    isFollowing
                      ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-sm shadow-orange-200 dark:shadow-orange-900/20'
                  }`}
                >
                  {followMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : isFollowing ? (
                    'Following'
                  ) : (
                    <span className="flex items-center justify-center gap-1">
                      <UserPlus className="w-3 h-3" />
                      Follow
                    </span>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <Link
        to={createPageUrl("Explore")}
        className="block p-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-colors"
      >
        Discover more people and stores
      </Link>
    </motion.div>
  );
}
