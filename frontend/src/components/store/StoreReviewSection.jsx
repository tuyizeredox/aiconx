import React, { useState } from "react";
import { reviewsAPI, storesAPI } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ThumbsUp, MessageSquare, Send, Loader2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function StarRating({ value, onChange, size = 5, readonly = false }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(s)}
          onMouseEnter={() => !readonly && setHovered(s)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={readonly ? "cursor-default" : "cursor-pointer"}
        >
          <Star
            className={`w-${size} h-${size} transition-colors ${
              s <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "fill-slate-100 dark:fill-slate-700 text-slate-200 dark:text-slate-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function RatingBreakdown({ reviews }) {
  const { t } = useTranslation();
  const counts = [5, 4, 3, 2, 1].map(r => ({
    star: r,
    count: reviews.filter(rv => rv.rating === r).length,
  }));
  const total = reviews.length;
  const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;

  return (
    <div className="flex items-center gap-5 p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl mb-5">
      <div className="text-center shrink-0">
        <p className="text-4xl font-black text-slate-900 dark:text-white">{avg.toFixed(1)}</p>
        <StarRating value={Math.round(avg)} readonly size={4} />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("storeDetail.reviewsTotal", { count: total })}</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {counts.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 w-3">{star}</span>
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: total ? `${(count / total) * 100}%` : "0%" }}
              />
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 w-4">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review, isVendor, vendorUsername, storeId }) {
  const { t, i18n } = useTranslation();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState(review.vendor_reply || "");
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const reviewId = review._id || review.id;

  const replyMutation = useMutation({
    mutationFn: () => reviewsAPI.update(reviewId, {
      vendor_reply: replyText,
      vendor_replied_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      toast.success(t("storeDetail.replyPosted"));
      setShowReply(false);
      queryClient.invalidateQueries({ queryKey: ["storeReviews", storeId] });
    },
  });

  const helpfulMutation = useMutation({
    mutationFn: () => reviewsAPI.update(reviewId, {
      helpful_count: (review.helpful_count || 0) + 1,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storeReviews", storeId] }),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {review.reviewer_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{review.reviewer_name || t("storeDetail.anonymous")}</p>
            <div className="flex items-center gap-2">
              <StarRating value={review.rating} readonly size={3} />
              {review.is_verified_purchase && (
                <Badge className="text-[9px] bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-0 px-1.5 py-0">✓ {t("common.verified")}</Badge>
              )}
            </div>
          </div>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
          {new Date(review.created_at).toLocaleDateString(i18n.language, { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {review.title && <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{review.title}</p>}
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{review.content}</p>

      {/* Vendor reply */}
      {review.vendor_reply && (
        <div className="mt-3 bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-800 rounded-xl p-3">
          <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> {t("storeDetail.vendorResponse")}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{review.vendor_reply}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50 dark:border-slate-700">
        <button
          onClick={() => helpfulMutation.mutate()}
          className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          {t("storeDetail.helpful", { count: review.helpful_count || 0 })}
        </button>

        {isVendor && !review.vendor_reply && (
          <button
            onClick={() => setShowReply(v => !v)}
            className="flex items-center gap-1 text-xs text-orange-600 font-medium hover:text-orange-800"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {t("storeDetail.reply")}
          </button>
        )}
        {isVendor && review.vendor_reply && (
          <button
            onClick={() => setShowReply(v => !v)}
            className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <Edit3 className="w-3.5 h-3.5" /> {t("storeDetail.editReply")}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showReply && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3">
            <Textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={t("storeDetail.replyPlaceholder")}
              className="text-sm rounded-xl mb-2 min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button onClick={() => replyMutation.mutate()} disabled={!replyText.trim() || replyMutation.isPending} size="sm" className="bg-orange-600 hover:bg-orange-700 rounded-xl">
                {replyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                {t("storeDetail.postReply")}
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowReply(false)}>{t("common.cancel")}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function StoreReviewSection({ store, currentUser }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rating: 0, title: "", content: "" });
  const queryClient = useQueryClient();

  const isVendor = currentUser?.username === store?.owner_username;
  const canReview = currentUser && !isVendor;

  const { data: response, isLoading } = useQuery({
    queryKey: ["storeReviews", store?.id],
    queryFn: () => reviewsAPI.list({ store_id: store.id, sort: "-created_at", limit: 50 }),
    enabled: !!store?.id,
  });

  const reviews = response?.data || response?.reviews || [];

  const alreadyReviewed = reviews.some(r => r.reviewer_username === currentUser?.username);

  const submitMutation = useMutation({
    mutationFn: () => reviewsAPI.create({
      store_id: store.id,
      store_name: store.name,
      vendor_username: store.owner_username,
      reviewer_username: currentUser.username,
      reviewer_name: currentUser.display_name || currentUser.username,
      rating: form.rating,
      title: form.title,
      content: form.content,
      helpful_count: 0,
    }),
    onSuccess: async () => {
      toast.success(t("storeDetail.reviewSubmittedToast"));
      setShowForm(false);
      setForm({ rating: 0, title: "", content: "" });
      // Update store rating_avg
      const newAvg = reviews.length
        ? (reviews.reduce((s, r) => s + r.rating, 0) + form.rating) / (reviews.length + 1)
        : form.rating;
      await storesAPI.update(store.id, { rating_avg: parseFloat(newAvg.toFixed(1)) });
      queryClient.invalidateQueries({ queryKey: ["storeReviews", store.id] });
      queryClient.invalidateQueries({ queryKey: ["storeDetail", store.id] });
    },
  });

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("storeDetail.storeReviews")}</h2>
        {canReview && !alreadyReviewed && (
          <Button onClick={() => setShowForm(v => !v)} size="sm" className="bg-orange-600 hover:bg-orange-700 rounded-xl gap-1.5">
            <Star className="w-4 h-4" /> {t("storeDetail.writeReview")}
          </Button>
        )}
        {alreadyReviewed && <Badge variant="secondary" className="text-xs">{t("storeDetail.youReviewedStore")}</Badge>}
      </div>
      
      {reviews.length > 0 && <RatingBreakdown reviews={reviews} />}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-white dark:bg-slate-800 rounded-2xl border border-orange-100 dark:border-slate-700 p-5 mb-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">{t("storeDetail.yourReview")}</h3>
            <div className="mb-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">{t("storeDetail.rating")}</p>
              <StarRating value={form.rating} onChange={r => setForm(f => ({ ...f, rating: r }))} size={6} />
            </div>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t("storeDetail.reviewTitlePlaceholder")}
              className="rounded-xl mb-2 text-sm"
            />
            <Textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder={t("storeDetail.reviewContentPlaceholder")}
              className="rounded-xl text-sm min-h-[100px] mb-3"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={form.rating === 0 || !form.content.trim() || submitMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 rounded-xl"
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                {t("storeDetail.submitReview")}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <Star className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("storeDetail.noReviewsYet")}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t("storeDetail.beFirstToReview")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <ReviewCard
              key={review._id || review.id}
              review={review}
              isVendor={isVendor}
              vendorUsername={store?.owner_username}
              storeId={store?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}