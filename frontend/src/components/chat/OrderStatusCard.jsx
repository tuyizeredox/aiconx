import React from "react";
import { ordersAPI } from "@/api/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Package, Truck, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";

const STEPS = [
  { key: "pending", icon: Clock, label: "Pending", color: "text-amber-500 bg-amber-50 border-amber-200" },
  { key: "confirmed", icon: CheckCircle2, label: "Confirmed", color: "text-orange-500 bg-orange-50 border-orange-200" },
  { key: "processing", icon: Package, label: "Processing", color: "text-orange-500 bg-orange-50 border-orange-200" },
  { key: "shipped", icon: Truck, label: "Shipped", color: "text-purple-500 bg-purple-50 border-purple-200" },
  { key: "delivered", icon: CheckCircle2, label: "Delivered", color: "text-green-500 bg-green-50 border-green-200" },
];

const STEP_KEYS = STEPS.map(s => s.key);

export default function OrderStatusCard({ orderId, isVendor }) {
  const queryClient = useQueryClient();

  const { data: order } = useQuery({
    queryKey: ["chatOrder", orderId],
    queryFn: () => ordersAPI.get(orderId),
    enabled: !!orderId,
    refetchInterval: 5000,
  });

  const updateMutation = useMutation({
    mutationFn: (status) => ordersAPI.update(orderId, { status }),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["chatOrder", orderId] });
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      toast.success(`Order marked as ${status}`);
    },
  });

  if (!order) return null;

  const currentStep = STEP_KEYS.indexOf(order.status);
  const nextStep = STEPS[currentStep + 1];
  const currentConfig = STEPS[currentStep] || STEPS[0];
  const CurrentIcon = currentConfig.icon;

  return (
    <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Order #{order.id?.slice(-6)}</span>
        </div>
        <Link to={createPageUrl("Orders")} className="text-[10px] text-orange-500 font-semibold flex items-center gap-0.5 hover:underline">
          View <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Progress bar */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-0.5">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${i <= currentStep ? step.color : "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-500"}`}>
                <step.icon className="w-2.5 h-2.5" />
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 ${i < currentStep ? "bg-orange-400" : "bg-slate-200 dark:bg-slate-600"}`} />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {STEPS.map((step) => (
            <span key={step.key} className="text-[9px] text-slate-400 dark:text-slate-500 text-center" style={{ width: "20%" }}>{step.label}</span>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="px-3 py-2 border-t border-slate-50 dark:border-slate-700">
        {order.items?.slice(0, 2).map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            {item.product_image && <img src={item.product_image} className="w-7 h-7 rounded-lg object-cover" alt="" />}
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1">{item.product_title}</p>
            <p className="text-xs font-bold text-orange-600">${item.price?.toFixed(2)}</p>
          </div>
        ))}
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Total: ${order.total?.toFixed(2)}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${currentConfig.color}`}>
            {currentConfig.label}
          </span>
        </div>
      </div>

      {/* Vendor action */}
      {isVendor && nextStep && order.status !== "delivered" && (
        <div className="px-3 pb-3">
          <button
            onClick={() => updateMutation.mutate(nextStep.key)}
            disabled={updateMutation.isPending}
            className="w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            <nextStep.icon className="w-3 h-3" />
            Mark as {nextStep.label}
          </button>
        </div>
      )}
    </div>
  );
}
