import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, TrendingUp, Clock, CheckCircle2, ArrowDownCircle,
  Loader2, Wallet, FileText, ChevronDown, ChevronUp, AlertCircle, Building2,
  CreditCard, BarChart3
} from "lucide-react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { storesAPI, ordersAPI, withdrawalsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { useTranslation } from "react-i18next";

function StatCard({ icon: Icon, label, value, sub, color }) {
  // Icon is a component, rendered as <Icon />
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

const PAYOUT_RATE = 0.9; // 90% after platform fee

export default function VendorFinance() {
  const { t } = useTranslation();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "", 
    payment_method: "bank_transfer",
    bank_name: "", 
    bank_account_name: "", 
    bank_account_number: "", 
    routing_number: "", 
    paypal_email: "",
    mobile_money_number: ""
  });
  const [expandedOrder, setExpandedOrder] = useState(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: store } = useQuery({
    queryKey: ["myStore", currentUser?.username],
    queryFn: async () => {
      const res = await storesAPI.getByOwnerUsername(currentUser?.username);
      if (res && !withdrawForm.bank_name && !withdrawForm.paypal_email && !withdrawForm.mobile_money_number) {
        setWithdrawForm(prev => ({
          ...prev,
          payment_method: res.payment_method || "bank_transfer",
          bank_name: res.bank_name || "",
          bank_account_name: res.bank_account_name || "",
          bank_account_number: res.bank_account_number || "",
          routing_number: res.routing_number || "",
          paypal_email: res.paypal_email || "",
          mobile_money_number: res.mobile_money_number || "",
        }));
      }
      return res;
    },
    enabled: !!currentUser?.username,
  });

  const { data: ordersResponse = {} } = useQuery({
    queryKey: ["storeOrders", currentUser?.username],
    queryFn: async () => {
      const res = await ordersAPI.list({ vendor_username: currentUser?.username, sort: "-created_at", limit: 200 });
      return res;
    },
    enabled: !!currentUser?.username,
  });
  
  const orders = Array.isArray(ordersResponse?.data) ? ordersResponse.data : [];

  const { data: withdrawalsResponse = {} } = useQuery({
    queryKey: ["withdrawals", currentUser?.username],
    queryFn: async () => {
      const res = await withdrawalsAPI.listByUsername(currentUser?.username, { sort: "-created_at", limit: 50 });
      return res;
    },
    enabled: !!currentUser?.username,
  });
  
  const withdrawals = Array.isArray(withdrawalsResponse?.data) ? withdrawalsResponse.data : [];

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawalsAPI.create({
      vendor_username: currentUser.username,
      store_id: store?.id || store?._id,
      store_name: store?.name,
      amount: parseFloat(withdrawForm.amount),
      payment_method: withdrawForm.payment_method || "bank_transfer",
      bank_account_name: withdrawForm.bank_account_name,
      bank_account_number: withdrawForm.bank_account_number,
      bank_name: withdrawForm.bank_name,
      routing_number: withdrawForm.routing_number,
      paypal_email: withdrawForm.paypal_email,
      mobile_money_number: withdrawForm.mobile_money_number,
      status: "pending",
    }),
    onSuccess: () => {
      toast.success(t("finance.withdrawalSubmitted"));
      setWithdrawOpen(false);
      setWithdrawForm({ amount: "", payment_method: store?.payment_method || "bank_transfer", bank_name: store?.bank_name || "", bank_account_name: store?.bank_account_name || "", bank_account_number: store?.bank_account_number || "", routing_number: store?.routing_number || "", paypal_email: store?.paypal_email || "", mobile_money_number: store?.mobile_money_number || "" });
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
    },
  });

  // Financial calculations
  const paidOrders = orders.filter(o => o.payment_status === "paid" || o.status === "delivered" || o.status === "shipped");
  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "confirmed" || o.status === "processing");
  const totalGross = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalEarned = totalGross * PAYOUT_RATE;
  const totalWithdrawn = withdrawals.filter(w => w.status === "completed").reduce((s, w) => s + (w.amount || 0), 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending" || w.status === "processing").reduce((s, w) => s + (w.amount || 0), 0);
  const availableBalance = Math.max(0, totalEarned - totalWithdrawn - pendingWithdrawals);
  const pendingEarnings = pendingOrders.reduce((s, o) => s + (o.total || 0), 0) * PAYOUT_RATE;

  // Group orders by month for chart
  const monthlyData = orders.reduce((acc, o) => {
    const month = new Date(o.created_at || o.created_date).toLocaleString("default", { month: "short", year: "2-digit" });
    acc[month] = (acc[month] || 0) + (o.total || 0) * PAYOUT_RATE;
    return acc;
  }, {});
  const chartData = Object.entries(monthlyData).slice(-6);
  const maxVal = Math.max(...chartData.map(([, v]) => v), 1);

  const downloadTaxInvoice = (order) => {
    const doc = new jsPDF();
    const invoiceId = `INV-${order.id?.slice(-8).toUpperCase()}`;
    const date = new Date(order.created_at || order.created_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Header gradient strip
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("TAX INVOICE", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Aicon X Marketplace`, 150, 12);
    doc.text(`Platform Fee: 10%`, 150, 18);

    // Invoice meta
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Invoice Details", 14, 40);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice #: ${invoiceId}`, 14, 48);
    doc.text(`Date: ${date}`, 14, 54);
    doc.text(`Status: ${order.status?.toUpperCase()}`, 14, 60);

    // Vendor info
    doc.setFont("helvetica", "bold");
    doc.text("From (Vendor)", 120, 40);
    doc.setFont("helvetica", "normal");
    doc.text(store?.name || "Your Store", 120, 48);
    doc.text(`@${currentUser?.username}` || "", 120, 54);

    // Bill To
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 68, 182, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BILL TO", 18, 76);
    doc.setFont("helvetica", "normal");
    doc.text(order.buyer_name || `@${order.buyer_username}` || "Customer", 18, 82);
    doc.text(order.shipping_address || "", 18, 87);

    // Items table header
    let y = 102;
    doc.setFillColor(99, 102, 241);
    doc.rect(14, y - 6, 182, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Item", 18, y);
    doc.text("Qty", 130, y);
    doc.text("Unit Price", 148, y);
    doc.text("Amount", 174, y);

    y += 10;
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "normal");

    (order.items || []).forEach((item, i) => {
      if (i % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(14, y - 5, 182, 9, "F"); }
      const title = item.product_title?.length > 40 ? item.product_title.slice(0, 40) + "…" : (item.product_title || "Product");
      doc.text(title, 18, y);
      doc.text(String(item.quantity || 1), 133, y);
      doc.text(`RWF ${Math.round(item.price || 0)}`, 150, y);
      doc.text(`RWF ${Math.round((item.price || 0) * (item.quantity || 1))}`, 176, y);
      y += 10;
    });

    // Totals
    y += 5;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, 196, y);
    y += 8;

    const rows = [
      ["Subtotal", `RWF ${Math.round(order.subtotal || order.total || 0)}`],
      ["Shipping", `RWF ${Math.round(order.shipping_fee || 0)}`],
      ["Gross Total", `RWF ${Math.round(order.total || 0)}`],
      ["Platform Fee (10%)", `-RWF ${Math.round((order.total || 0) * 0.1)}`],
    ];
    rows.forEach(([label, val]) => {
      doc.setFont("helvetica", "normal");
      doc.text(label, 130, y);
      doc.setFont("helvetica", "bold");
      doc.text(val, 185, y, { align: "right" });
      y += 8;
    });

    doc.setFillColor(99, 102, 241);
    doc.rect(130, y - 2, 66, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Net Payout", 134, y + 5);
    doc.text(`RWF ${Math.round((order.total || 0) * 0.9)}`, 185, y + 5, { align: "right" });

    // Footer
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Generated by Aicon X Marketplace · This is a tax invoice for your records.", 14, 282);
    doc.text(`Payment Method: ${order.payment_method || "card"}`, 14, 287);

    doc.save(`invoice-${invoiceId}.pdf`);
    toast.success(t("finance.invoiceDownloaded"));
  };

  const statusColors = {
    pending: "bg-amber-100 text-amber-700",
    processing: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  const orderStatusColors = {
    pending: "bg-amber-50 text-amber-700",
    confirmed: "bg-orange-50 text-orange-700",
    processing: "bg-orange-50 text-orange-700",
    shipped: "bg-purple-50 text-purple-700",
    delivered: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("finance.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t("finance.subtitle")}</p>
        </div>
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl gap-2">
              <Wallet className="w-4 h-4" /> {t("finance.requestWithdrawal")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("finance.requestWithdrawal")}</DialogTitle>
              {store?.payment_method && (
                <p className="text-[10px] text-orange-600 font-medium flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("finance.preFilledFromStore")}
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("finance.availableBalance")}</p>
                <p className="text-2xl font-bold text-orange-700">${availableBalance.toFixed(2)}</p>
              </div>

              {!store?.payment_method && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl flex gap-3 items-start">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-300">{t("finance.payoutMethodNotSet")}</p>
                    <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                      {t("finance.payoutMethodNotSetDesc")}
                    </p>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">{t("finance.withdrawalAmount")} *</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={withdrawForm.amount}
                  onChange={e => setWithdrawForm(p => ({ ...p, amount: e.target.value }))}
                  max={availableBalance}
                />
                {parseFloat(withdrawForm.amount) > availableBalance && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t("finance.exceedsBalance")}</p>
                )}
                {parseFloat(withdrawForm.amount) > 0 && parseFloat(withdrawForm.amount) < 20 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t("finance.minimumWithdrawal")}</p>
                )}
              </div>
              
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">{t("finance.payoutMethod")}</label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setWithdrawForm(p => ({ ...p, payment_method: "bank_transfer" }))}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${withdrawForm.payment_method === "bank_transfer" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"}`}
                  >
                    Bank
                  </button>
                  <button 
                    type="button"
                    onClick={() => setWithdrawForm(p => ({ ...p, payment_method: "paypal" }))}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${withdrawForm.payment_method === "paypal" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"}`}
                  >
                    PayPal
                  </button>
                   <button 
                     type="button"
                     onClick={() => setWithdrawForm(p => ({ ...p, payment_method: "itecpay" }))}
                     className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${withdrawForm.payment_method === "itecpay" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"}`}
                   >
                     ITEC Pay
                   </button>
                  <button 
                    type="button"
                    onClick={() => setWithdrawForm(p => ({ ...p, payment_method: "mobile_money" }))}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${withdrawForm.payment_method === "mobile_money" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"}`}
                  >
                    M-Money
                  </button>
                </div>
              </div>

               {(withdrawForm.payment_method === "bank_transfer" || withdrawForm.payment_method === "itecpay") && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Bank Name *</label>
                    <Input placeholder="e.g. Chase, Bank of America" value={withdrawForm.bank_name} onChange={e => setWithdrawForm(p => ({ ...p, bank_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Account Holder Name *</label>
                    <Input placeholder="Full name on account" value={withdrawForm.bank_account_name} onChange={e => setWithdrawForm(p => ({ ...p, bank_account_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Account Number *</label>
                      <Input placeholder="Account #" value={withdrawForm.bank_account_number} onChange={e => setWithdrawForm(p => ({ ...p, bank_account_number: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Routing Number</label>
                      <Input placeholder="Routing #" value={withdrawForm.routing_number} onChange={e => setWithdrawForm(p => ({ ...p, routing_number: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}

              {withdrawForm.payment_method === "paypal" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">PayPal Email *</label>
                    <Input type="email" placeholder="your-paypal@email.com" value={withdrawForm.paypal_email} onChange={e => setWithdrawForm(p => ({ ...p, paypal_email: e.target.value }))} />
                  </div>
                  <p className="text-[10px] text-slate-400">Payouts will be sent to this PayPal address within 1-3 business days.</p>
                </div>
              )}

              {withdrawForm.payment_method === "mobile_money" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Mobile Money Number *</label>
                    <Input placeholder="07XXXXXXXX" value={withdrawForm.mobile_money_number} onChange={e => setWithdrawForm(p => ({ ...p, mobile_money_number: e.target.value }))} />
                  </div>
                   <p className="text-[10px] text-slate-400">Payouts will be sent to this Mobile Money number via ITEC Pay.</p>
                </div>
              )}

              <Button
                onClick={() => withdrawMutation.mutate()}
                disabled={
                  withdrawMutation.isPending ||
                  !withdrawForm.amount || 
                   ((withdrawForm.payment_method === "bank_transfer" || withdrawForm.payment_method === "itecpay") && (!withdrawForm.bank_name || !withdrawForm.bank_account_name || !withdrawForm.bank_account_number)) ||
                  (withdrawForm.payment_method === "paypal" && !withdrawForm.paypal_email) ||
                  (withdrawForm.payment_method === "mobile_money" && !withdrawForm.mobile_money_number) ||
                  parseFloat(withdrawForm.amount) < 20 ||
                  parseFloat(withdrawForm.amount) > availableBalance
                }
                className="w-full bg-orange-600 hover:bg-orange-700 mt-2"
              >
                {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownCircle className="w-4 h-4 mr-2" />}
                {t("finance.submitWithdrawal")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={DollarSign} label={t("finance.availableBalance")} value={formatCurrency(availableBalance)} color="bg-orange-50 text-orange-600" />
        <StatCard icon={TrendingUp} label={t("finance.totalEarned")} value={formatCurrency(totalEarned)} sub={t("finance.afterPlatformFee")} color="bg-green-50 text-green-600" />
        <StatCard icon={Clock} label={t("finance.pendingEarnings")} value={formatCurrency(pendingEarnings)} sub={t("finance.fromActiveOrders")} color="bg-amber-50 text-amber-600" />
        <StatCard icon={CheckCircle2} label={t("finance.totalWithdrawn")} value={formatCurrency(totalWithdrawn)} color="bg-purple-50 text-purple-600" />
      </div>

      {/* Monthly Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">{t("finance.monthlyRevenue")}</h3>
          </div>
          <div className="flex items-end gap-2 h-28">
            {chartData.map(([month, val]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">${val.toFixed(0)}</span>
                <div
                  className="w-full bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-lg transition-all"
                  style={{ height: `${Math.max(8, (val / maxVal) * 80)}px` }}
                />
                <span className="text-[10px] text-slate-400">{month}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Transaction History */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-500 dark:text-slate-400" /> {t("finance.transactionHistory")}
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {orders.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">{t("finance.noTransactions")}</p>
            ) : (
              orders.map(order => (
                <div key={order.id}>
                  <button
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${orderStatusColors[order.status] || "bg-slate-50 text-slate-600"}`}>
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {order.buyer_name || `@${order.buyer_username}`}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(order.created_at || order.created_date).toLocaleDateString()} · #{order.id?.slice(-8)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600">+{formatCurrency(order.total * 0.9)}</p>
                      <p className="text-[10px] text-slate-400 line-through">{formatCurrency(order.total)}</p>
                    </div>
                    {expandedOrder === order.id ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>

                  <AnimatePresence>
                    {expandedOrder === order.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mx-2.5 mb-2 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">{t("finance.gross")}</span>
                            <span className="font-medium">{formatCurrency(order.total)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">{t("finance.platformFee")}</span>
                            <span className="text-red-500">-{formatCurrency(order.total * 0.1)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-semibold border-t border-slate-200 dark:border-slate-600 pt-1.5">
                            <span>{t("finance.netPayout")}</span>
                            <span className="text-green-600">{formatCurrency(order.total * 0.9)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 pt-1 capitalize">
                            <span>{t("checkout.paymentMethod")}</span>
                            <span>{order.payment_method?.replaceAll('_', ' ') || 'card'}</span>
                          </div>
                          <button
                            onClick={() => downloadTaxInvoice(order)}
                            className="w-full flex items-center justify-center gap-1.5 mt-2 py-1.5 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-500 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" /> {t("finance.downloadInvoice")}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-500 dark:text-slate-400" /> {t("finance.withdrawalRequests")}
          </h3>
          {pendingWithdrawals > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl mb-3">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">{t("finance.pendingProcessing", { amount: pendingWithdrawals.toFixed(2) })}</p>
            </div>
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {withdrawals.length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t("finance.noWithdrawals")}</p>
                <p className="text-xs text-slate-300 mt-0.5">{t("finance.yourAvailableBalance", { balance: availableBalance.toFixed(2) })}</p>
              </div>
            ) : (
              withdrawals.map(w => (
                <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusColors[w.status] || "bg-slate-50 text-slate-600"}`}>
                    <ArrowDownCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(w.amount)}</p>
                    <p className="text-xs text-slate-400">
                      {w.payment_method === 'mobile_money'
                        ? (w.mobile_money_number || 'Mobile Money')
                        : (w.bank_name || w.payment_method)} · {new Date(w.created_at || w.created_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={`${statusColors[w.status]} border-0 text-xs capitalize`}>
                    {w.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
