import { formatCurrency } from "@/lib/utils";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Send, ArrowLeft, MoreVertical, X,
  ShoppingBag, Star, Package, Loader2, Reply, PenSquare, CheckCheck, Trash2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import MessageBubble from "@/components/chat/MessageBubble";
import ChatImageUpload from "@/components/chat/ChatImageUpload";
import StandaloneEmojiPicker from "@/components/chat/StandaloneEmojiPicker";
import IncomingCallOverlay from "@/components/chat/IncomingCallOverlay";
import ActiveCallScreen from "@/components/chat/ActiveCallScreen";
import { authAPI, productsAPI, messagesAPI, ordersAPI, usersAPI, callsAPI } from "@/api/apiClient";
import { useSocket } from "@/lib/SocketContext";

const EMOJI_QUICK = ["❤️", "😂", "🔥", "👍", "😍", "💯", "🎉", "😎", "✨", "🙌", "🤔", "👏", "🚀", "💡", "✅", "❌"];

function Avatar({ name, size = 10 }) {
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
      {name?.[0]?.toUpperCase() || "U"}
    </div>
  );
}

function ProductSharePicker({ onShare, onClose, currentUser }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all"); // "all" | "mine"

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ["quickProducts"],
    queryFn: async () => {
      const res = await productsAPI.list({ status: "active", sort: "-sales_count", limit: 30 });
      return res.data || [];
    },
  });

  const { data: myProducts = [] } = useQuery({
    queryKey: ["myQuickProducts", currentUser?.username],
    queryFn: async () => {
      const res = await productsAPI.list({ vendor_username: currentUser.username, status: "active", sort: "-created_date", limit: 30 });
      return res.data || [];
    },
    enabled: !!currentUser?.username,
  });

  const source = tab === "mine" ? myProducts : allProducts;
  const products = search ? source.filter(p => p.title?.toLowerCase().includes(search.toLowerCase())) : source.slice(0, 18);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-3 z-20"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-white">{t("chat.shareProductTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <div className="flex gap-1 mb-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
        <button onClick={() => setTab("all")} className={`flex-1 text-xs py-1 rounded-lg font-medium transition-colors ${tab === "all" ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}>{t("chat.allProducts")}</button>
        <button onClick={() => setTab("mine")} className={`flex-1 text-xs py-1 rounded-lg font-medium transition-colors ${tab === "mine" ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}>{t("chat.myStore")}</button>
      </div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t("chat.searchProductsPlaceholder")}
        className="w-full text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2.5 py-1.5 mb-2 outline-none focus:border-orange-300 dark:text-white dark:placeholder:text-slate-400"
      />
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : products.length === 0 ? (
        <p className="text-center py-4 text-xs text-slate-400">{t("chat.noProductsFound")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
          {products.map(p => (
            <button key={p.id} onClick={() => onShare(p)} className="text-left hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-xl p-1.5 transition-colors border border-transparent hover:border-orange-100 dark:hover:border-orange-800">
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 mb-1">
                {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-300 m-auto mt-2" />}
              </div>
              <p className="text-[10px] text-slate-700 dark:text-slate-300 line-clamp-2 font-medium">{p.title}</p>
              <p className="text-[10px] font-bold text-orange-600">{formatCurrency(p.price)}</p>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function OfferModal({ onSend, onClose }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-4 z-20"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-white">{t("chat.makeOfferTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t("chat.enterPriceOffer")}</p>
      <div className="flex gap-2">
        <Input type="number" placeholder="RWF 0" value={amount} onChange={e => setAmount(e.target.value)} className="rounded-xl" />
        <Button onClick={() => { onSend(parseFloat(amount)); onClose(); }} disabled={!amount} className="bg-orange-600 hover:bg-orange-700 rounded-xl shrink-0">{t("chat.send")}</Button>
      </div>
    </motion.div>
  );
}

export default function Chat() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const toUsername = params.get("username") || params.get("to");
  const [selectedConvo, setSelectedConvo] = useState(toUsername || null);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [enableEmojiPicker, setEnableEmojiPicker] = useState(true);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [forwardToUsername, setForwardToUsername] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pendingImageUrl, setPendingImageUrl] = useState(null);
  const [composing, setComposing] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [callStatus, setCallStatus] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [isCaller, setIsCaller] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [userStatus, setUserStatus] = useState({ is_online: false, last_seen_at: null });
  const [otherTyping, setOtherTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const outgoingTypingTimeoutRef = useRef(null);
  const incomingTypingTimeoutRef = useRef(null);
  const queryClient = useQueryClient();
  const { on, emit } = useSocket();
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authAPI.me(),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["unreadMessages", currentUser?.email],
    queryFn: () => messagesAPI.listConversations().then(res => res.data || res || []),
    enabled: !!currentUser?.email,
    refetchInterval: 5000,
  });

  const conversationId = useMemo(() => {
    if (!selectedConvo || !currentUser?.username) return null;
    const parts = [currentUser.username, selectedConvo].sort();
    return `chat_${parts[0]}_${parts[1]}`;
  }, [selectedConvo, currentUser?.username]);

  const { data: conversationMessages = [] } = useQuery({
    queryKey: ["conversationMessages", conversationId],
    queryFn: () => messagesAPI.list(conversationId),
    enabled: !!conversationId,
    refetchInterval: 2000,
  });

  const { data: selectedUserStatus } = useQuery({
    queryKey: ["userStatus", selectedConvo],
    queryFn: () => usersAPI.getStatus(selectedConvo),
    enabled: !!selectedConvo,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: userSearchResults = [] } = useQuery({
    queryKey: ["userSearch", userSearch],
    queryFn: () => usersAPI.search(userSearch),
    enabled: composing && userSearch.trim().length >= 2,
    staleTime: 10000,
  });

  const { data: callHistory = [] } = useQuery({
    queryKey: ["callHistory"],
    queryFn: () => callsAPI.getHistory({ limit: 50 }),
    enabled: !!currentUser?.username,
  });

  const markAsRead = useCallback(async () => {
    if (!selectedConvo || !currentUser?.username) return;
    const parts = [currentUser.username, selectedConvo].sort();
    const cId = `chat_${parts[0]}_${parts[1]}`;
    try {
      await messagesAPI.markConversationAsRead(cId);
      queryClient.invalidateQueries({ queryKey: ["conversationMessages", cId] });
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
    } catch (error) {
      console.error("Failed to mark conversation as read:", error);
    }
  }, [selectedConvo, currentUser, queryClient]);

  useEffect(() => {
    const unsubscribe = on("new-message", (msg) => {
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
      queryClient.invalidateQueries({ queryKey: ["conversationMessages", conversationId] });
      if (selectedConvo && (msg.sender_username === selectedConvo || msg.receiver_username === selectedConvo)) {
        markAsRead();
      }
    });
    return unsubscribe;
  }, [on, queryClient, selectedConvo, markAsRead, conversationId]);

  useEffect(() => {
    const unsubIncoming = on("call:incoming", (data) => {
      setIncomingCall(data.call);
    });
    const unsubAnswered = on("call:answered", (data) => {
      if (activeCall && data.call?._id === activeCall._id) {
        setActiveCall(prev => ({ ...prev, ...data.call }));
      }
    });
    const unsubEnded = on("call:ended", (data) => {
      if (activeCall && data.call?._id === activeCall._id) {
        setCallStatus(null);
        setActiveCall(null);
        setIsCaller(false);
        setIncomingCall(null);
        queryClient.invalidateQueries({ queryKey: ["callHistory"] });
      }
    });
    const unsubRejected = on("call:rejected", (data) => {
      if (activeCall && data.call?._id === activeCall._id) {
        setCallStatus(null);
        setActiveCall(null);
        setIsCaller(false);
        toast.error(t("chat.callRejected"));
      }
    });
    return () => {
      unsubIncoming?.();
      unsubAnswered?.();
      unsubEnded?.();
      unsubRejected?.();
    };
  }, [on, activeCall, queryClient, toast, t]);

  useEffect(() => {
    setOtherTyping(false);
    setUserStatus({ is_online: false, last_seen_at: null });
    if (incomingTypingTimeoutRef.current) clearTimeout(incomingTypingTimeoutRef.current);
  }, [selectedConvo]);

  useEffect(() => {
    if (selectedUserStatus) {
      setUserStatus({
        is_online: selectedUserStatus.is_online,
        last_seen_at: selectedUserStatus.last_seen_at,
      });
    }
  }, [selectedUserStatus]);

  useEffect(() => {
    const unsubStatus = on("user:status", (data) => {
      if (data?.username === selectedConvo) {
        setUserStatus({
          is_online: data.is_online,
          last_seen_at: data.last_seen_at,
        });
      }
    });
    const unsubTyping = on("typing", (data) => {
      if (data?.username === selectedConvo && data?.conversationId === conversationId) {
        setOtherTyping(true);
        if (incomingTypingTimeoutRef.current) clearTimeout(incomingTypingTimeoutRef.current);
        incomingTypingTimeoutRef.current = setTimeout(() => {
          setOtherTyping(false);
        }, 5000);
      }
    });
    const unsubStopTyping = on("stop-typing", (data) => {
      if (data?.username === selectedConvo && data?.conversationId === conversationId) {
        setOtherTyping(false);
        if (incomingTypingTimeoutRef.current) clearTimeout(incomingTypingTimeoutRef.current);
      }
    });
    return () => {
      unsubStatus?.();
      unsubTyping?.();
      unsubStopTyping?.();
      if (outgoingTypingTimeoutRef.current) clearTimeout(outgoingTypingTimeoutRef.current);
      if (incomingTypingTimeoutRef.current) clearTimeout(incomingTypingTimeoutRef.current);
    };
  }, [on, selectedConvo, conversationId]);

  // Real-time subscription replaced by refetchInterval

  const selectedMessages = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(conversationMessages) ? conversationMessages : []).filter(m => {
      const id = m._id || m.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [conversationMessages]);

  const sendMutation = useMutation({
    mutationFn: async (msgData) => {
      const recipient = msgData.recipient_username || selectedConvo;
      if (!recipient) {
        toast.error(t("chat.noRecipient"));
        throw new Error("recipient_username is required");
      }
      if (!currentUser?.username) {
        toast.error(t("chat.mustBeLoggedIn"));
        throw new Error("sender_username is required");
      }

      await messagesAPI.send({
        conversation_id: `chat_${[currentUser.username, recipient].sort().join("_")}`,
        sender_username: currentUser.username,
        sender_name: currentUser.display_name || currentUser.full_name,
        recipient_username: recipient,
        ...msgData,
      });
    },
    onMutate: async (msgData) => {
      const recipient = msgData.recipient_username || selectedConvo;
      if (!recipient || !currentUser?.username || !conversationId) return;
      await queryClient.cancelQueries({ queryKey: ["conversationMessages", conversationId] });
      const previousMessages = queryClient.getQueryData(["conversationMessages", conversationId]) || [];
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticMessage = {
        _id: tempId,
        id: tempId,
        conversation_id: conversationId,
        sender_username: currentUser.username,
        sender_name: currentUser.display_name || currentUser.full_name,
        receiver_username: recipient,
        content: msgData.content,
        message_type: msgData.message_type || "text",
        image_url: msgData.image_url,
        product_id: msgData.product_id,
        product_data: msgData.product_data,
        offer_amount: msgData.offer_amount,
        order_id: msgData.order_id,
        reply_to_content: msgData.reply_to_content,
        reply_to_name: msgData.reply_to_name,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pending: true,
      };
      queryClient.setQueryData(["conversationMessages", conversationId], [...previousMessages, optimisticMessage]);
      return { previousMessages };
    },
    onError: (err, msgData, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["conversationMessages", conversationId], context.previousMessages);
      }
      setNewMessage((prev) => prev || msgData.content || "");
      if (msgData.image_url) setPendingImageUrl(msgData.image_url);
      toast.error(t("chat.failedToSend"));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["conversationMessages", conversationId], (old = []) => {
        const list = old.filter(m => !m.pending);
        const exists = list.some(m => (m._id || m.id) === (data?._id || data?.id));
        if (!exists && data) return [...list, data];
        return list;
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["conversationMessages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (username) => {
      const parts = [currentUser.username, username].sort();
      return messagesAPI.deleteConversation(`chat_${parts[0]}_${parts[1]}`);
    },
    onMutate: async (username) => {
      await queryClient.cancelQueries({ queryKey: ["unreadMessages"] });
      const previousConversations = queryClient.getQueryData(["unreadMessages", currentUser?.email]) || [];
      queryClient.setQueryData(
        ["unreadMessages", currentUser?.email],
        previousConversations.filter(c => c.other_user_username !== username)
      );
      return { previousConversations };
    },
    onError: (err, username, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(["unreadMessages", currentUser?.email], context.previousConversations);
      }
      toast.error(t("chat.failedToDeleteConversation"));
    },
    onSuccess: (data, username) => {
      const parts = [currentUser.username, username].sort();
      const cId = `chat_${parts[0]}_${parts[1]}`;
      queryClient.removeQueries({ queryKey: ["conversationMessages", cId] });
      if (selectedConvo === username) setSelectedConvo(null);
      toast.success(t("chat.conversationDeleted"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
    },
  });

  const confirmDeleteConversation = (username, name) => {
    setDeleteConfirm({ username, name: name || username });
  };

  const formatLastSeen = (dateString) => {
    if (!dateString) return t("chat.offline");
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return t("chat.lastSeenJustNow");
    if (diff < 3600) return t("chat.lastSeenMinutes", { count: Math.floor(diff / 60) });
    if (diff < 86400) return t("chat.lastSeenHours", { count: Math.floor(diff / 3600) });
    return t("chat.lastSeenDays", { count: Math.floor(diff / 86400) });
  };

  const emitTyping = useCallback(() => {
    if (!selectedConvo || !conversationId || !currentUser?.username) return;
    emit("typing", { conversationId, toUsername: selectedConvo });
    if (outgoingTypingTimeoutRef.current) clearTimeout(outgoingTypingTimeoutRef.current);
    outgoingTypingTimeoutRef.current = setTimeout(() => {
      emit("stop-typing", { conversationId, toUsername: selectedConvo });
    }, 3000);
  }, [selectedConvo, conversationId, currentUser?.username, emit]);

  const stopTyping = useCallback(() => {
    if (!selectedConvo || !conversationId || !currentUser?.username) return;
    if (outgoingTypingTimeoutRef.current) clearTimeout(outgoingTypingTimeoutRef.current);
    emit("stop-typing", { conversationId, toUsername: selectedConvo });
  }, [selectedConvo, conversationId, currentUser?.username, emit]);

  const handleMessageChange = (e) => {
    setNewMessage(e.target.value);
    emitTyping();
  };

  const handleEmojiSelect = (emoji) => {
    const input = messageInputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? newMessage.length;
    const end = input.selectionEnd ?? newMessage.length;
    const updated = newMessage.slice(0, start) + emoji + newMessage.slice(end);
    setNewMessage(updated);
    setTimeout(() => {
      input.focus();
      const pos = start + emoji.length;
      input.setSelectionRange(pos, pos);
    }, 0);
  };

  const replyContent = (msg) => {
    if (!msg) return "";
    if (msg.content) return msg.content;
    if (msg.message_type === "image") return "📷 Photo";
    if (msg.message_type === "product_share") return `🛍️ ${msg.product_data?.title || "Product"}`;
    if (msg.message_type === "offer") return `💰 Offer: ${msg.offer_amount}`;
    return "Message";
  };

  const sendText = () => {
    if ((!newMessage.trim() && !pendingImageUrl) || !selectedConvo) return;
    const extra = replyingTo ? {
      reply_to_content: replyContent(replyingTo),
      reply_to_name: replyingTo.sender_username === currentUser?.username ? "You" : selectedConvoName,
    } : {};

    const baseMsg = { recipient_username: selectedConvo, ...extra };
    const content = newMessage;
    const imageUrl = pendingImageUrl;

    // Clear the composer immediately so sending feels instant; the optimistic
    // bubble (added in sendMutation.onMutate) shows the message right away.
    setNewMessage("");
    setPendingImageUrl(null);
    setReplyingTo(null);
    stopTyping();

    if (imageUrl) {
      sendMutation.mutate({ ...baseMsg, content: content || "📷 Image", message_type: "image", image_url: imageUrl });
    } else {
      sendMutation.mutate({ ...baseMsg, content, message_type: "text" });
    }
  };

  const handleForward = (msg) => {
    setForwardMsg(msg);
  };

  const executeForward = async () => {
    const recipient = (forwardToUsername || "").trim();
    if (!recipient || !forwardMsg || !currentUser?.username) return;
    try {
      await messagesAPI.send({
        conversation_id: `chat_${[currentUser.username, recipient].sort().join("_")}`,
        sender_username: currentUser.username,
        sender_name: currentUser.display_name || currentUser.full_name,
        recipient_username: recipient,
        content: `Forwarded: ${replyContent(forwardMsg)}`,
        message_type: forwardMsg.message_type === "text" ? "text" : forwardMsg.message_type,
        image_url: forwardMsg.image_url,
        product_id: forwardMsg.product_id,
        product_data: forwardMsg.product_data,
      });
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
      toast.success(t("chat.messageForwarded"));
      setForwardMsg(null);
      setForwardToUsername("");
    } catch (error) {
      toast.error(t("chat.failedToForward"));
    }
  };

  const sendProduct = (product) => {
    if (!selectedConvo) return;
    setShowProductPicker(false);
    sendMutation.mutate({
      recipient_username: selectedConvo,
      content: `Check out this product: ${product.title}`,
      message_type: "product_share",
      product_id: product.id,
      product_data: { title: product.title, price: product.price, image: product.images?.[0] },
    });
  };

  const sendOffer = async (amount, productData) => {
    if (!selectedConvo || !currentUser?.username) return;
    // Create an order for this offer
    let orderId = null;
    try {
      if (productData) {
        const order = await ordersAPI.create({
          buyer_username: currentUser.username,
          buyer_name: currentUser.display_name || currentUser.full_name,
          vendor_username: selectedConvo,
          items: [{ product_id: productData.id, product_title: productData.title, product_image: productData.images?.[0], quantity: 1, price: amount }],
          subtotal: amount,
          total: amount,
          status: "pending",
          payment_status: "pending",
          affiliate_ref: localStorage.getItem('iqon_ref') || undefined,
          affiliate_time: localStorage.getItem('iqon_ref_time') || undefined,
        });
        orderId = order.id;
      }
      sendMutation.mutate({
        recipient_username: selectedConvo,
        content: `💰 Offer: ${formatCurrency(amount)}${productData ? ` for "${productData.title}"` : ""}`,
        message_type: "offer",
        offer_amount: amount,
        order_id: orderId,
      });
    } catch (error) {
      toast.error(t("chat.failedToCreateOffer"));
    }
  };

  const handleAnswerCall = async (callId) => {
    try {
      await callsAPI.answer(callId);
      const call = incomingCall;
      setActiveCall(call);
      setIsCaller(false);
      setIncomingCall(null);
      setCallStatus("active");
    } catch (error) {
      console.error("Failed to answer call:", error);
      toast.error(error.message || t("chat.failedToAnswerCall"));
    }
  };

  const handleRejectCall = async (callId) => {
    try {
      await callsAPI.reject(callId);
      setIncomingCall(null);
      toast.success(t("chat.callRejected"));
    } catch (error) {
      console.error("Failed to reject call:", error);
      toast.error(error.message || t("chat.failedToRejectCall"));
    }
  };

  const handleVoiceCall = async () => {
    if (!selectedConvo || !currentUser?.username) return;
    try {
      setCallStatus("initiating");
      const response = await callsAPI.create({
        callee_username: selectedConvo,
        call_type: "voice",
      });
      setActiveCall(response);
      setIsCaller(true);
      setCallStatus("active");
      toast.success(t("chat.callInitiated"));
    } catch (error) {
      setCallStatus(null);
      setActiveCall(null);
      setIsCaller(false);
      toast.error(error.message || t("chat.failedToInitiateCall"));
    }
  };

  const handleVideoCall = async () => {
    if (!selectedConvo || !currentUser?.username) return;
    try {
      setCallStatus("initiating");
      const response = await callsAPI.create({
        callee_username: selectedConvo,
        call_type: "video",
      });
      setActiveCall(response);
      setIsCaller(true);
      setCallStatus("active");
      toast.success(t("chat.callInitiated"));
    } catch (error) {
      setCallStatus(null);
      setActiveCall(null);
      setIsCaller(false);
      toast.error(error.message || t("chat.failedToInitiateCall"));
    }
  };

  const handleCallEnded = useCallback(() => {
    setCallStatus(null);
    setActiveCall(null);
    setIsCaller(false);
    setIncomingCall(null);
    queryClient.invalidateQueries({ queryKey: ["callHistory"] });
  }, [queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (selectedConvo) markAsRead();
  }, [selectedMessages, selectedConvo]);

  const selectedConvoData = conversations.find(c => c.other_user_username === selectedConvo);
  const selectedConvoName = selectedConvoData?.other_user_name || selectedConvo;
  const unreadTotal = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex bg-white dark:bg-slate-900">
      {/* Sidebar */}
      <div className={`w-full lg:w-80 border-r border-slate-100 dark:border-slate-700 flex flex-col ${selectedConvo ? "hidden lg:flex" : "flex"}`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {t("chat.title")}
              {unreadTotal > 0 && (
                <span className="ml-2 text-xs bg-orange-600 text-white rounded-full px-1.5 py-0.5">{unreadTotal}</span>
              )}
            </h1>
            <button
              onClick={() => { setComposing(v => !v); setUserSearch(""); }}
              className={`p-1.5 rounded-xl transition-colors ${composing ? "bg-orange-100 text-orange-600" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
              title={t("chat.newConversation")}
            >
              <PenSquare className="w-4 h-4" />
            </button>
          </div>

          <AnimatePresence>
            {composing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-3"
              >
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    autoFocus
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder={t("chat.searchByName")}
                    className="pl-8 h-9 rounded-xl text-sm bg-orange-50 dark:bg-orange-950 border-orange-100 dark:border-orange-800 focus:border-orange-300 dark:text-white"
                  />
                </div>
                {userSearch.trim().length >= 2 && (
                  <div className="space-y-0.5">
                    {userSearchResults.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">{t("chat.noUsersFound")}</p>
                    ) : userSearchResults.map(u => (
                      <button
                        key={u.username || u._id}
                        onClick={() => {
                          setSelectedConvo(u.username);
                          setComposing(false);
                          setUserSearch("");
                        }}
                        className="w-full flex items-center gap-2.5 px-2 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-xl transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {(u.display_name || u.username)?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{u.display_name || u.username}</p>
                          <p className="text-xs text-slate-400">@{u.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {userSearch.trim().length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-1">{t("chat.typeToSearch")}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!composing && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t("chat.searchConversations")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl text-sm"
              />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t("chat.noConversations")}</p>
              <p className="text-xs text-slate-400 mt-1">{t("chat.startConversation")}</p>
            </div>
          ) : (
            conversations
              .filter(c => !search || c.other_user_name?.toLowerCase().includes(search.toLowerCase()) || c.other_user_username?.toLowerCase().includes(search.toLowerCase()))
              .map(convo => (
                <div
                  key={convo.other_user_username}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedConvo(convo.other_user_username)}
                  onKeyDown={e => e.key === "Enter" && setSelectedConvo(convo.other_user_username)}
                  className={`group w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left border-b border-slate-50 dark:border-slate-700/50 cursor-pointer ${selectedConvo === convo.other_user_username ? "bg-orange-50 dark:bg-orange-900/30" : ""}`}
                >
                  <div className="relative shrink-0">
                    <Avatar name={convo.other_user_name} size={11} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className={`text-sm truncate ${convo.unread_count > 0 ? "font-bold text-slate-900 dark:text-white" : "font-semibold text-slate-700 dark:text-slate-300"}`}>{convo.other_user_name}</p>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                        {new Date(convo.last_message_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${convo.unread_count > 0 ? "text-slate-700 dark:text-slate-300 font-medium" : "text-slate-400"}`}>
                      {convo.last_message_type === "product_share" ? t("chat.sharedProduct") : convo.last_message_type === "offer" ? t("chat.priceOffer") : convo.last_message_content}
                    </p>
                  </div>
                  {convo.unread_count > 0 && (
                    <div className="bg-orange-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold shrink-0">
                      {convo.unread_count > 9 ? "9+" : convo.unread_count}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); confirmDeleteConversation(convo.other_user_username, convo.other_user_name); }}
                    title={t("chat.deleteConversation")}
                    className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col min-h-0 ${!selectedConvo ? "hidden lg:flex" : "flex"}`}>
        {selectedConvo ? (
          <>
            {/* Header */}
            <div className="h-16 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between px-4 bg-white dark:bg-slate-800 shadow-sm gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button onClick={() => setSelectedConvo(null)} className="lg:hidden p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0">
                  <ArrowLeft className="w-5 h-5 dark:text-slate-300" />
                </button>
                <div className="relative shrink-0">
                  <Avatar name={selectedConvoName} size={9} />
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white dark:border-slate-800 rounded-full ${userStatus.is_online ? "bg-green-400" : "bg-slate-400"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{selectedConvoName}</p>
                  <p className={`text-xs font-medium truncate ${userStatus.is_online ? "text-green-500" : "text-slate-400"}`}>
                    {userStatus.is_online
                      ? t("chat.online")
                      : userStatus.last_seen_at
                        ? t("chat.lastSeen", { time: formatLastSeen(userStatus.last_seen_at) })
                        : t("chat.offline")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 relative shrink-0">
                <button
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  onClick={() => setShowActionMenu(v => !v)}
                >
                  <MoreVertical className="w-5 h-5 text-slate-400" />
                </button>
                <AnimatePresence>
                  {showActionMenu && (
                    <>
                      {/* Backdrop to close on outside click */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowActionMenu(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -6 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xl z-50 overflow-hidden"
                      >
                        <button
                          onClick={() => { setShowActionMenu(false); navigate(`/profile?username=${selectedConvo}`); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                        >
                          <span className="text-base">👤</span> View Profile
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-3" />
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            confirmDeleteConversation(selectedConvo, selectedConvoName);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                        >
                          <span className="text-base">🗑️</span> {t("chat.deleteConversation")}
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-3" />
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            setSelectedConvo(null);
                            toast.success("Conversation closed");
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                        >
                          <span className="text-base">🚫</span> Close Chat
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {otherTyping && (
              <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedConvoName} {t("chat.typing")}
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 bg-slate-50/60 dark:bg-slate-900/60">
              {selectedMessages.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Send className="w-5 h-5 text-slate-300 dark:text-slate-500" />
                  </div>
                  {t("chat.startConversationWith", { name: selectedConvoName })}
                </div>
              )}
              {selectedMessages.map((msg, idx) => {
                const isMine = msg.sender_username === currentUser?.username;
                const prevMsg = selectedMessages[idx - 1];
                const showAvatar = !prevMsg || prevMsg.sender_username !== msg.sender_username;
                return (
                  <MessageBubble
                    key={msg._id || msg.id || `msg-${idx}`}
                    msg={msg}
                    isMine={isMine}
                    showAvatar={showAvatar}
                    senderName={isMine ? currentUser?.full_name : selectedConvoName}
                    currentUser={currentUser}
                    onReply={(m) => setReplyingTo(m)}
                    onForward={handleForward}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
              {/* Reply preview */}
              <AnimatePresence>
                {replyingTo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/30 border-b border-orange-100 dark:border-orange-800"
                  >
                    <Reply className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-orange-500 font-semibold">{t("chat.replyingTo")}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{replyContent(replyingTo)}</p>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                      <X className="w-3 h-3 text-slate-500 dark:text-slate-300" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-3 relative">
                <AnimatePresence>
                  {showProductPicker && <ProductSharePicker onShare={sendProduct} onClose={() => setShowProductPicker(false)} currentUser={currentUser} />}
                  {showOfferModal && <OfferModal onSend={sendOffer} onClose={() => setShowOfferModal(false)} />}
                </AnimatePresence>

                {/* New modern input design */}
                <div className="flex items-end gap-2">
                  {/* Left action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setShowProductPicker(v => !v); setShowOfferModal(false); }}
                      className={`p-2 rounded-full transition-colors ${showProductPicker ? "bg-orange-100 text-orange-600" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"}`}
                      title={t("chat.shareProductTooltip")}
                    >
                      <ShoppingBag className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowOfferModal(v => !v); setShowProductPicker(false); }}
                      className={`p-2 rounded-full transition-colors ${showOfferModal ? "bg-orange-100 text-orange-600" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"}`}
                      title={t("chat.makeAnOffer")}
                    >
                      <Star className="w-5 h-5" />
                    </button>
                    <ChatImageUpload
                      onImageReady={(url) => setPendingImageUrl(url)}
                      onClear={() => setPendingImageUrl(null)}
                      previewUrl={pendingImageUrl}
                    />
                  </div>

                  {/* Input field */}
                  <div 
                    className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-2xl px-3 py-1.5 cursor-text flex items-center gap-2 min-w-0"
                    onClick={() => messageInputRef.current?.focus()}
                  >
                    <input
                      ref={messageInputRef}
                      value={newMessage}
                      onChange={handleMessageChange}
                      placeholder={t("chat.typeMessage")}
                      className="w-full bg-transparent text-sm text-left text-slate-700 dark:text-white placeholder:text-slate-400 outline-none"
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendText()}
                    />
                    <div className="shrink-0" onClick={e => e.stopPropagation()}>
                      <StandaloneEmojiPicker enabled={enableEmojiPicker} onEmojiSelect={handleEmojiSelect} />
                    </div>
                  </div>

                  {/* Send button */}
                  <button
                    type="button"
                    onClick={sendText}
                    disabled={!newMessage.trim() && !pendingImageUrl}
                    className="w-9 h-9 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 transition-colors"
                  >
                    <Send className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

            </div>

            {/* Forward Modal */}
            <AnimatePresence>
              {forwardMsg && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
                  onClick={e => e.target === e.currentTarget && setForwardMsg(null)}
                >
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl"
                  >
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{t("chat.forwardMessage")}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-2 line-clamp-2">{replyContent(forwardMsg)}</p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t("chat.sendTo")}</p>
                    {conversations.length > 0 ? (
                      <div className="space-y-1 max-h-52 overflow-y-auto mb-3">
                        {conversations.map(c => (
                          <button
                            key={c.other_user_username}
                            onClick={() => setForwardToUsername(c.other_user_username || "")}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors text-left border-2 ${
                              forwardToUsername === c.other_user_username
                                ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30"
                                : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                              {(c.other_user_name)?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{c.other_user_name}</p>
                              <p className="text-xs text-slate-400">@{c.other_user_username}</p>
                            </div>
                            {forwardToUsername === c.other_user_username && (
                              <div className="ml-auto w-4 h-4 rounded-full bg-orange-600 flex items-center justify-center shrink-0">
                                <CheckCheck className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4 mb-3">{t("chat.noConversations")}</p>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={() => { setForwardMsg(null); setForwardToUsername(""); }} variant="outline" className="flex-1 rounded-xl" size="sm">{t("chat.cancel")}</Button>
                      <Button onClick={executeForward} disabled={!(forwardToUsername || "").trim()} className="flex-1 bg-orange-600 hover:bg-orange-700 rounded-xl" size="sm">{t("chat.forward")}</Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-100 to-purple-100 dark:from-orange-900 dark:to-purple-900 flex items-center justify-center mx-auto mb-4">
                <Send className="w-9 h-9 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t("chat.yourMessages")}</h3>
              <p className="text-sm text-slate-400">{t("chat.selectConversation")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Call Overlays */}
      <AnimatePresence>
        {incomingCall && (
          <IncomingCallOverlay
            call={incomingCall}
            currentUser={currentUser}
            onAnswer={handleAnswerCall}
            onReject={handleRejectCall}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeCall && (
          <ActiveCallScreen
            call={activeCall}
            currentUser={currentUser}
            isIncoming={!isCaller}
            onEndCall={handleCallEnded}
            onCallEnded={handleCallEnded}
          />
        )}
      </AnimatePresence>

      {/* Delete Conversation Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{t("chat.deleteConversation")}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {t("chat.deleteConversationConfirm", { name: deleteConfirm.name })}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setDeleteConfirm(null)}
                  variant="outline"
                  className="flex-1 rounded-xl"
                  size="sm"
                  disabled={deleteConversationMutation.isPending}
                >
                  {t("chat.cancel")}
                </Button>
                <Button
                  onClick={() => {
                    deleteConversationMutation.mutate(deleteConfirm.username);
                    setDeleteConfirm(null);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl"
                  size="sm"
                  disabled={deleteConversationMutation.isPending}
                >
                  {deleteConversationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("chat.delete")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
