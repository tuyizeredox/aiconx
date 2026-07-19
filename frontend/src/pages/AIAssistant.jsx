import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { createPageUrl } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Sparkles, Send, Star, ChevronRight,
  Loader2, Bot, User, RefreshCw, Mic, MicOff, Plus, ArrowLeft
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { authAPI, aiAPI, cartAPI } from "@/api/apiClient";
import { useTranslation } from "react-i18next";
import OrderStatusCard from "@/components/chat/OrderStatusCard";
import SmartActionChips from "@/components/chat/SmartActionChips";
import { useVoiceInput } from "@/hooks/useVoiceInput";

const CHAT_STORAGE_KEY = "aicon_chat_history";

const getWelcomeMessage = (t) => ({
  id: "welcome",
  role: "assistant",
  content: t("ai.welcomeMessage"),
  timestamp: new Date().toISOString(),
});

const loadChatHistory = (t) => {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [getWelcomeMessage(t)];
};

const saveChatHistory = (messages) => {
  try {
    const serializable = messages.map(m => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    }));
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(serializable));
  } catch (_) {}
};

function ProductRecommendation({ product, onAddToCart, isAdding }) {
  const discount = product.compare_at_price > 0
    ? Math.round((1 - product.price / product.compare_at_price) * 100) : 0;

  return (
    <div className="group relative">
      <Link to={createPageUrl("ProductDetail") + `?id=${product.id}`}>
        <motion.div
          whileHover={{ y: -2 }}
          className="flex gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 hover:shadow-md transition-all"
        >
          <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
            <img src={product.images?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200"} alt={product.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            {discount > 0 && (
              <div className="absolute top-1 left-1 bg-red-500 text-white text-[8px] font-bold px-1 rounded">-{discount}%</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{product.store_name}</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">{product.title}</p>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-orange-600">${product.price?.toFixed(2)}</span>
                {product.compare_at_price > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 line-through">${product.compare_at_price?.toFixed(2)}</span>
                )}
              </div>
              {product.rating_avg > 0 && (
                <div className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{product.rating_avg?.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 self-center shrink-0" />
        </motion.div>
      </Link>
      <Button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAddToCart(product);
        }}
        disabled={isAdding}
        size="sm"
        className="absolute -right-2 -top-2 w-8 h-8 rounded-full p-0 bg-orange-600 hover:bg-orange-700 shadow-lg scale-0 group-hover:scale-100 transition-transform flex items-center justify-center"
      >
        {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-4 h-4" />}
      </Button>
    </div>
  );
}

function ChatMessage({ message, onAddToCart, addingProductId }) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const actions = message.actions || [];
  const displayContent = message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser
          ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white"
          : "bg-gradient-to-br from-pink-500 to-orange-600 text-white"
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[80%] space-y-3 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-gradient-to-br from-orange-600 to-orange-700 text-white"
            : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
        }`}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{displayContent}</p>
          ) : (
            <ReactMarkdown
              className="text-sm leading-relaxed prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_ul]:my-1 [&_li]:my-0.5"
            >
              {displayContent}
            </ReactMarkdown>
          )}
        </div>

        {/* Actions Rendering */}
        {actions.map((action, idx) => (
          <div key={idx} className="w-full">
            {action.type === 'ORDER_CARD' && (
              <OrderStatusCard orderId={action.id} />
            )}
          </div>
        ))}

        {message.products?.length > 0 && (
          <div className="w-full space-y-2">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium px-1">{t("ai.recommendedForYou")}</p>
            {message.products.map(p => (
              <ProductRecommendation 
                key={p.id} 
                product={p} 
                onAddToCart={onAddToCart}
                isAdding={addingProductId === p.id}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-600 flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            className="w-1.5 h-1.5 rounded-full bg-slate-400"
          />
        ))}
      </div>
    </div>
  );
}

export default function AIAssistant({ embedded = false }) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState(() => loadChatHistory(t));
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const handleVoiceResult = useCallback((transcript) => {
    setInput(prev => prev + (prev ? " " : "") + transcript);
  }, []);

  const { isSupported: isVoiceSupported, isListening, toggleListening } = useVoiceInput({
    language: i18n.language,
    onResult: handleVoiceResult,
  });

  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  const addToCartMutation = useMutation({
    mutationFn: (product) => cartAPI.add({ product_id: product.id, quantity: 1 }),
    onSuccess: () => {
      toast.success(t("ai.addedToCart"));
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (error) => {
      toast.error(error.message || t("ai.failedToAddToCart"));
    }
  });

  const handleAddToCart = (product) => {
    addToCartMutation.mutate(product);
  };

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    authAPI.me().then(res => setCurrentUser(res.data || res)).catch(() => {});
  }, []);

  // Proactive Initialization
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === "welcome" && currentUser) {
      const initAssistant = async () => {
        setIsLoading(true);
        try {
          const res = await aiAPI.assistant("", [], true, i18n.language);
          const data = res.data || res;
          if (data.reply) {
            const aiMsg = {
              id: "init-" + Date.now(),
              role: "assistant",
              content: data.reply,
              actions: data.actions || [],
              products: data.products || [],
              timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, aiMsg]);
          }
        } catch (e) {
          console.error("Proactive AI Init Error:", e);
        } finally {
          setIsLoading(false);
        }
      };
      initAssistant();
    }
  }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (userMessage) => {
    if (!userMessage.trim() || isLoading) return;

    const userMsg = { id: Date.now(), role: "user", content: userMessage, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const history = messages
      .filter(m => m.id !== "welcome")
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await aiAPI.assistant(userMessage, history, false, i18n.language);
      const data = res.data || res;
      const aiMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.reply || t("ai.emptyResponse"),
        actions: data.actions || [],
        products: data.products || [],
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error("Aicon AI Assistant Error:", e);
      const errorMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: t("ai.errorResponse"),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt) => sendMessage(prompt);
  const clearChat = () => {
    const fresh = [getWelcomeMessage(t)];
    setMessages(fresh);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  return (
    <div className={
      embedded
        ? "flex flex-col h-[70vh] min-h-[420px] rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
        : "max-w-2xl mx-auto flex flex-col h-[calc(100vh-56px-5rem)] lg:h-screen"
    }>
      {/* Header */}
      <div className="px-4 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {!embedded && (
            <Link to={createPageUrl("Home")} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0" aria-label={t("common.backTo", { page: t("nav.home") })}>
              <ArrowLeft className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </Link>
          )}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">{t("ai.title")}</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("ai.status")}</p>
            </div>
          </div>
        </div>
        <button onClick={clearChat} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title={t("ai.clearChat")}>
          <RefreshCw className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <ChatMessage 
              key={msg.id} 
              message={msg} 
              onAddToCart={handleAddToCart}
              addingProductId={addToCartMutation.isPending ? addToCartMutation.variables?.id : null}
            />
          ))}
        </AnimatePresence>
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Smart Action Chips */}
      {!isLoading && (
        <div className="px-4 pb-2">
          <SmartActionChips onChipClick={handleQuickPrompt} />
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder={t("ai.placeholder")}
            className="flex-1 min-w-0 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-sm dark:text-slate-200 dark:placeholder:text-slate-500"
            disabled={isLoading}
          />
          <Button
            onClick={toggleListening}
            disabled={isLoading || !isVoiceSupported}
            variant="outline"
            title={isVoiceSupported ? undefined : t("ai.voiceUnsupported")}
            aria-label={isListening ? t("ai.stopListening") : t("ai.startListening")}
            className={`w-10 h-10 rounded-2xl p-0 shrink-0 transition-all disabled:opacity-40 ${
              isListening ? "bg-red-50 dark:bg-red-950 text-red-600 border-red-200 dark:border-red-800" : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            {isListening ? (
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <MicOff className="w-4 h-4" />
              </motion.div>
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-600 to-purple-600 hover:from-orange-700 hover:to-purple-700 p-0 shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center mt-2">{t("ai.poweredBy")}</p>
      </div>
    </div>
  );
}
