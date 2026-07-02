import React, { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { motion } from "framer-motion";
import { DollarSign, ShoppingCart, Users, Package, Star, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, prefix = "" }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg p-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
            {prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function StoreAnalytics({ orders, products, plan = 'free', onUpgrade }) {
  const { t } = useTranslation();
  const isFree = plan === 'free';

  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + (o.total || 0), 0), [orders]);
  const avgOrderValue = useMemo(() => orders.length ? totalRevenue / orders.length : 0, [orders, totalRevenue]);
  const uniqueBuyers = useMemo(() => new Set(orders.map(o => o.buyer_username).filter(Boolean)).size, [orders]);
  const paidOrders = useMemo(() => orders.filter(o => o.payment_status === 'paid').length, [orders]);

  const dailyRevenue = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return { day: days[d.getDay()], date: d.toDateString(), revenue: 0, orders: 0 };
    });

    orders.forEach(o => {
      const oDate = new Date(o.created_at || o.created_date);
      const entry = result.find(r => r.date === oDate.toDateString());
      if (entry) {
        entry.revenue += o.total || 0;
        entry.orders += 1;
      }
    });

    return result;
  }, [orders]);

  const topProducts = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        const key = item.product_id || item.product_title;
        if (!map[key]) {
          map[key] = { name: item.product_title?.length > 18 ? item.product_title.slice(0, 18) + "…" : item.product_title, sales: 0, revenue: 0 };
        }
        map[key].sales += item.quantity || 1;
        map[key].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });
    const sorted = Object.values(map).sort((a, b) => b.sales - a.sales).slice(0, 5);
    if (sorted.length) return sorted;
    return products.slice(0, 5).map(p => ({
      name: p.title?.length > 18 ? p.title.slice(0, 18) + "…" : (p.title || "Product"),
      sales: p.sales_count || 0,
      revenue: (p.sales_count || 0) * (p.price || 0),
    }));
  }, [orders, products]);

  const orderStatusData = useMemo(() => {
    const counts = {};
    orders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [orders]);

  const lowStockProducts = useMemo(() => (
    products.filter(p => p.inventory_count !== undefined && p.inventory_count !== null && p.inventory_count <= 5)
      .sort((a, b) => a.inventory_count - b.inventory_count)
      .slice(0, 5)
  ), [products]);

  return (
    <div className="space-y-6">
      {isFree && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500/10 to-orange-500/10 border border-orange-100 dark:border-orange-900 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 text-center md:text-left">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{t("store.unlockAdvancedInsights")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("store.upgradeForInsights")}</p>
            </div>
          </div>
          <Button onClick={onUpgrade} size="sm" className="bg-orange-600 hover:bg-orange-700 rounded-xl whitespace-nowrap">{t("store.upgradePlan")}</Button>
        </motion.div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t("store.totalRevenue")} value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} color="bg-orange-50 text-orange-600" />
        <StatCard label={t("store.totalOrders")} value={orders.length} sub={t("store.paidCount", { count: paidOrders })} icon={ShoppingCart} color="bg-purple-50 text-purple-600" />
        <StatCard label={t("store.avgOrderValue")} value={`$${avgOrderValue.toFixed(2)}`} icon={Package} color="bg-pink-50 text-pink-600" />
        <StatCard label={t("store.uniqueCustomers")} value={uniqueBuyers || orders.length} icon={Users} color="bg-amber-50 text-amber-600" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t("store.dailyRevenue7Days")}</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{t("store.dailyRevenueDesc")}</p>
        {dailyRevenue.every(d => d.revenue === 0) ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">{t("store.noOrderLast7Days")}</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyRevenue}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomTooltip prefix="$" />} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t("store.topPerformingProducts")}</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{t("store.unitsSoldAllOrders")}</p>
        {topProducts.length === 0 || topProducts.every(p => p.sales === 0) ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">{t("store.noSalesDataYet")}</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sales" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t("store.orderStatusBreakdown")}</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{t("store.orderStatusDesc")}</p>
          {orderStatusData.length === 0 ? (
            <div className="h-[140px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">{t("store.noOrdersYetAnalytics")}</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={140}>
                <PieChart>
                  <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                    {orderStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {orderStatusData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-slate-600 dark:text-slate-300">{d.name}</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> {t("store.lowStockAlert")}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{t("store.lowStockDesc")}</p>
          {lowStockProducts.length === 0 ? (
            <div className="h-[100px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">{t("store.wellStocked")}</div>
          ) : (
            <div className="space-y-2">
              {lowStockProducts.map(p => (
                <div key={p._id || p.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700 last:border-0">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[60%]">{p.title}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.inventory_count === 0 ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400" : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"}`}>
                    {p.inventory_count === 0 ? t("store.outOfStockLabel") : t("store.itemsLeft", { count: p.inventory_count })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
