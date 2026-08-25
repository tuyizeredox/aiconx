import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleQuestion, Loader2, Trash2, BadgeCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { productQuestionsAPI } from "@/api/apiClient";
import { timeAgo } from "@/lib/timeAgo";

const MIN_QUESTION_LENGTH = 5;

function AnswerForm({ questionId, onAnswered }) {
  const { t } = useTranslation();
  const [answer, setAnswer] = useState("");

  const mutation = useMutation({
    mutationFn: () => productQuestionsAPI.answer(questionId, answer.trim()),
    onSuccess: () => {
      setAnswer("");
      toast.success(t("product.answerPosted"));
      onAnswered();
    },
    onError: (error) => toast.error(error?.message || t("product.answerFailed")),
  });

  return (
    <div className="mt-3 pl-4 border-l-2 border-orange-100 dark:border-orange-900">
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={t("product.answerPlaceholder")}
        maxLength={2000}
        className="min-h-[72px] text-sm rounded-xl"
      />
      <Button
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={!answer.trim() || mutation.isPending}
        className="mt-2 rounded-xl bg-orange-600 hover:bg-orange-700 gap-1.5"
      >
        {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        {t("product.postAnswer")}
      </Button>
    </div>
  );
}

/**
 * Public Q&A for a product. Only the seller can answer — buyers reading this
 * are weighing a purchase, so an answer carries weight only if it comes from
 * whoever actually ships the thing.
 */
export default function ProductQuestions({ productId, product, currentUser, onCountChange }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const isVendor = !!currentUser?.username && currentUser.username === product?.vendor_username;

  const { data, isLoading } = useQuery({
    queryKey: ["productQuestions", productId],
    queryFn: () => productQuestionsAPI.listForProduct(productId, { limit: 50 }),
    enabled: !!productId,
  });

  const questions = Array.isArray(data?.data) ? data.data : [];

  React.useEffect(() => {
    onCountChange?.({ total: data?.total || 0, answered: data?.answered || 0 });
  }, [data?.total, data?.answered, onCountChange]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["productQuestions", productId] });

  const askMutation = useMutation({
    mutationFn: () => productQuestionsAPI.ask({ product_id: productId, question: draft.trim() }),
    onSuccess: () => {
      setDraft("");
      toast.success(t("product.questionPosted"));
      refresh();
    },
    onError: (error) => toast.error(error?.message || t("product.questionFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => productQuestionsAPI.delete(id),
    onSuccess: () => {
      toast.success(t("product.questionDeleted"));
      refresh();
    },
    onError: (error) => toast.error(error?.message || t("product.questionDeleteFailed")),
  });

  return (
    <div>
      {/* Ask box — the vendor answers here rather than asks, so they get the
          list without a box they can't use. */}
      {currentUser && !isVendor && (
        <div className="bg-slate-50 dark:bg-ink-800/50 rounded-2xl p-3.5 mb-5">
          <p className="text-sm font-bold text-slate-800 dark:text-ink-200 mb-2">{t("product.askAboutProduct")}</p>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("product.questionPlaceholder")}
            maxLength={500}
            className="min-h-[76px] text-sm rounded-xl bg-white dark:bg-ink-900"
          />
          <div className="flex items-center justify-between gap-3 mt-2">
            <p className="text-[11px] text-slate-400 dark:text-ink-500">{t("product.questionPublicNote")}</p>
            <Button
              size="sm"
              onClick={() => askMutation.mutate()}
              disabled={draft.trim().length < MIN_QUESTION_LENGTH || askMutation.isPending}
              className="rounded-xl bg-orange-600 hover:bg-orange-700 gap-1.5 shrink-0"
            >
              {askMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {t("product.postQuestion")}
            </Button>
          </div>
        </div>
      )}

      {!currentUser && (
        <p className="text-sm text-slate-500 dark:text-ink-400 mb-5">{t("product.signInToAsk")}</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 dark:border-ink-700 rounded-2xl">
          <MessageCircleQuestion className="w-9 h-9 text-slate-200 dark:text-ink-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-ink-300">{t("product.noQuestionsYet")}</p>
          <p className="text-xs text-slate-400 dark:text-ink-500 mt-1">{t("product.noQuestionsDesc")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map(question => {
            const canDelete = currentUser
              && (currentUser.username === question.asker_username || isVendor);
            return (
              <div
                key={question.id || question._id}
                className="bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-800 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                      <span className="text-orange-600 font-black mr-1.5">Q.</span>
                      {question.question}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-ink-500 mt-1">
                      {question.asker_name || question.asker_username} · {timeAgo(question.created_at, i18n.language)}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => deleteMutation.mutate(question.id || question._id)}
                      disabled={deleteMutation.isPending}
                      className="text-slate-300 dark:text-ink-600 hover:text-red-500 transition-colors shrink-0"
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {question.answer ? (
                  <div className="mt-3 bg-slate-50 dark:bg-ink-800/60 rounded-xl p-3">
                    <p className="text-sm text-slate-700 dark:text-ink-200 break-words">
                      <span className="text-green-600 font-black mr-1.5">A.</span>
                      {question.answer}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-ink-500 mt-1.5 flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3 text-green-600" />
                      {t("product.answeredBySeller", { store: product?.store_name || question.vendor_username })}
                      {question.answered_at ? ` · ${timeAgo(question.answered_at, i18n.language)}` : ""}
                    </p>
                  </div>
                ) : isVendor ? (
                  <AnswerForm questionId={question.id || question._id} onAnswered={refresh} />
                ) : (
                  <p className="mt-2 text-xs text-slate-400 dark:text-ink-500 italic">{t("product.awaitingAnswer")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
