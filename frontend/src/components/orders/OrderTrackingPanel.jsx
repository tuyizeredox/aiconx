import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, Package, CheckCircle2, Clock, MapPin, ChevronDown, ChevronUp,
  RefreshCw, ExternalLink
} from "lucide-react";

// Mocked tracking API — generates deterministic events based on order data
function generateTrackingEvents(order) {
  const created = new Date(order.created_at || order.created_date);
  const events = [];

  const addEvent = (hoursAfter, status, location, description) => {
    const d = new Date(created.getTime() + hoursAfter * 3600 * 1000);
    events.push({ timestamp: d, status, location, description });
  };

  // Always show order placed
  addEvent(0, "order_placed", "Online", "Order confirmed and payment received");

  if (["processing", "shipped", "delivered", "confirmed"].includes(order.status)) {
    addEvent(2, "processing", order.store_name || "Warehouse", "Seller is preparing your package");
  }
  if (["shipped", "delivered"].includes(order.status)) {
    addEvent(24, "picked_up", "Sorting Facility – Chicago, IL", "Package picked up by carrier");
    addEvent(36, "in_transit", "Distribution Center – Indianapolis, IN", "Package in transit to destination city");
    addEvent(52, "out_for_delivery", "Local Hub – " + (order.shipping_address?.split(",")[1]?.trim() || "Destination City"), "Out for delivery — estimated by end of day");
  }
  if (order.status === "delivered") {
    addEvent(58, "delivered", order.shipping_address || "Destination", "Package delivered successfully ✓");
  }

  return events.reverse(); // most recent first
}

const EVENT_CONFIG = {
  order_placed: { icon: Package, color: "bg-blue-500", label: "Order Placed" },
  processing: { icon: Clock, color: "bg-amber-500", label: "Processing" },
  picked_up: { icon: Truck, color: "bg-indigo-500", label: "Picked Up" },
  in_transit: { icon: Truck, color: "bg-purple-500", label: "In Transit" },
  out_for_delivery: { icon: MapPin, color: "bg-orange-500", label: "Out for Delivery" },
  delivered: { icon: CheckCircle2, color: "bg-green-500", label: "Delivered" },
};

const STEP_ORDER = ["order_placed", "processing", "picked_up", "in_transit", "out_for_delivery", "delivered"];

function ProgressBar({ events }) {
  const latestStatus = events[0]?.status || "order_placed";
  const currentStep = STEP_ORDER.indexOf(latestStatus);

  return (
    <div className="flex items-center gap-0 mb-5 px-1">
      {STEP_ORDER.map((step, i) => {
        const cfg = EVENT_CONFIG[step];
        const Icon = cfg.icon;
        const done = i <= currentStep;
        const isLast = i === STEP_ORDER.length - 1;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${done ? cfg.color : "bg-slate-100 dark:bg-slate-700"}`}>
                <Icon className={`w-3.5 h-3.5 ${done ? "text-white" : "text-slate-300 dark:text-slate-500"}`} />
              </div>
              <span className={`text-[9px] text-center leading-tight w-12 ${done ? "text-slate-700 dark:text-slate-300 font-medium" : "text-slate-300 dark:text-slate-600"}`}>
                {cfg.label}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 -mt-4 transition-all ${i < currentStep ? "bg-indigo-500" : "bg-slate-100 dark:bg-slate-700"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function OrderTrackingPanel({ order }) {
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    setEvents(generateTrackingEvents(order));
  }, [order.id, order.status]);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const latestEvent = events[0];
  if (!latestEvent) return null;
  const latestCfg = EVENT_CONFIG[latestEvent.status];

  return (
    <div className="mt-3 border-t border-slate-50 dark:border-slate-700 pt-3">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${latestCfg.color}`}>
          <latestCfg.icon className="w-3 h-3 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{latestCfg.label}</p>
          <p className="text-[10px] text-slate-400 truncate">{latestEvent.description}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); refresh(); }}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <RefreshCw className={`w-3 h-3 text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4">
              <ProgressBar events={events} />

              {order.tracking_number && (
                <div className="flex items-center justify-between mb-3 bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-[10px] text-slate-400">Tracking Number</p>
                    <p className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">{order.tracking_number}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                </div>
              )}

              <div className="space-y-0">
                {events.map((event, i) => {
                  const cfg = EVENT_CONFIG[event.status] || EVENT_CONFIG.order_placed;
                  const EventIcon = cfg.icon;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? cfg.color : "bg-slate-100 dark:bg-slate-700"}`}>
                          <EventIcon className={`w-3 h-3 ${i === 0 ? "text-white" : "text-slate-400"}`} />
                        </div>
                        {i < events.length - 1 && <div className="w-0.5 h-6 bg-slate-100 dark:bg-slate-700 my-0.5" />}
                      </div>
                      <div className="pb-3 flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${i === 0 ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>{cfg.label}</p>
                        <p className="text-[10px] text-slate-400">{event.description}</p>
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">
                          {event.location} · {event.timestamp.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}