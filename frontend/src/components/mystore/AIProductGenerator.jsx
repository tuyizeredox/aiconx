import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiAPI } from "@/api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, RefreshCw, Check, ChevronDown, ChevronUp, Lock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "@/components/providers/LanguageContext";

const CATEGORIES = ["fashion", "electronics", "home", "beauty", "sports", "food", "art", "books", "handmade", "other"];

export default function AIProductGenerator({ onApply, plan = 'free', onUpgrade }) {
  const { t } = useTranslation();
  const isFree = plan === 'free';
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("fashion");
  const [keyFeatures, setKeyFeatures] = useState("");
  const [result, setResult] = useState(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!keyFeatures.trim()) throw new Error(t("aiProduct.enterFeaturesFirst"));
      const res = await aiAPI.generateProductContent({
        category,
        keyFeatures,
      });
      return res.data || res;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      if (error.status === 403 || error.message?.toLowerCase().includes("limit") || error.message?.toLowerCase().includes("upgrade")) {
        toast.error(t("aiProduct.premiumFeatureError"), {
          action: {
            label: t("aiProduct.upgradePlan"),
            onClick: () => onUpgrade()
          }
        });
      } else {
        toast.error(error.message || t("aiProduct.failedToGenerate"));
      }
    }
  });

  const generate = () => {
    if (!keyFeatures.trim()) { toast.error(t("aiProduct.enterFeaturesFirst")); return; }
    generateMutation.mutate();
  };

  const apply = () => {
    if (!result) return;
    onApply(result);
    toast.success(t("aiProduct.contentApplied"));
    setOpen(false);
  };

  const generating = generateMutation.isPending;

  return (
    <div className="border border-orange-200 dark:border-orange-900 bg-gradient-to-r from-orange-50 to-orange-50 dark:from-orange-950 dark:to-orange-950 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-purple-900 dark:text-purple-300">{t("aiProduct.title")}</p>
            {isFree && <Lock className="w-3 h-3 text-purple-400" />}
          </div>
          <p className="text-xs text-purple-600 dark:text-purple-400">{t("aiProduct.subtitle")}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-purple-500" /> : <ChevronDown className="w-4 h-4 text-purple-500" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-purple-100 dark:border-purple-900">
              {isFree ? (
                <div className="pt-6 pb-2 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center mx-auto mb-3">
                    <Star className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{t("aiProduct.featuresRestricted")}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-[240px] mx-auto">
                    {t("aiProduct.featuresRestrictedDesc")}
                  </p>
                  <Button 
                    onClick={(e) => {
                      e.preventDefault();
                      onUpgrade();
                    }} 
                    size="sm" 
                    className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 rounded-xl"
                  >
                    {t("aiProduct.upgradePlan")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="pt-3">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">{t("aiProduct.productCategory")}</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="rounded-xl text-sm bg-white dark:bg-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{t(`explore.cat.${c}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                      {t("aiProduct.keyFeatures")} <span className="text-slate-400 dark:text-slate-500">{t("aiProduct.keyFeaturesHint")}</span>
                    </label>
                    <Textarea
                      value={keyFeatures}
                      onChange={e => setKeyFeatures(e.target.value)}
                      placeholder={t("aiProduct.keyFeaturesPlaceholder")}
                      className="rounded-xl text-sm bg-white dark:bg-slate-800 min-h-[80px]"
                    />
                  </div>

                  <Button
                    onClick={generate}
                    disabled={generating || !keyFeatures.trim()}
                    className="w-full bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700 rounded-xl gap-2"
                  >
                    {generating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {t("aiProduct.generating")}</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> {t("aiProduct.generateWithAI")}</>
                    )}
                  </Button>

                  {result && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 bg-white dark:bg-slate-800 rounded-xl border border-purple-100 dark:border-purple-900 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wide">{t("aiProduct.aiGeneratedContent")}</p>
                        <button onClick={generate} className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300">
                          <RefreshCw className="w-3 h-3" /> {t("aiProduct.regenerate")}
                        </button>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">{t("aiProduct.resultTitle")}</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{result.title}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">{t("aiProduct.resultDescription")}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4">{result.description}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1.5">{t("aiProduct.seoTags")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.tags?.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] px-2 py-0.5">{tag}</Badge>
                          ))}
                        </div>
                      </div>

                      {result.seo_title && (
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5">
                          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">{t("aiProduct.seoMetaTitle")}</p>
                          <p className="text-xs text-slate-700 dark:text-slate-300">{result.seo_title}</p>
                        </div>
                      )}

                      <Button onClick={apply} className="w-full bg-orange-600 hover:bg-orange-700 rounded-xl gap-2">
                        <Check className="w-4 h-4" /> {t("aiProduct.applyToForm")}
                      </Button>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
