import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import EmptyState from "@/components/shared/EmptyState";
import {
  Bell, Heart, MessageCircle, UserPlus, Package, Users, Megaphone, CheckCheck, ShieldAlert,
  ShoppingCart, TrendingDown, PackageCheck, Star, RefreshCw, Truck, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { notificationsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import BackLink from "@/components/shared/BackLink";
import { countUnread } from "@/lib/notifications";

const TYPE_ICONS = {
  like: { icon: Heart, color: "bg-red-100 text-red-500" },
  comment: { icon: MessageCircle, color: "bg-orange-100 text-orange-500" },
  follow: { icon: UserPlus, color: "bg-purple-100 text-purple-500" },
  order_update: { icon: Package, color: "bg-green-100 text-green-500" },
  message: { icon: MessageCircle, color: "bg-orange-100 text-orange-500" },
  mention: { icon: MessageCircle, color: "bg-amber-100 text-amber-500" },
  community: { icon: Users, color: "bg-pink-100 text-pink-500" },
  promotion: { icon: Megaphone, color: "bg-orange-100 text-orange-500" },
  subscription_limit: { icon: ShieldAlert, color: "bg-amber-100 text-amber-600" },
  product_added: { icon: Package, color: "bg-emerald-100 text-emerald-500" },
  // Reminders raised by the backend sweep (services/reminderService.ts)
  cart_reminder: { icon: ShoppingCart, color: "bg-amber-100 text-amber-600" },
  wishlist_price_drop: { icon: TrendingDown, color: "bg-rose-100 text-rose-500" },
  back_in_stock: { icon: PackageCheck, color: "bg-emerald-100 text-emerald-600" },
  review_reminder: { icon: Star, color: "bg-yellow-100 text-yellow-600" },
  reorder_reminder: { icon: RefreshCw, color: "bg-sky-100 text-sky-600" },
  delivery_reminder: { icon: Truck, color: "bg-green-100 text-green-600" },
  recommendation: { icon: Sparkles, color: "bg-violet-100 text-violet-600" },
};

export default function Notifications() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", currentUser?.username],
    queryFn: async () => {
      const res = await notificationsAPI.list({ sort: "-created_at", limit: 50 });
      return res.data || [];
    },
    enabled: !!currentUser?.username,
  });

  const markRead = useMutation({
    mutationFn: async (id) => {
      await notificationsAPI.markAsRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotifs"] });
    },
    onError: (error) => {
      console.error("Failed to mark notification as read:", error);
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await notificationsAPI.markAllAsRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotifs"] });
    },
    onError: (error) => {
      console.error("Failed to mark all as read:", error);
    },
  });

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markRead.mutate(notif.id || notif._id);
    }
    if (notif.link && notif.link.startsWith("/")) {
      navigate(notif.link);
    }
  };

  const unreadCount = countUnread(notifications);
  // "Mark all read" still clears message notifications even though they are
  // not part of the count above, otherwise they would have no way out.
  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <BackLink to="Home" label={t("common.backTo", { page: t("nav.home") })} />
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("notifications.title")}</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-slate-500 dark:text-ink-400">{t("notifications.unread", { count: unreadCount })}</p>
          )}
        </div>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            className="text-orange-600 hover:text-orange-700 shrink-0"
          >
            <CheckCheck className="w-4 h-4 mr-1.5" />
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-white dark:bg-ink-800 rounded-xl p-4 animate-pulse flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-ink-700" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 bg-slate-200 dark:bg-ink-700 rounded" />
                <div className="h-2.5 w-1/2 bg-slate-100 dark:bg-ink-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t("notifications.noNotifications")}
          description={t("notifications.allCaughtUp")}
        />
      ) : (
        <div className="space-y-1">
          {notifications.map((notif, i) => {
            const typeConfig = TYPE_ICONS[notif.type] || TYPE_ICONS.like;
            const Icon = typeConfig.icon;
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
                  notif.is_read ? "bg-white dark:bg-ink-800 hover:bg-slate-50 dark:hover:bg-ink-700" : "bg-orange-50/50 dark:bg-orange-950/50 hover:bg-orange-50 dark:hover:bg-orange-950"
                }`}
                onClick={() => handleNotificationClick(notif)}
              >
                {notif.metadata?.product_image ? (
                  <div className="relative shrink-0">
                    <img
                      src={notif.metadata.product_image}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover bg-slate-100 dark:bg-ink-700"
                      loading="lazy"
                    />
                    <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-ink-800 ${typeConfig.color}`}>
                      <Icon className="w-3 h-3" />
                    </span>
                  </div>
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeConfig.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{notif.title}</p>
                  {notif.body && <p className="text-xs text-slate-500 dark:text-ink-400 mt-0.5">{notif.body}</p>}
                  <p className="text-xs text-slate-400 dark:text-ink-500 mt-1">
                    {new Date(notif.created_at || notif.created_date).toLocaleDateString(i18n.language, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!notif.is_read && <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 shrink-0" />}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
