import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, Smile, Reply, Pencil, Trash2, Forward, Pin, MoreHorizontal } from "lucide-react";
import OrderStatusCard from "@/components/chat/OrderStatusCard";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { messagesAPI } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const EMOJI_QUICK = ["❤️", "😂", "🔥", "👍", "😍", "💯", "🎉", "😎"];

function Avatar({ name, size = 7 }) {
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-xs shrink-0`}>
      {name?.[0]?.toUpperCase() || "U"}
    </div>
  );
}

export default function MessageBubble({ msg, isMine, showAvatar, senderName, onReply, onForward, currentUser }) {
  const [showReactions, setShowReactions] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content || "");
  const queryClient = useQueryClient();

  const invalidateConvo = () => {
    queryClient.invalidateQueries({ queryKey: ["conversationMessages"] });
    queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
  };

  const deleteMutation = useMutation({
    mutationFn: () => messagesAPI.delete(msg._id || msg.id),
    onSuccess: () => {
      invalidateConvo();
      toast.success("Message deleted");
    },
  });

  const editMutation = useMutation({
    mutationFn: (content) => messagesAPI.update(msg._id || msg.id, { content, is_edited: true }),
    onSuccess: () => {
      invalidateConvo();
      setEditing(false);
      toast.success("Message edited");
    },
  });

  const pinMutation = useMutation({
    mutationFn: () => messagesAPI.update(msg._id || msg.id, { is_pinned: !msg.is_pinned }),
    onSuccess: () => {
      invalidateConvo();
      toast.success(msg.is_pinned ? "Unpinned" : "Message pinned 📌");
    },
  });

  const acceptOfferMutation = useMutation({
    mutationFn: () => messagesAPI.update(msg._id || msg.id, { 
      content: `Accepted offer of $${msg.offer_amount}`, 
      message_type: 'text' 
    }),
    onSuccess: () => {
      invalidateConvo();
      toast.success("Offer accepted!");
    },
  });

  const declineOfferMutation = useMutation({
    mutationFn: () => messagesAPI.update(msg._id || msg.id, { 
      content: `Declined offer of $${msg.offer_amount}`, 
      message_type: 'text' 
    }),
    onSuccess: () => {
      invalidateConvo();
      toast.success("Offer declined");
    },
  });

  const ACTIONS = [
    { icon: Reply, label: "Reply", onClick: () => { onReply?.(msg); setShowActions(false); } },
    { icon: Forward, label: "Forward", onClick: () => { onForward?.(msg); setShowActions(false); } },
    { icon: Pin, label: msg.is_pinned ? "Unpin" : "Pin", onClick: () => { pinMutation.mutate(); setShowActions(false); } },
    ...(isMine ? [
      { icon: Pencil, label: "Edit", onClick: () => { setEditing(true); setShowActions(false); } },
      { icon: Trash2, label: "Delete", onClick: () => { deleteMutation.mutate(); setShowActions(false); }, danger: true },
    ] : []),
  ];

  return (
    <div className={`flex gap-2 items-end ${isMine ? "flex-row-reverse" : "flex-row"} group relative`}>
      {!isMine && showAvatar && <Avatar name={senderName} />}
      {!isMine && !showAvatar && <div className="w-7 shrink-0" />}

      <div className="relative max-w-[72%]">
        {/* Pinned indicator */}
        {msg.is_pinned && (
          <div className={`flex items-center gap-1 mb-1 ${isMine ? "justify-end" : "justify-start"}`}>
            <Pin className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] text-amber-500 font-medium">Pinned</span>
          </div>
        )}

        {/* Reaction popup */}
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`absolute ${isMine ? "right-0" : "left-0"} -top-11 flex gap-1 bg-white rounded-2xl shadow-xl border border-slate-100 px-2 py-1.5 z-20`}
            >
              {EMOJI_QUICK.map(e => (
                <button key={e} onClick={() => setShowReactions(false)} className="text-base hover:scale-125 transition-transform">{e}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions menu */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`absolute ${isMine ? "right-0" : "left-0"} -top-2 translate-y-[-100%] bg-white rounded-2xl shadow-xl border border-slate-100 py-1 z-30 min-w-[130px]`}
            >
              {ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors ${action.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700"}`}
                >
                  <action.icon className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product share card */}
        {msg.message_type === "product_share" && msg.product_data && (
          <div className={`mb-1 rounded-2xl overflow-hidden border ${isMine ? "border-indigo-400/40" : "border-slate-200"}`}>
            <div className={`flex items-center gap-2 p-2.5 ${isMine ? "bg-indigo-500" : "bg-slate-50"}`}>
              {msg.product_data.image && (
                <img src={msg.product_data.image} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold truncate ${isMine ? "text-white" : "text-slate-800"}`}>{msg.product_data.title}</p>
                <p className={`text-xs font-bold ${isMine ? "text-indigo-200" : "text-indigo-600"}`}>${msg.product_data.price}</p>
              </div>
              <Link to={createPageUrl("ProductDetail") + `?id=${msg.product_id}`}>
                <button className={`shrink-0 text-xs px-2 py-1 rounded-lg font-semibold ${isMine ? "bg-white/20 text-white" : "bg-indigo-600 text-white"}`}>View</button>
              </Link>
            </div>
          </div>
        )}

        {/* Offer card */}
        {msg.message_type === "offer" && (
          <div className={`mb-1 p-3 rounded-2xl border-2 border-dashed ${isMine ? "border-indigo-400/60 bg-indigo-500" : "border-indigo-300 bg-indigo-50"}`}>
            <p className={`text-xs font-semibold ${isMine ? "text-indigo-100" : "text-indigo-700"}`}>💰 Price Offer</p>
            <p className={`text-xl font-bold ${isMine ? "text-white" : "text-indigo-900"}`}>${msg.offer_amount}</p>
            {!isMine && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => acceptOfferMutation.mutate()}
                  disabled={acceptOfferMutation.isPending || declineOfferMutation.isPending}
                  className="flex-1 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {acceptOfferMutation.isPending ? "..." : "Accept"}
                </button>
                <button
                  onClick={() => declineOfferMutation.mutate()}
                  disabled={acceptOfferMutation.isPending || declineOfferMutation.isPending}
                  className="flex-1 py-1 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {declineOfferMutation.isPending ? "..." : "Decline"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Image message */}
        {msg.message_type === "image" && msg.image_url && (
          <div className={`mb-1 rounded-2xl overflow-hidden ${isMine ? "border border-indigo-400/40" : "border border-slate-200"}`}>
            <img
              src={msg.image_url}
              alt="Shared image"
              className="max-w-[240px] w-full object-cover rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(msg.image_url, "_blank")}
            />
          </div>
        )}

        {/* Reply context */}
        {msg.reply_to_content && (
          <div className={`mb-1 px-3 py-1.5 rounded-xl border-l-2 ${isMine ? "bg-indigo-500/30 border-indigo-200" : "bg-slate-100 border-slate-300"}`}>
            <p className={`text-[10px] font-semibold ${isMine ? "text-indigo-200" : "text-slate-500"}`}>{msg.reply_to_name || "Reply"}</p>
            <p className={`text-[11px] truncate ${isMine ? "text-indigo-100" : "text-slate-600"}`}>{msg.reply_to_content}</p>
          </div>
        )}

        {/* Message bubble */}
        {editing ? (
          <div className="flex gap-2">
            <input
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") editMutation.mutate(editText);
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-indigo-300 outline-none bg-white"
            />
            <button onClick={() => editMutation.mutate(editText)} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-xl font-semibold">Save</button>
            <button onClick={() => setEditing(false)} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-xl">Cancel</button>
          </div>
        ) : (
          <div
            onDoubleClick={() => setShowReactions(v => !v)}
            onClick={() => setShowActions(false)}
            className={`px-4 py-2.5 rounded-2xl text-sm cursor-pointer select-none ${
              isMine
                ? "bg-indigo-600 text-white rounded-br-sm"
                : "bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm"
            }`}
          >
            {msg.content && <p className="leading-relaxed">{msg.content}</p>}
            {msg.is_edited && <span className={`text-[9px] italic ${isMine ? "text-indigo-200" : "text-slate-400"}`}> (edited)</span>}
            <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${isMine ? "text-indigo-200 justify-end" : "text-slate-400"}`}>
              {new Date(msg.created_at || msg.created_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              {isMine && <CheckCheck className={`w-3 h-3 ${msg.is_read ? "text-blue-300" : "text-indigo-300"}`} />}
            </div>
          </div>
        )}

        {/* Order status card (when offer was accepted and order_id is attached) */}
        {msg.order_id && (
          <OrderStatusCard orderId={msg.order_id} isVendor={isMine} />
        )}

        {/* Hover actions row */}
        <div className={`hidden group-hover:flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
          <button onClick={() => setShowReactions(v => !v)} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <Smile className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <button onClick={() => onReply?.(msg)} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <Reply className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <button onClick={() => setShowActions(v => !v)} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
}