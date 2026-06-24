import React, { useState, useRef, useEffect } from "react";
import { notificationsAPI } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Bell, MessageCircle, Package, DollarSign, Heart, UserPlus, CheckCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/SocketContext";

const TYPE_CONFIG = {
  message:      { icon: MessageCircle, color: "bg-indigo-100 text-indigo-600", label: "Message" },
  offer:        { icon: DollarSign,    color: "bg-amber-100 text-amber-600",   label: "Offer" },
  order_update: { icon: Package,       color: "bg-green-100 text-green-600",   label: "Order" },
  like:         { icon: Heart,         color: "bg-red-100 text-red-500",       label: "Like" },
  follow:       { icon: UserPlus,      color: "bg-purple-100 text-purple-600", label: "Follow" },
  comment:      { icon: MessageCircle, color: "bg-blue-100 text-blue-600",     label: "Comment" },
  product_added: { icon: Package,      color: "bg-emerald-100 text-emerald-600", label: "Product" },
  mention:      { icon: MessageCircle, color: "bg-amber-100 text-amber-600",   label: "Mention" },
};

export default function NotificationBell({ userEmail }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userEmail],
    queryFn: async () => {
      const response = await notificationsAPI.list({
        limit: 20,
      });
      return response.data || [];
    },
    enabled: !!userEmail,
    refetchInterval: 60000, // Increased from 15s since we have sockets
  });

  const { on } = useSocket();

  useEffect(() => {
    if (!userEmail) return;

    const cleanup = on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userEmail] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotifs"] });
    });

    return cleanup;
  }, [userEmail, on, queryClient]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotifs"] });
    },
    onError: (error) => {
      console.error("Failed to mark all as read:", error);
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id) => notificationsAPI.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotifs"] });
    },
    onError: (error) => {
      console.error("Failed to mark notification as read:", error);
    },
  });

  const unread = notifications.filter(notif => !notif.is_read).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-700" />
                <span className="text-sm font-bold text-slate-900">Notifications</span>
                {unread > 0 && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold rounded-full px-2 py-0.5">{unread} new</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={() => markAllMutation.mutate()}
                    className="text-[10px] text-indigo-500 font-semibold hover:underline flex items-center gap-0.5"
                  >
                    <CheckCheck className="w-3 h-3" /> All read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="ml-2 p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">All caught up!</p>
                </div>
              ) : (
                notifications.map(notif => {
                  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.like;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={notif.id || notif._id}
                      onClick={() => {
                        const id = notif.id || notif._id;
                        if (!notif.is_read && id) markOneMutation.mutate(id);
                        if (notif.link && notif.link.startsWith("/")) navigate(notif.link);
                        else if (notif.metadata?.link && typeof notif.metadata.link === "string" && notif.metadata.link.startsWith("/")) navigate(notif.metadata.link);
                        setOpen(false);
                      }}
                      className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0 ${!notif.is_read ? "bg-indigo-50/40" : ""}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 leading-snug">{notif.title}</p>
                        {notif.body && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>}
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(notif.created_at || notif.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {!notif.is_read && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-slate-100">
              <Link
                to={createPageUrl("Notifications")}
                onClick={() => setOpen(false)}
                className="text-xs text-indigo-600 font-semibold hover:underline w-full block text-center"
              >
                View all notifications →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}