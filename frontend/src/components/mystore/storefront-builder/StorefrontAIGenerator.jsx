import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, RefreshCw, Check, ChevronDown, ChevronUp, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { aiAPI, productsAPI } from "@/api/apiClient";
import { formatCurrency } from "@/lib/utils";
import { BLOCK_TYPE_META } from "./blockTypes";

export default function StorefrontAIGenerator({ store, onApply, hasExistingBlocks }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [includeProducts, setIncludeProducts] = useState(false);
  const [result, setResult] = useState(null);

  const isVerified = store?.verification_status === "approved";
  const storeId = store?.id || store?._id;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await aiAPI.generateStorefront({ prompt, include_products: includeProducts && isVerified });
      return res.data || res;
    },
    onSuccess: (data) => setResult(data),
    onError: (error) => {
      if (error.status === 403 || error.message?.toLowerCase().includes("upgrade")) {
        toast.error(error.message || "This feature requires a Pro or Elite plan.");
      } else if (Array.isArray(error.details) && error.details.length) {
        const detail = error.details[0];
        const field = Array.isArray(detail?.path) ? detail.path.join(".") : null;
        toast.error(field ? `${field}: ${detail.message}` : (detail?.message || error.message || "Invalid input"));
      } else {
        toast.error(error.message || "Failed to generate a storefront");
      }
    },
  });

  const createProductsMutation = useMutation({
    mutationFn: async (products) => {
      let created = 0;
      for (const p of products) {
        await productsAPI.create({
          title: p.title,
          description: p.description || "",
          price: p.price,
          category: p.category,
          images: p.image_url ? [p.image_url] : [],
          inventory_count: 20,
          store_id: storeId,
          store_name: store?.name,
          status: "active",
        });
        created++;
      }
      return created;
    },
    onSuccess: (created) => {
      if (created > 0) {
        queryClient.invalidateQueries({ queryKey: ["myProducts"] });
        toast.success(`${created} product${created === 1 ? "" : "s"} added to your store`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Some products couldn't be created — check the Products tab");
    },
  });

  const generate = () => {
    if (!prompt.trim()) { toast.error("Describe the storefront you want first"); return; }
    generateMutation.mutate();
  };

  const apply = () => {
    if (!result) return;
    if (hasExistingBlocks && !window.confirm("This replaces your current sections with the AI-generated ones. Continue?")) {
      return;
    }
    onApply(result);
    if (result.products?.length) {
      createProductsMutation.mutate(result.products);
    }
    toast.success("Saved as a draft — edit it now or come back later, then publish");
    setResult(null);
    setOpen(false);
  };

  const generating = generateMutation.isPending;

  return (
    <div className="border border-orange-200 dark:border-orange-900 bg-gradient-to-r from-orange-50 to-purple-50 dark:from-orange-950 dark:to-purple-950 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 p-4 text-left">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800 dark:text-white">Build my storefront with AI</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Describe your store and get a full draft layout with real photos</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-orange-100 dark:border-orange-900">
              <div className="pt-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    What kind of storefront do you want?
                  </label>
                  <span className={`text-[10px] ${prompt.length > 4000 ? "text-red-500" : "text-slate-400 dark:text-slate-500"}`}>
                    {prompt.length}/4000
                  </span>
                </div>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, 4000))}
                  placeholder="e.g. A bold, modern layout for my handmade jewelry store, warm gold tones, with a gallery and customer reviews"
                  className="rounded-xl text-sm bg-white dark:bg-slate-800 min-h-[80px]"
                />
              </div>

              <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 rounded-xl p-3">
                <div className="min-w-0">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" /> Also create products
                  </Label>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {isVerified
                      ? "AI proposes a few real products for your store, ready to review"
                      : "Verify your store to let AI add products too"}
                  </p>
                </div>
                <Switch checked={includeProducts && isVerified} onCheckedChange={setIncludeProducts} disabled={!isVerified} />
              </div>

              <Button
                onClick={generate}
                disabled={generating || !prompt.trim()}
                className="w-full bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-purple-700 rounded-xl gap-2"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate with AI</>
                )}
              </Button>

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 bg-white dark:bg-slate-800 rounded-xl border border-orange-100 dark:border-orange-900 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wide">Draft ready</p>
                    <button type="button" onClick={generate} className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300">
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(result.blocks || []).map((b, i) => {
                      const meta = BLOCK_TYPE_META[b.type] || {};
                      const Icon = meta.icon;
                      return (
                        <span key={`${b.id || b.type}-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          {Icon && <Icon className="w-3 h-3" />} {meta.label || b.type}
                        </span>
                      );
                    })}
                  </div>

                  {result.products?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        Products ({result.products.length})
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {result.products.map((p, i) => (
                          <div key={`${p.title}-${i}`} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 min-w-0">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-md bg-slate-200 dark:bg-slate-700 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">{p.title}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatCurrency(p.price)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={apply} disabled={createProductsMutation.isPending} className="w-full bg-orange-600 hover:bg-orange-700 rounded-xl gap-2">
                    {createProductsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Apply to builder
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
