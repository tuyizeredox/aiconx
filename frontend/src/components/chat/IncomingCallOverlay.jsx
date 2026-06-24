import { useState, useEffect, useRef } from "react";
import { Phone, Video, PhoneOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function IncomingCallOverlay({ call, currentUser, onAnswer, onReject }) {
  const [answerLoading, setAnswerLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const ringInterval = useRef(null);
  const [flash, setFlash] = useState(true);

  const callerName = call?.caller_name || call?.caller_username || "Unknown";
  const callerUsername = call?.caller_username;
  const callType = call?.call_type || "voice";

  useEffect(() => {
    ringInterval.current = setInterval(() => {
      setFlash(f => !f);
    }, 1500);
    return () => clearInterval(ringInterval.current);
  }, []);

  const handleAnswer = async () => {
    setAnswerLoading(true);
    try {
      await onAnswer(call._id);
    } catch (err) {
      setAnswerLoading(false);
      console.error("Answer call error:", err);
    }
  };

  const handleReject = async () => {
    setRejectLoading(true);
    try {
      await onReject(call._id);
    } catch (err) {
      setRejectLoading(false);
      console.error("Reject call error:", err);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-lg flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 20 }}
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center relative overflow-hidden"
        >
          {/* Pulse ring animation */}
          {flash && (
            <motion.div
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
              className="absolute top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500"
            />
          )}

          <div className="relative z-10">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg">
              {callerName?.[0]?.toUpperCase() || "U"}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{callerName}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">@{callerUsername}</p>
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider"
            >
              Incoming {callType === "video" ? "Video" : "Voice"} Call
            </motion.p>
          </div>

          <div className="flex items-center justify-center gap-6 mt-8 relative z-10">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleReject}
              disabled={rejectLoading}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg disabled:opacity-50"
            >
              {rejectLoading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PhoneOff className="w-6 h-6 text-white rotate-135" />
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleAnswer}
              disabled={answerLoading}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg disabled:opacity-50"
            >
              {answerLoading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : callType === "video" ? (
                <Video className="w-6 h-6 text-white" />
              ) : (
                <Phone className="w-6 h-6 text-white" />
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default IncomingCallOverlay;
