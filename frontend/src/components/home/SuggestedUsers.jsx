import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storesAPI, followsAPI, usersAPI } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { createPageUrl, storeUrl } from "@/lib/utils";
import { UserPlus, Store, User, Check, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import AvatarImg from "@/components/shared/AvatarImg";

/**
 * People and shops to follow, that the viewer doesn't already follow.
 *
 * The exclusion happens on the server (/users/suggested, /stores/suggested).
 * It used to happen here: the component asked for the top few accounts, then
 * fired one follow-status request per candidate to find out which to hide.
 * That was a request waterfall, and worse, it was silently self-defeating —
 * anyone who already followed the popular accounts had every candidate
 * filtered out and saw no section at all.
 *
 * The server list is still checked here against the viewer's own follow list,
 * because the server answer is cached: a follow made anywhere else in the app
 * (a profile, a store page) never reaches into this query's cache, and a
 * stale answer puts someone the viewer already follows back into the row.
 * That check costs one request for the whole list, not one per candidate.
 *
 * A row the viewer follows *during this render* stays put with a "Following"
 * label instead of vanishing under their thumb.
 */
export default function SuggestedUsers({ currentUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [justFollowed, setJustFollowed] = useState(new Set());
  const signedIn = !!currentUser?.username;

  // Both ask for more than the row shows: the follow check below can drop a
  // few candidates, and a short row is worse than a wasted candidate.
  const { data: usersRes, isLoading: usersLoading } = useQuery({
    queryKey: ["suggestedUsers", currentUser?.username],
    queryFn: () => usersAPI.getSuggested({ limit: 16 }),
    staleTime: 5 * 60 * 1000,
    enabled: signedIn,
  });

  const { data: storesRes, isLoading: storesLoading } = useQuery({
    queryKey: ["suggestedStores", currentUser?.username],
    queryFn: () => storesAPI.getSuggested({ limit: 16 }),
    staleTime: 5 * 60 * 1000,
    enabled: signedIn,
  });

  // The endpoint caps out at 100, newest first — enough to catch anything the
  // server list could be stale about, and the server still excludes the rest.
  const { data: followingRes } = useQuery({
    queryKey: ["myFollowing", currentUser?.username],
    queryFn: () => followsAPI.getMyFollowing({ limit: 100 }),
    staleTime: 60 * 1000,
    enabled: signedIn,
  });

  const followed = useMemo(() => {
    const usernames = new Set();
    const storeIds = new Set();
    const storeOwners = new Set();

    // Nobody should be invited to follow themselves or their own shop.
    if (currentUser?.username) usernames.add(currentUser.username.toLowerCase());

    (followingRes?.following || []).forEach((f) => {
      const name = f?.following_username ? String(f.following_username).toLowerCase() : null;
      if (f?.follow_type === "store") {
        // A store follow records both the store id and the owner, and older
        // rows may carry only one — match on either.
        if (f.target_id) storeIds.add(String(f.target_id));
        if (name) storeOwners.add(name);
      } else if (name) {
        usernames.add(name);
      }
    });

    return { usernames, storeIds, storeOwners };
  }, [followingRes, currentUser?.username]);

  // Interleaved rather than concatenated, so the row leads with a mix instead
  // of burying every shop behind every person.
  const suggestions = useMemo(() => {
    const alreadyFollowed = (item) => {
      const name = item.username ? String(item.username).toLowerCase() : null;
      if (item.type === "store") {
        return followed.storeIds.has(String(item.id)) || (!!name && followed.storeOwners.has(name));
      }
      return !!name && followed.usernames.has(name);
    };

    // A card the viewer just tapped is kept deliberately, even once that
    // follow shows up in the list it is being checked against.
    const keep = (item) => justFollowed.has(item.key) || !alreadyFollowed(item);

    const people = (usersRes?.users || []).map((u) => ({
      key: "user:" + u.username,
      username: u.username,
      display_name: u.display_name || u.full_name || u.username,
      avatar_url: u.avatar_url,
      subtitle: "@" + u.username,
      id: u._id || u.id,
      type: "user",
      is_verified: u.is_verified,
    })).filter(keep);

    const shops = (storesRes?.data || []).map((s) => ({
      key: "store:" + (s.id || s._id),
      username: s.owner_username,
      display_name: s.name,
      avatar_url: s.logo_url,
      subtitle: s.category || t("home.shopLabel"),
      id: s.id || s._id,
      slug: s.slug,
      type: "store",
      is_verified: s.is_verified,
    })).filter(keep);

    const mixed = [];
    for (let i = 0; i < Math.max(people.length, shops.length); i++) {
      if (people[i]) mixed.push(people[i]);
      if (shops[i]) mixed.push(shops[i]);
    }
    return mixed.slice(0, 10);
  }, [usersRes, storesRes, followed, justFollowed, t]);

  const followMutation = useMutation({
    mutationFn: ({ username, type, targetId }) =>
      followsAPI.follow(username, type, type === "store" ? targetId : undefined),
    onMutate: ({ key }) => {
      setJustFollowed((prev) => new Set(prev).add(key));
    },
    onError: (error, { key }) => {
      setJustFollowed((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast.error(error?.message || t("home.followFailed"));
    },
    onSuccess: (_, { display_name }) => {
      toast.success(t("home.nowFollowing", { name: display_name }));
      // The feed's "Following" tab and the follow counters both change, and
      // the follow list this section checks against is now one row short.
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["followStatus"] });
      queryClient.invalidateQueries({ queryKey: ["myFollowing"] });
    },
  });

  const isLoading = usersLoading || storesLoading;
  if (!signedIn) return null;
  if (!isLoading && suggestions.length === 0) return null;

  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">
            {t("home.suggestedToFollow")}
          </h2>
          <p className="text-xs text-slate-500 dark:text-ink-400 mt-0.5">
            {t("home.suggestedToFollowDesc")}
          </p>
        </div>
        <Link
          to={createPageUrl("Explore") + "?tab=suggestions"}
          className="shrink-0 text-[13px] font-semibold text-slate-500 dark:text-ink-400 flex items-center"
        >
          {t("home.seeAll")} <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Contained to the same gutter as the post cards above and below it
          rather than bled to the display edge — one set of vertical lines
          down the whole feed. */}
      <div className="overflow-x-auto overscroll-x-contain hide-scrollbar snap-x">
        <div className="inline-flex gap-3">
          {isLoading
            ? Array(3).fill(0).map((_, i) => (
                <div
                  key={"sug-sk-" + i}
                  className="w-40 h-[168px] shrink-0 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse"
                />
              ))
            : suggestions.map((item) => {
                const followedNow = justFollowed.has(item.key);
                const linkTo = item.type === "store"
                  ? storeUrl(item)
                  : createPageUrl("Profile") + `?username=${item.username}`;

                return (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="snap-start shrink-0 w-40 p-3 rounded-2xl bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-800 flex flex-col items-center text-center"
                  >
                    <Link to={linkTo} className="flex flex-col items-center min-w-0 w-full">
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 dark:bg-ink-800 flex items-center justify-center">
                        <AvatarImg
                          src={item.avatar_url}
                          className="w-full h-full object-cover"
                          fallback={item.type === "store"
                            ? <Store className="w-6 h-6 text-slate-400" />
                            : <User className="w-6 h-6 text-slate-400" />}
                        />
                      </div>
                      <p className="mt-2 text-[13px] font-bold text-slate-900 dark:text-white truncate w-full">
                        {item.display_name}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-ink-500 truncate w-full">
                        {item.subtitle}
                      </p>
                    </Link>

                    <button
                      onClick={() => !followedNow && followMutation.mutate({
                        key: item.key,
                        username: item.username,
                        type: item.type,
                        targetId: item.id,
                        display_name: item.display_name,
                      })}
                      disabled={followedNow || followMutation.isPending}
                      className={`mt-2.5 w-full h-8 rounded-full text-[12px] font-bold flex items-center justify-center gap-1 transition-colors ${
                        followedNow
                          ? "bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-ink-400"
                          : "bg-ink-900 text-white dark:bg-white dark:text-ink-900 hover:opacity-90"
                      }`}
                    >
                      {followMutation.isPending && followMutation.variables?.key === item.key ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : followedNow ? (
                        <><Check className="w-3.5 h-3.5" /> {t("home.following")}</>
                      ) : (
                        <><UserPlus className="w-3.5 h-3.5" /> {t("home.follow")}</>
                      )}
                    </button>
                  </motion.div>
                );
              })}
        </div>
      </div>
    </section>
  );
}
