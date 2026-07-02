import React, { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, ShoppingCart,
  MapPin, Star, DollarSign, Package, Users, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

const CustomTooltip = ({ active, payload, label, prefix = "" }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg p-3 text-xs">
        <p className="text-slate-500 dark:text-slate-400 mb-1 font-medium">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="font-semibold" style={{ color: p.color }}>
            {p.name}: {prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function KpiCard({ icon: Icon, label, value, change, color, sub }) {
  const isPos = change >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        {change !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${isPos ? "text-green-600" : "text-red-500"}`}>
            {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

export default function AdvancedAnalytics({ orders, products, plan = 'free', onUpgrade }) {
  const { t } = useTranslation();
  const isElite = plan === 'elite';

  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + (o.total || 0), 0), [orders]);
  const avgOrderValue = useMemo(() => orders.length ? totalRevenue / orders.length : 0, [orders, totalRevenue]);
  const uniqueBuyers = useMemo(() => new Set(orders.map(o => o.buyer_username).filter(Boolean)).size, [orders]);
  const paidOrders = useMemo(() => orders.filter(o => o.payment_status === 'paid').length, [orders]);
  const deliveredOrders = useMemo(() => orders.filter(o => o.status === "delivered").length, [orders]);
  const completionRate = useMemo(() => orders.length > 0 ? ((deliveredOrders / orders.length) * 100).toFixed(1) : "0.0", [orders, deliveredOrders]);

  const monthlyRevenue = useMemo(() => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const revenueMap = {};
    const orderCountMap = {};
    orders.forEach(o => {
      const d = new Date(o.created_at || o.created_date);
      if (isNaN(d)) return;
      const m = months[d.getMonth()];
      revenueMap[m] = (revenueMap[m] || 0) + (o.total || 0);
      orderCountMap[m] = (orderCountMap[m] || 0) + 1;
    });
    const currentMonth = new Date().getMonth();
    return months.slice(0, currentMonth + 1).map(m => ({
      month: m,
      revenue: revenueMap[m] || 0,
      orders: orderCountMap[m] || 0,
    }));
  }, [orders]);

  const productPerf = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        const key = item.product_id || item.product_title;
        if (!map[key]) {
          map[key] = {
            name: item.product_title?.length > 16 ? item.product_title.slice(0, 16) + "…" : (item.product_title || "Unknown"),
            purchases: 0,
            revenue: 0,
          };
        }
        map[key].purchases += item.quantity || 1;
        map[key].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [orders]);

  const deliveryMethodData = useMemo(() => {
    const counts = { shipping: 0, delivery: 0, pickup: 0 };
    orders.forEach(o => {
      if (o.delivery_method && counts[o.delivery_method] !== undefined) {
        counts[o.delivery_method]++;
      }
    });
    return [
      { name: "Shipping", value: counts.shipping, color: COLORS[0] },
      { name: "Local Delivery", value: counts.delivery, color: COLORS[1] },
      { name: "Pickup", value: counts.pickup, color: COLORS[2] },
    ].filter(d => d.value > 0);
  }, [orders]);

  const orderStatusData = useMemo(() => {
    const counts = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value], i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: COLORS[i % COLORS.length],
    }));
  }, [orders]);

  const topCountries = useMemo(() => {
    const counts = {};
    orders.forEach(o => {
      const country = o.shipping_country || "Unknown";
      counts[country] = (counts[country] || 0) + 1;
    });
    const total = orders.length || 1;
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([country, count]) => ({ country, count, pct: Math.round((count / total) * 100) }));
  }, [orders]);

  const categoryRevenue = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        const product = products.find(p => (p._id || p.id) === item.product_id);
        const cat = product?.category || "Other";
        map[cat] = (map[cat] || 0) + (item.price || 0) * (item.quantity || 1);
      });
    });
    return Object.entries(map)
      .map(([name, revenue]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), revenue: Math.round(revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [orders, products]);

  const lowStockProducts = useMemo(() => (
    products.filter(p => p.inventory_count !== undefined && p.inventory_count !== null && p.inventory_count <= 5)
      .sort((a, b) => a.inventory_count - b.inventory_count)
      .slice(0, 5)
  ), [products]);

  const revenueOrderData = monthlyRevenue.map(m => ({ ...m, revenue: Math.round(m.revenue * 100) / 100 }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label={t("store.totalRevenue")} value={`$${totalRevenue.toFixed(2)}`} color="bg-orange-50 dark:bg-orange-950 text-orange-600" />
        <KpiCard icon={ShoppingCart} label={t("store.totalOrders")} value={orders.length} sub={t("store.paidCount", { count: paidOrders })} color="bg-purple-50 dark:bg-purple-950 text-purple-600" />
        <KpiCard icon={Users} label={t("store.uniqueCustomers")} value={uniqueBuyers || orders.length} color="bg-pink-50 dark:bg-pink-950 text-pink-600" />
        <KpiCard icon={Package} label={t("store.avgOrderValue")} value={`$${avgOrderValue.toFixed(2)}`} sub={t("store.completionRateSub", { rate: completionRate })} color="bg-green-50 dark:bg-green-950 text-green-600" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">{t("store.revenueTrend")}</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{t("store.revenueTrendDesc")}</p>
        {revenueOrderData.every(d => d.revenue === 0) ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">{t("store.noOrderHistory")}</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueOrderData}>
              <defs>
                <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ordG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={38} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
              <Area type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#6366f1" strokeWidth={2} fill="url(#revG)" dot={false} />
              <Area type="monotone" dataKey="orders" name="Orders" stroke="#8b5cf6" strokeWidth={2} fill="url(#ordG)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t("store.productPerformance")}</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{t("store.productPerfDesc")}</p>
        {productPerf.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">{t("store.noSalesDataYet")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  {[t("store.productTableProduct"), t("store.productTableUnits"), t("store.productTableRevenue")].map(h => (
                    <th key={h} className="text-left pb-2 text-slate-500 dark:text-slate-400 font-medium pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productPerf.map((p, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="py-2.5 pr-3 font-semibold text-slate-800 dark:text-slate-200">{p.name}</td>
                    <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{p.purchases.toLocaleString()}</td>
                    <td className="py-2.5 font-bold text-orange-600">${p.revenue.toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t("store.revenueByCategory")}</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{t("store.revenueByCategoryDesc")}</p>
          {categoryRevenue.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">{t("store.noCategoryData")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={categoryRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<CustomTooltip prefix="$" />} />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {categoryRevenue.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t("store.deliveryMethods")}</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{t("store.deliveryMethodsDesc")}</p>
          {deliveryMethodData.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">{t("store.noOrderDataYet")}</div>
          ) : (
            <div className="flex items-center gap-4 h-[160px]">
              <ResponsiveContainer width="50%" height={140}>
                <PieChart>
                  <Pie data={deliveryMethodData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" paddingAngle={3}>
                    {deliveryMethodData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {deliveryMethodData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-slate-600 dark:text-slate-300 flex-1">{d.name}</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t("store.orderStatusPipeline")}</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{t("store.orderStatusPipelineDesc")}</p>
          {orderStatusData.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">{t("store.noOrdersYetAnalytics")}</div>
          ) : (
            <div className="space-y-2">
              {orderStatusData.map((s, i) => {
                const pct = Math.round((s.value / orders.length) * 100);
                return (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-600 dark:text-slate-300">{s.name}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{s.value} <span className="text-slate-400 dark:text-slate-500 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, delay: i * 0.08 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">{t("store.orderCompletionRate")} <span className="text-orange-600 font-semibold">{completionRate}%</span></p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 relative overflow-hidden">
          {!isElite && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center mb-3">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{t("store.eliteAnalyticsFeature")}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-[180px]">{t("store.upgradeForLocation")}</p>
              <Button onClick={onUpgrade} size="sm" variant="outline" className="h-8 text-[10px] rounded-lg border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950">{t("store.upgradePlan")}</Button>
            </div>
          )}
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-red-500" /> {t("store.topShippingCountries")}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{t("store.topShippingCountriesDesc")}</p>
          {topCountries.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">{t("store.noShippingData")}</div>
          ) : (
            <div className="space-y-2">
              {topCountries.map((loc, i) => (
                <div key={loc.country} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-4">{i + 1}</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 flex-1">{loc.country}</span>
                  <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${loc.pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white w-7 text-right">{loc.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" /> {t("store.lowStockAlert")}
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{t("store.lowStockDesc")}</p>
        {lowStockProducts.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">{t("store.wellStocked")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProducts.map(p => (
              <div key={p._id || p.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[60%]">{p.title}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.inventory_count === 0 ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400" : "bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-300"}`}>
                  {p.inventory_count === 0 ? t("store.outOfStockLabel") : t("store.itemsLeft", { count: p.inventory_count })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
