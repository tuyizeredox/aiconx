import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, X } from "lucide-react";

const EMOJI_CATEGORIES = [
  {
    label: "😀",
    name: "Smileys",
    emojis: [
      "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰",
      "😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏",
      "😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠",
      "😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥",
      "😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐",
      "🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻",
      "💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"
    ]
  },
  {
    label: "👋",
    name: "Gestures",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆",
      "👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅",
      "🤳","💪","🦾","🦵","🦿","🦶","👣","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴",
      "👀","👁️","👅","👄","💋","🩸"
    ]
  },
  {
    label: "🐶",
    name: "Animals",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈",
      "🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛",
      "🦋","🐌","🐞","🐜","🦟","🦗","🕷️","🕸️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑",
      "🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧"
    ]
  },
  {
    label: "🍎",
    name: "Food",
    emojis: [
      "🍎","🍏","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝",
      "🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐",
      "🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭",
      "🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🍝","🍜","🍲"
    ]
  },
  {
    label: "⚽",
    name: "Activities",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍",
      "🏏","🪃","🥅","⛳","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌",
      "🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","🤺","⛹️","🤾","🏌️","🏇","🧘","🏄","🏊","🤽"
    ]
  },
  {
    label: "💡",
    name: "Objects",
    emojis: [
      "💡","🔦","🏮","🪔","📱","💻","🖥️","🖨️","⌨️","🖱️","🖲️","💽","💾","💿","📀","🧮",
      "🎥","📷","📸","📹","📼","🔍","🔎","🕯️","💰","💳","💎","⚖️","🔧","🔨","⚒️","🛠️",
      "🗡️","⚔️","🔫","🏹","🛡️","🔮","🧿","📿","💈","⚗️","🔭","🔬","🕳️","🩹","🩺","💊"
    ]
  },
  {
    label: "🌍",
    name: "Nature",
    emojis: [
      "🌍","🌎","🌏","🌐","🗺️","🗾","🧭","🏔️","⛰️","🌋","🗻","🏕️","🏖️","🏜️","🏝️","🏞️",
      "🏟️","🏛️","🏗️","🧱","🏘️","🏚️","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪",
      "🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪","🕌","🛕","🕍","⛩️","🕋","⛲","⛺"
    ]
  },
  {
    label: "💖",
    name: "Symbols",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖",
      "💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈",
      "♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️",
      "📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","🉑","💮","🉐","㊙️","㊗️","🈴","🈵"
    ]
  }
];

export default function StandaloneEmojiPicker({ enabled = true, onEmojiSelect = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState("Smileys");
  const [copiedEmoji, setCopiedEmoji] = useState(null);
  const buttonRef = useRef(null);

  // Copy emoji to clipboard
  const handleEmojiClick = (emoji) => {
    if (onEmojiSelect) {
      onEmojiSelect(emoji);
      setIsOpen(false);
    } else {
      navigator.clipboard.writeText(emoji);
      setCopiedEmoji(emoji);
      setTimeout(() => setCopiedEmoji(null), 1000);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!enabled) return null;

  return (
    <div className="relative flex items-center justify-center" ref={buttonRef}>
      {/* Emoji Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
          isOpen
            ? "bg-orange-500 text-white"
            : "text-slate-400 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600"
        }`}
        title="Emoji Picker"
      >
        <Smile className="w-5 h-5" />
      </button>

      {/* Emoji Picker Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 bottom-full mb-2 z-[200] w-72 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Emoji Picker</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 border-b border-slate-100 dark:border-slate-700 overflow-x-auto scrollbar-none">
              {EMOJI_CATEGORIES.map(cat => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setCategory(cat.name)}
                  title={cat.name}
                  className={`flex-shrink-0 text-lg px-2 py-1 rounded-lg transition-colors ${
                    category === cat.name
                      ? "bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900/40 dark:to-pink-900/40"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Emoji grid */}
            <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto">
              {(EMOJI_CATEGORIES.find(c => c.name === category)?.emojis ?? EMOJI_CATEGORIES[0].emojis).map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-xl p-1.5 hover:bg-gradient-to-br hover:from-orange-50 hover:to-pink-50 dark:hover:from-orange-900/20 dark:hover:to-pink-900/20 rounded-lg transition-all relative group"
                  title="Click to copy"
                >
                  {emoji}
                  {copiedEmoji === emoji && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 bg-green-500/20 rounded-lg flex items-center justify-center"
                    >
                      <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                    </motion.div>
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700">
              <p className="text-[10px] text-slate-400 text-center">{onEmojiSelect ? "Click to insert emoji" : "Click to copy to clipboard"}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
