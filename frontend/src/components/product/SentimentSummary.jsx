import React, { useEffect } from "react";
import { sentimentAPI, aiAPI } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, ThumbsUp, ThumbsDown, RefreshCw, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const SENTIMENT_CONFIG = {
  very_positive: { labelKey: "sentiment.overwhelminglyPositive", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500" },
  positive: { labelKey: "sentiment.generallyPositive", color: "text-green-600", bg: "bg-green-50", border: "border-green-200", bar: "bg-green-500" },
  neutral: { labelKey: "sentiment.mixedReviews", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500" },
  negative: { labelKey: "sentiment.generallyNegative", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", bar: "bg-orange-500" },
  very_negative: { labelKey: "sentiment.mostlyNegative", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", bar: "bg-red-500" },
};

export default function SentimentSummary({ productId, reviews }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["sentiment", productId],
    queryFn: async () => {
      const res = await sentimentAPI.list({ product_id: productId, order: "desc", orderBy: "createdAt", limit: 1 });
      return res.data?.[0] || null;
    },
    enabled: !!productId,
  });

  // Auto-generate when reviews >= 3 and no summary exists
  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await aiAPI.generateSentimentSummary({
        productId,
        reviews: reviews.slice(0, 50)
      });

      const payload = {
        product_id: productId,
        ...result,
        review_count_analyzed: reviews.length,
        last_updated: new Date().toISOString(),
      };

      // Update if exists, otherwise create
      if (existing?.id) {
        return await sentimentAPI.update(existing.id, payload);
      } else {
        return await sentimentAPI.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sentiment", productId] });
    },
  });

  useEffect(() => {
    if (reviews.length >= 3 && !existing && !generateMutation.isPending) {
      generateMutation.mutate();
    }
  }, [reviews.length, existing, generateMutation]);

  const isLoading = generateMutation.isPending;

  if (reviews.length < 3) return null;

  if (isLoading && !existing) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
        <div>
          <p className="text-sm font-semibold text-indigo-700">{t("sentiment.analyzing", { count: reviews.length })}</p>
          <p className="text-xs text-indigo-500">{t("sentiment.generating")}</p>
        </div>
      </div>
    );
  }

  if (!existing) return null;

  const cfg = SENTIMENT_CONFIG[existing.overall_sentiment] || SENTIMENT_CONFIG.neutral;
  const score = existing.sentiment_score || 75;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${cfg.bg} border ${cfg.border} rounded-2xl p-5 mb-6`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t("sentiment.title")}</p>
            <p className={`text-sm font-bold ${cfg.color}`}>{t(cfg.labelKey)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-black ${cfg.color}`}>{score}</p>
          <p className="text-[10px] text-slate-400">/ 100</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={`h-full rounded-full ${cfg.bar}`}
        />
      </div>

      {existing.summary_text && (
        <p className="text-xs text-slate-600 leading-relaxed mb-4 italic">"{existing.summary_text}"</p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Pros */}
        {existing.pros?.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700 mb-2">
              <ThumbsUp className="w-3.5 h-3.5" /> {t("sentiment.mostLoved")}
            </p>
            <ul className="space-y-1">
              {existing.pros.map((pro, i) => (
                <li key={`pro-${i}-${pro}`} className="flex items-start gap-1.5 text-xs text-slate-700">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  {pro}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cons */}
        {existing.cons?.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 mb-2">
              <ThumbsDown className="w-3.5 h-3.5" /> {t("sentiment.commonConcerns")}
            </p>
            <ul className="space-y-1">
              {existing.cons.map((con, i) => (
                <li key={`con-${i}-${con}`} className="flex items-start gap-1.5 text-xs text-slate-700">
                  <span className="text-orange-400 mt-0.5 shrink-0">–</span>
                  {con}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/40">
        <p className="text-[10px] text-slate-400">{t("sentiment.basedOn", { count: existing.review_count_analyzed })}</p>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={isLoading}
          className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          {t("sentiment.refresh")}
        </button>
      </div>
    </motion.div>
  );
}