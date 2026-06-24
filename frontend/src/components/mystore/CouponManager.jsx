import React, { useState } from "react";
import { couponsAPI } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Tag, Trash2, ToggleLeft, ToggleRight, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const defaultForm = {
  code: "", discount_type: "percentage", discount_value: "",
  min_order_amount: "", max_uses: "", expires_at: "",
};

export default function CouponManager({ store, vendorUsername }) {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const queryClient = useQueryClient();

  const { data: couponsResponse = {}, isLoading } = useQuery({
    queryKey: ["coupons", store?.id],
    queryFn: async () => {
      const res = await couponsAPI.list({ vendor_username: vendorUsername, sort: "-created_date", limit: 50 });
      return res;
    },
    enabled: !!vendorUsername,
  });
  
  const coupons = Array.isArray(couponsResponse?.coupons) ? couponsResponse.coupons : [];

  const createMutation = useMutation({
    mutationFn: () => couponsAPI.create({
      code: form.code.toUpperCase().trim(),
      store_id: store?.id,
      vendor_username: vendorUsername,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_order_amount: parseFloat(form.min_order_amount) || 0,
      max_uses: parseInt(form.max_uses) || 0,
      expires_at: form.expires_at || undefined,
      is_active: true,
      uses_count: 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success(t("store.couponCreated"));
      setShowCreate(false);
      setForm(defaultForm);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => couponsAPI.update(id, { is_active: !is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => couponsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success(t("store.couponDeleted"));
    },
  });

  const isExpired = (coupon) => {
    if (!coupon.expires_at) return false;
    return new Date(coupon.expires_at) < new Date();
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(t("store.copiedCode", { code }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t("store.discountCoupons")}</h3>
          <p className="text-xs text-slate-400">{t("store.couponsCreated", { count: coupons.length })}</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl gap-1.5 h-9">
              <Plus className="w-4 h-4" /> {t("store.newCoupon")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t("store.createCouponCode")}</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t("store.couponCodeLabel")}</label>
                <Input
                  placeholder="e.g. SAVE20"
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="font-mono font-bold tracking-widest"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{t("store.discountType")}</label>
                  <Select value={form.discount_type} onValueChange={v => setForm(p => ({ ...p, discount_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{t("store.percentageType")}</SelectItem>
                      <SelectItem value="flat">{t("store.flatAmountType")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    {form.discount_type === "percentage" ? t("store.discountPct") : t("store.discountFlat")} *
                  </label>
                  <Input
                    type="number"
                    placeholder={form.discount_type === "percentage" ? "20" : "10"}
                    value={form.discount_value}
                    onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{t("store.minOrderLabel")}</label>
                  <Input
                    type="number" placeholder="0"
                    value={form.min_order_amount}
                    onChange={e => setForm(p => ({ ...p, min_order_amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{t("store.maxUsesLabel")}</label>
                  <Input
                    type="number" placeholder="0"
                    value={form.max_uses}
                    onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t("store.expiryDate")}</label>
                <Input
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              {form.code && form.discount_value && (
                <div className="p-3 bg-orange-50 rounded-xl border border-dashed border-orange-200">
                  <p className="text-xs text-slate-500 mb-1">{t("store.couponPreview")}</p>
                  <p className="text-sm font-bold text-orange-700 font-mono">{form.code}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {form.discount_type === "percentage"
                      ? t("store.percentOff", { value: form.discount_value })
                      : t("store.flatOff", { value: form.discount_value })}
                    {form.min_order_amount > 0 ? ` · ${t("store.minOrderMin", { amount: form.min_order_amount })}` : ""}
                  </p>
                </div>
              )}

              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.code.trim() || !form.discount_value || createMutation.isPending}
                className="w-full bg-orange-600 hover:bg-indigo-700"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Tag className="w-4 h-4 mr-2" />}
                {t("store.createCoupon")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
          <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">{t("store.noCouponsYet")}</p>
          <p className="text-xs mt-0.5">{t("store.createFirstCoupon")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {coupons.map(coupon => {
              const expired = isExpired(coupon);
              const maxed = coupon.max_uses > 0 && coupon.uses_count >= coupon.max_uses;
              const isInactive = !coupon.is_active || expired || maxed;

              return (
                <motion.div
                  key={coupon.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-white rounded-xl border p-4 flex items-center gap-3 ${
                    isInactive ? "border-slate-100 opacity-60" : "border-slate-100"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isInactive ? "bg-slate-100" : "bg-indigo-50"
                  }`}>
                    <Tag className={`w-4 h-4 ${isInactive ? "text-slate-400" : "text-orange-600"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => copyCode(coupon.code)}
                        className="text-sm font-bold font-mono text-slate-900 hover:text-orange-600 transition-colors flex items-center gap-1"
                      >
                        {coupon.code}
                        <Copy className="w-3 h-3 opacity-50" />
                      </button>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        coupon.discount_type === "percentage"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {coupon.discount_type === "percentage"
                          ? t("store.percentOff", { value: coupon.discount_value })
                          : t("store.flatOff", { value: coupon.discount_value })}
                      </span>
                      {expired && <Badge className="bg-red-100 text-red-600 border-0 text-[10px]">{t("store.couponExpired")}</Badge>}
                      {maxed && <Badge className="bg-gray-100 text-gray-600 border-0 text-[10px]">{t("store.maxUsesReached")}</Badge>}
                      {!isInactive && <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">{t("store.couponActive")}</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {coupon.min_order_amount > 0 ? `${t("store.minOrderMin", { amount: coupon.min_order_amount })} · ` : ""}
                      {t("store.couponUses", { count: coupon.uses_count || 0 })}
                      {coupon.max_uses > 0 ? ` / ${coupon.max_uses}` : ""}
                      {coupon.expires_at ? ` · ${t("store.couponExpires", { date: new Date(coupon.expires_at).toLocaleDateString() })}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleMutation.mutate({ id: coupon.id, is_active: coupon.is_active })}
                      className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                      title={coupon.is_active ? t("store.deactivate") : t("store.activate")}
                    >
                      {coupon.is_active
                        ? <ToggleRight className="w-5 h-5 text-orange-600" />
                        : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(coupon.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
