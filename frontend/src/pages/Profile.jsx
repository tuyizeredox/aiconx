import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import PostCard from "@/components/shared/PostCard";
import ProductCard from "@/components/shared/ProductCard";
import { PostSkeleton, ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import ProfileEditModal from "@/components/profile/ProfileEditModal";
import AvatarImg from "@/components/shared/AvatarImg";
import {
  usersAPI, postsAPI, productsAPI, ordersAPI, reviewsAPI,
  followsAPI, likesAPI, storesAPI, vendorSubscriptionsAPI
} from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import {
  Grid3X3, ShoppingBag, UserPlus, UserCheck, LogOut,
  Store, Package, CheckCircle2, Clock, Truck, Pencil, Star, BadgeCheck, Heart,
  Search, Users2, Calendar, MessageCircle, CreditCard, Sparkles, X,
  Settings as SettingsIcon, Link2, ArrowLeft
} from "lucide-react";
import StarRating from "@/components/reviews/StarRating";
import SubscriptionManager from "@/components/mystore/SubscriptionManager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";

function UserListModal({ open, onClose, title, users = [] }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const usersArray = Array.isArray(users) ? users : [];
  const filtered = usersArray.filter(u =>
    u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.following_username?.toLowerCase().includes(search.toLowerCase()) ||
    u.follower_username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-slate-50 dark:border-slate-700">
          <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="p-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("profile.searchUsers")}
              className="w-full bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400 border-none rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-1 focus:ring-orange-300 outline-none"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-1 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="py-10 text-center">
                <Users2 className="w-10 h-10 text-slate-100 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">{t("profile.noUsersFound")}</p>
              </div>
            ) : filtered.map((u, i) => {
              const user = u.user || u;
              const username = user.following_username || user.follower_username || user.username;
              const name = user.display_name || username || "User";
              const avatarUrl = user.avatar_url;
              return (
                <Link
                  key={i}
                  to={createPageUrl("Profile") + `?username=${username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900 dark:to-orange-900 flex items-center justify-center overflow-hidden border border-slate-50 dark:border-slate-700">
                    <AvatarImg
                      src={avatarUrl}
                      className="w-full h-full object-cover"
                      fallback={<span className="text-orange-600 dark:text-orange-400 font-bold text-xs">{name[0]?.toUpperCase()}</span>}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{name}</p>
                    <p className="text-[10px] text-slate-400 truncate">@{username}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_CONFIG = {
  pending:   { icon: Clock,         color: "bg-amber-100 text-amber-700",  tKey: "orders.pending" },
  confirmed: { icon: CheckCircle2,  color: "bg-orange-100 text-orange-700",    tKey: "orders.confirmed" },
  processing:{ icon: Package,       color: "bg-orange-100 text-orange-700",tKey: "orders.processing" },
  shipped:   { icon: Truck,         color: "bg-purple-100 text-purple-700",tKey: "orders.shipped" },
  delivered: { icon: CheckCircle2,  color: "bg-green-100 text-green-700",  tKey: "orders.delivered" },
};

export default function Profile() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const profileUsername = params.get("username");
  const [activeTab, setActiveTab] = useState("posts");
  const [editOpen, setEditOpen] = useState(false);
  const [userList, setUserList] = useState({ open: false, title: "", users: [] });
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuth();

  const targetUsername = profileUsername || currentUser?.username;
  const isOwnProfile = !profileUsername || profileUsername.toLowerCase() === currentUser?.username?.toLowerCase();

  const { data: profileUser } = useQuery({
    queryKey: ["profileUser", targetUsername],
    queryFn: async () => {
      if (isOwnProfile && currentUser?.username === targetUsername) return currentUser;
      return usersAPI.getProfile(targetUsername);
    },
    enabled: !!targetUsername,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["userPosts", targetUsername, currentUser?.username],
    queryFn: async () => {
      const params = { author_username: targetUsername, sort: "-created_at", limit: 50 };
      if (currentUser?.username) params.user_username = currentUser.username;
      const res = await postsAPI.list(params);
      return res.data || [];
    },
    enabled: !!targetUsername,
  });

  const { data: userProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["userProducts", targetUsername],
    queryFn: async () => {
      const res = await productsAPI.list({ vendor_username: targetUsername, status: "active", sort: "-created_at", limit: 30 });
      return res.data || [];
    },
    enabled: !!targetUsername,
  });

  const { data: buyerOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["profileOrders", targetUsername],
    queryFn: async () => {
      const res = await ordersAPI.list({ buyer_username: targetUsername, sort: "-created_at", limit: 30 });
      return res.data || [];
    },
    enabled: !!targetUsername && isOwnProfile,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["userReviews", targetUsername],
    queryFn: async () => {
      const res = await reviewsAPI.list({ reviewer_username: targetUsername, sort: "-created_at", limit: 5 });
      return res.data || [];
    },
    enabled: !!targetUsername,
  });

  const { data: followCounts = { follower_count: 0, following_count: 0 } } = useQuery({
    queryKey: ["followCounts", targetUsername],
    queryFn: async () => {
      const res = await followsAPI.getCounts({ 
        following_username: targetUsername,
        follow_type: 'user'
      });
      return res || { follower_count: 0, following_count: 0 };
    },
    enabled: !!targetUsername,
  });

  const followersCount = followCounts?.follower_count || profileUser?.follower_count || 0;
  const followingCount = followCounts?.following_count || profileUser?.following_count || 0;

  const { data: followStatus = { is_following: false, is_followed_by: false } } = useQuery({
    queryKey: ["followStatus", currentUser?.username, targetUsername],
    queryFn: async () => {
      if (!currentUser?.username) return { is_following: false, is_followed_by: false };
      const res = await followsAPI.check({ follower_username: currentUser.username, following_username: targetUsername });
      return { 
        is_following: !!res.is_following || !!res.following,
        is_followed_by: !!res.is_followed_by
      };
    },
    enabled: !!currentUser?.username && !isOwnProfile,
  });

  const isFollowing = followStatus.is_following;
  const isFollowedBy = followStatus.is_followed_by;

  const { data: likedPosts = [], isLoading: likedPostsLoading } = useQuery({
    queryKey: ["likedPosts", targetUsername],
    queryFn: async () => {
      const res = await likesAPI.list({ user_username: targetUsername, target_type: "post" });
      const likes = res.data || res || [];
      if (likes.length === 0) return [];
      
      // Fetch each post details
      const posts = await Promise.all(
        likes.slice(0, 20).map(async (like) => {
          try {
            const params = currentUser?.username ? { user_username: currentUser.username } : {};
            return await postsAPI.get(like.target_id, params);
          } catch (e) {
            return null;
          }
        })
      );
      return posts.filter(p => !!p);
    },
    enabled: !!targetUsername && isOwnProfile,
  });

  const { data: store } = useQuery({
    queryKey: ["userStore", targetUsername],
    queryFn: async () => {
      const res = await storesAPI.getByOwner(targetUsername);
      return res.data || res; // Handle both wrapped and unwrapped store response
    },
    enabled: !!targetUsername,
  });

  const { data: subscription } = useQuery({
    queryKey: ["vendorSubscription", targetUsername],
    queryFn: async () => {
      try {
        const res = await vendorSubscriptionsAPI.list({ vendor_username: targetUsername });
        const subs = Array.isArray(res) ? res : (res.data || res.subscriptions || []);
        return subs[0] || null;
      } catch {
        return null;
      }
    },
    enabled: !!targetUsername && isOwnProfile,
  });

  const { data: vendorStoreReviews = [] } = useQuery({
    queryKey: ["vendorStoreReviews", store?.id],
    queryFn: async () => {
      const res = await reviewsAPI.list({ store_id: store.id, sort: "-created_at", limit: 100 });
      return res.data || [];
    },
    enabled: !!store?.id,
  });

  const vendorAvgRating = vendorStoreReviews.length > 0
    ? vendorStoreReviews.reduce((s, r) => s + (r.rating || 0), 0) / vendorStoreReviews.length
    : 0;

  const followMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await followsAPI.unfollow({ follower_username: currentUser.username, following_username: targetUsername });
      } else {
        await followsAPI.follow(targetUsername);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followStatus", currentUser?.username, targetUsername] });
      queryClient.invalidateQueries({ queryKey: ["followCounts", targetUsername] });
      toast.success(isFollowing ? t("profile.unfollowed") : t("profile.followingToast"));
    },
  });

  const displayName = profileUser?.display_name || profileUser?.full_name || "User";
  const avatarUrl = profileUser?.avatar_url;
  useEffect(() => { setAvatarLoadFailed(false); }, [avatarUrl]);
  const bannerUrl = profileUser?.banner_url;
  const bio = profileUser?.bio;
  const completedOrders = buyerOrders.filter(o => o.status === "delivered").length;
  const totalSpent = buyerOrders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Other users' profiles are reached from many places (a post, search, a
          followers list, a story...) with no single logical "back to X" page, so
          unlike the rest of the app's fixed-destination back links, this one uses
          real browser history — falling back to Home if opened with no history
          (e.g. a profile link shared directly). Your own profile via the bottom
          nav stays a top-level tab with no back button. */}
      {!isOwnProfile && (
        <button
          onClick={() => {
            if (window.history.state?.idx > 0) navigate(-1);
            else navigate(createPageUrl("Home"));
          }}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {t("common.back")}
        </button>
      )}
      {/* Profile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden mb-5 shadow-sm"
      >
        {/* Banner */}
        <div className="h-32 relative overflow-hidden bg-slate-100 dark:bg-slate-700">
          {bannerUrl ? (
            <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700" />
          )}
        </div>

        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-end justify-between gap-2 -mt-12 mb-4">
            {/* Avatar */}
            <div className="relative">
              {avatarUrl && !avatarLoadFailed ? (
                <button
                  onClick={() => setImageModalOpen(true)}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 flex items-center justify-center transition-transform hover:scale-105 duration-300 cursor-pointer p-0"
                >
                  <AvatarImg
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onLoadError={() => setAvatarLoadFailed(true)}
                    fallback={<span className="text-white font-bold text-3xl">{displayName[0]?.toUpperCase()}</span>}
                  />
                </button>
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 flex items-center justify-center transition-transform hover:scale-105 duration-300">
                  <span className="text-white font-bold text-3xl">{displayName[0]?.toUpperCase()}</span>
                </div>
              )}
              {(profileUser?.is_verified || store?.is_verified) && (
                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-lg">
                  <BadgeCheck className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 justify-end">
              {isOwnProfile ? (
                <>
                  <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveTab("plan");
                        setTimeout(() => {
                          const el = document.getElementById('profile-tabs-list');
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}
                      className={`relative rounded-xl gap-1.5 transition-all font-bold h-9 px-3 sm:px-4 shadow-sm border-orange-200 ${
                        activeTab === "plan"
                          ? "bg-orange-600 text-white border-orange-600 shadow-orange-100"
                          : "bg-orange-50/80 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span className="hidden sm:inline">{t("profile.managePlan")}</span>
                      {subscription?.status === 'pending' && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                      )}
                    </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                    className="rounded-xl gap-1.5 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-orange-600 transition-all font-semibold h-9 px-3 sm:px-4"
                  >
                    <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("profile.editProfile")}</span>
                  </Button>
                  <Link to={createPageUrl("Affiliate")}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title={t("nav.affiliate")}
                      aria-label={t("nav.affiliate")}
                      className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all h-9 w-9 p-0 shrink-0"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Link to={createPageUrl("Settings")}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title={t("nav.settings")}
                      aria-label={t("nav.settings")}
                      className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all h-9 w-9 p-0 shrink-0"
                    >
                      <SettingsIcon className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logout()}
                    title={t("common.logout")}
                    aria-label={t("common.logout")}
                    className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-all h-9 w-9 p-0 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => followMutation.mutate()}
                    size="sm"
                    className={`rounded-xl px-4 sm:px-5 h-9 font-semibold transition-all ${
                      isFollowing
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                        : "bg-orange-600 text-white hover:bg-orange-700 shadow-md shadow-orange-100"
                    }`}
                    variant={isFollowing ? "secondary" : "default"}
                  >
                    {isFollowing ? (
                      <><UserCheck className="w-3.5 h-3.5 mr-1.5" />{t("common.following")}</>
                    ) : isFollowedBy ? (
                      <><UserPlus className="w-3.5 h-3.5 mr-1.5" />{t("common.follow")}</>
                    ) : (
                      <><UserPlus className="w-3.5 h-3.5 mr-1.5" />{t("common.follow")}</>
                    )}
                  </Button>
                  <Link to={createPageUrl("Chat") + `?to=${targetUsername || profileUser?.username}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 h-9 px-3 sm:px-4 font-semibold"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> {t("profile.message")}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Name + bio */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{displayName}</h1>
              {isOwnProfile && (
                <Badge variant="secondary" className="bg-orange-50 dark:bg-orange-950 text-orange-600 border-0 text-[10px] font-bold py-0 px-1.5 h-4 uppercase tracking-wider">{t("profile.youBadge")}</Badge>
              )}
              {!isOwnProfile && isFollowedBy && (
                <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-0 text-[9px] font-bold py-0 px-1.5 h-4 uppercase tracking-wider">{t("profile.followsYou")}</Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium mb-2">@{profileUser?.username || profileUser?.display_name?.replace(/\s+/g, '_').toLowerCase() || profileUser?.email?.split('@')[0]}</p>
            
            {/* Aicon Points */}
            {isOwnProfile && (
              <div className="flex items-center gap-2 mb-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full shadow-sm hover:shadow-md transition-shadow cursor-default group">
                  <Sparkles className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                  <span className="text-xs font-bold">1,250 {t("profile.aiconPoints")}</span>
                </div>
              </div>
            )}

            {bio && <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2 max-w-lg">{bio}</p>}
            
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {store && (
                <Link 
                  to={createPageUrl("StoreDetail") + `?id=${store.id || store._id}`} 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 dark:bg-orange-950 rounded-lg text-xs text-orange-700 dark:text-orange-400 font-bold hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors"
                >
                  <Store className="w-3.5 h-3.5" /> {store.name}
                </Link>
              )}
              {vendorAvgRating > 0 && (
                <div className="flex items-center gap-1.5">
                  <StarRating value={Math.round(vendorAvgRating)} readonly size={3.5} />
                  <span className="text-xs text-amber-600 font-bold">{vendorAvgRating.toFixed(1)}</span>
                  <span className="text-xs text-slate-400">({vendorStoreReviews.length})</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 pt-4 border-t border-slate-50 dark:border-slate-700">
            {[
              { label: t("profile.posts"), value: posts.length, onClick: null },
              { 
                label: t("profile.followers"), 
                value: followersCount, 
                onClick: async () => {
                  const res = await followsAPI.getFollowers({ following_username: targetUsername });
                  setUserList({ open: true, title: t("profile.followers"), users: res.followers || res.data || res || [] });
                }
              },
              { 
                label: t("profile.following"), 
                value: followingCount, 
                onClick: async () => {
                  const res = await followsAPI.getFollowing({ follower_username: targetUsername });
                  setUserList({ open: true, title: t("profile.following"), users: res.following || res.data || res || [] });
                }
              },
              ...(userProducts.length > 0 ? [{ label: t("nav.shop"), value: userProducts.length, onClick: null }] : []),
              ...(isOwnProfile && completedOrders > 0 ? [{ label: t("orders.title"), value: completedOrders, onClick: null }] : []),
            ].map(stat => (
              <div 
                key={stat.label} 
                className={`text-center ${stat.onClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg px-2 transition-colors" : ""}`}
                onClick={stat.onClick}
              >
                <p className="text-base font-bold text-slate-900 dark:text-white">{stat.value}</p>
                <p className="text-[10px] text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-400">
            <Calendar className="w-3 h-3" />
            <span>{profileUser?.created_at ? t("profile.joinedOn", { date: new Date(profileUser.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }) : t("profile.joinedRecently")}</span>
          </div>

          {/* Trust badges */}
          {isOwnProfile && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {completedOrders >= 5 && (
                <Badge className="bg-green-100 text-green-700 border-0 text-[10px] gap-1"><CheckCircle2 className="w-3 h-3" />{t("profile.trustedBuyer")}</Badge>
              )}
              {(store?.total_sales || 0) >= 10 && (
                <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] gap-1"><Star className="w-3 h-3" />{t("profile.topVendor")}</Badge>
              )}
              {totalSpent >= 100 && (
                <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] gap-1"><BadgeCheck className="w-3 h-3" />{t("profile.powerShopper")}</Badge>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Vendor Showcase (if applicable) */}
      {store && (
        <div className="space-y-6 mb-6">
          {/* Store Highlights */}
          {userProducts.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-orange-500" />
                  {t("profile.storeHighlights")}
                </h2>
                <Link to={createPageUrl("StoreDetail") + `?id=${store.id || store._id}`} className="text-[10px] font-bold text-orange-600 uppercase tracking-wider hover:underline">
                  {t("profile.visitStore")}
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {userProducts.slice(0, 5).map((product, idx) => (
                  <div key={product.id || product._id || `highlight-${idx}`} className="w-32 shrink-0">
                    <ProductCard product={product} compact />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Store Feedback */}
          {vendorStoreReviews.length > 0 && (
            <div className="bg-slate-50/50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  {t("profile.recentStoreFeedback")}
                </h2>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-600 shadow-sm">
                  {vendorAvgRating.toFixed(1)} / 5.0
                </span>
              </div>
              <div className="space-y-3">
                {vendorStoreReviews.slice(0, 2).map((review, idx) => (
                  <div key={review.id || review._id || `review-${idx}`} className="bg-white dark:bg-slate-700 rounded-xl p-3 border border-slate-100 dark:border-slate-600 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <StarRating value={review.rating} readonly size={2.5} />
                        <span className="text-[10px] font-bold text-slate-900 dark:text-white">{review.reviewer_name || t("profile.verifiedBuyer")}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium">
                        {review.created_at ? new Date(review.created_at).toLocaleDateString() : t("profile.recently")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed italic">"{review.content}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList id="profile-tabs-list" className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 w-full">
          <TabsTrigger value="posts" className="gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm"><Grid3X3 className="w-4 h-4" /><span className="hidden sm:inline">{t("profile.posts")}</span></TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm"><ShoppingBag className="w-4 h-4" /><span className="hidden sm:inline">{t("shop.products")}</span></TabsTrigger>
          {isOwnProfile && <TabsTrigger value="orders" className="gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm"><Package className="w-4 h-4" /><span className="hidden sm:inline">{t("orders.title")}</span></TabsTrigger>}
          {isOwnProfile && <TabsTrigger value="liked" className="gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm"><Heart className="w-4 h-4" /><span className="hidden sm:inline">{t("common.liked")}</span></TabsTrigger>}
          {isOwnProfile && (
            <TabsTrigger value="plan" className="gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm text-orange-600 font-bold border-orange-100 data-[state=active]:bg-orange-50/50 relative">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">{t("profile.plan")}</span>
              {subscription?.status === 'pending' && (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" />
              )}
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* Posts tab */}
      {activeTab === "posts" && (
        <div className="space-y-4">
          {postsLoading
            ? Array(3).fill(0).map((_, i) => <PostSkeleton key={`post-skeleton-${i}`} />)
            : posts.map((post, idx) => (
                <PostCard
                  key={post.id || post._id || `profile-post-${idx}`}
                  post={post}
                  currentUser={currentUser}
                  feedPosts={posts}
                />
              ))}
          {!postsLoading && posts.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">{t("profile.noPosts")}</div>
          )}
        </div>
      )}

      {/* Products tab */}
      {activeTab === "products" && (
        <div>
          {productsLoading ? (
            <div className="grid grid-cols-2 gap-3">{Array(4).fill(0).map((_, i) => <ProductSkeleton key={`prod-skeleton-${i}`} />)}</div>
          ) : userProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {userProducts.map((p, idx) => <ProductCard key={p.id || p._id || `prod-${idx}`} product={p} compact />)}
            </div>
          ) : (
            <div className="text-center py-16">
              <ShoppingBag className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">{t("profile.noProductsYet")}</p>
              {isOwnProfile && (
                <Link to={createPageUrl("MyStore")}>
                  <Button size="sm" className="mt-3 bg-orange-600 hover:bg-orange-700 rounded-xl">{t("profile.openMyStore")}</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Orders tab (own profile only) */}
      {activeTab === "orders" && isOwnProfile && (
        <div className="space-y-3">
          {ordersLoading ? (
            Array(3).fill(0).map((_, i) => <div key={`order-skeleton-${i}`} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 animate-pulse h-20" />)
          ) : buyerOrders.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">{t("orders.noOrders")}</p>
              <Link to={createPageUrl("Marketplace")}>
                <Button size="sm" className="mt-3 bg-orange-600 hover:bg-orange-700 rounded-xl">{t("profile.browseMarketplace")}</Button>
              </Link>
            </div>
          ) : (
            buyerOrders.map((order, idx) => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              return (
                <motion.div
                  key={order.id || order._id || `order-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-slate-400">#{order.id?.slice(-8)} · {new Date(order.created_at || order.created_date).toLocaleDateString()}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{order.store_name || "Store"}</p>
                    </div>
                    <Badge className={`${cfg.color} border-0 text-[10px] gap-0.5`}>
                      <StatusIcon className="w-3 h-3" />{t(cfg.tKey)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {order.items?.slice(0, 3).map((item, i) => (
                      <div key={`${item.product_id || i}-${i}`} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        {item.product_image && <img src={item.product_image} className="w-7 h-7 rounded-lg object-cover" alt="" />}
                        <span className="truncate max-w-[100px]">{item.product_title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-50 dark:border-slate-700 flex justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t("orders.total")}: {formatCurrency(order.total)}</span>
                    <Link to={createPageUrl("Orders")} className="text-xs text-orange-500 font-semibold hover:underline">{t("profile.orderDetails")}</Link>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Liked tab (own profile only) */}
      {activeTab === "liked" && isOwnProfile && (
        <div className="space-y-4">
          {likedPostsLoading
            ? Array(3).fill(0).map((_, i) => <PostSkeleton key={`liked-skeleton-${i}`} />)
            : likedPosts.map((post, idx) => (
                <PostCard
                  key={post.id || post._id || `liked-post-${idx}`}
                  post={post}
                  currentUser={currentUser}
                  feedPosts={likedPosts}
                />
              ))}
          {!likedPostsLoading && likedPosts.length === 0 && (
            <div className="text-center py-16">
              <Heart className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">{t("profile.noLikedPosts")}</p>
            </div>
          )}
        </div>
      )}

      {/* Plan tab */}
      {activeTab === "plan" && isOwnProfile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("profile.subscriptionMgmt")}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("profile.managePlanDesc")}</p>
            </div>
          </div>
          <SubscriptionManager store={store} vendorUsername={currentUser?.username} />
        </motion.div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} user={profileUser} />
      )}

      {/* User List Modal (Followers/Following) */}
      <UserListModal
        open={userList.open}
        onClose={() => setUserList({ ...userList, open: false })}
        title={userList.title}
        users={userList.users}
      />

      {/* Profile Image Modal */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">{displayName}</DialogTitle>
            <button
              onClick={() => setImageModalOpen(false)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </DialogHeader>
          <div className="p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <img
              src={avatarUrl}
              alt={displayName}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
