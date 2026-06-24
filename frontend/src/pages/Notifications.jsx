import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import EmptyState from "@/components/shared/EmptyState";
import {
  Bell, Heart, MessageCircle, UserPlus, Package, Users, Megaphone, CheckCheck, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { notificationsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

const TYPE_ICONS = {
  like: { icon: Heart, color: "bg-red-100 text-red-500" },
  comment: { icon: MessageCircle, color: "bg-blue-100 text-blue-500" },
  follow: { icon: UserPlus, color: "bg-purple-100 text-purple-500" },
  order_update: { icon: Package, color: "bg-green-100 text-green-500" },
  message: { icon: MessageCircle, color: "bg-orange-100 text-orange-500" },
  mention: { icon: MessageCircle, color: "bg-amber-100 text-amber-500" },
  community: { icon: Users, color: "bg-pink-100 text-pink-500" },
  promotion: { icon: Megaphone, color: "bg-orange-100 text-orange-500" },
  subscription_limit: { icon: ShieldAlert, color: "bg-amber-100 text-amber-600" },
  product_added: { icon: Package, color: "bg-emerald-100 text-emerald-500" },
};

export default function Notifications() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", currentUser?.username],
    queryFn: async () => {
      const res = await notificationsAPI.list({ sort: "-created_date", limit: 50 });
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

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("notifications.title")}</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-slate-500">{t("notifications.unread", { count: unreadCount })}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            className="text-orange-600 hover:text-orange-700"
          >
            <CheckCheck className="w-4 h-4 mr-1.5" />
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 bg-slate-200 rounded" />
                <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
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
                  notif.is_read ? "bg-white hover:bg-slate-50" : "bg-indigo-50/50 hover:bg-indigo-50"
                }`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeConfig.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 font-medium">{notif.title}</p>
                  {notif.body && <p className="text-xs text-slate-500 mt-0.5">{notif.body}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(notif.created_at || notif.created_date).toLocaleDateString(i18n.language, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!notif.is_read && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
