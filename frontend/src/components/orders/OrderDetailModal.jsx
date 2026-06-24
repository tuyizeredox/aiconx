import React from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  CreditCard,
  MessageCircle,
  Calendar,
  Store,
  XCircle,
  AlertCircle,
  ShoppingBag,
  User,
  Navigation,
  Info
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OrderTrackingPanel from "./OrderTrackingPanel";

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "bg-amber-100 text-amber-700", label: "Pending" },
  confirmed: { icon: CheckCircle2, color: "bg-blue-100 text-blue-700", label: "Confirmed" },
  processing: { icon: Package, color: "bg-indigo-100 text-indigo-700", label: "Processing" },
  shipped: { icon: Truck, color: "bg-purple-100 text-purple-700", label: "Shipped" },
  delivered: { icon: CheckCircle2, color: "bg-green-100 text-green-700", label: "Delivered" },
  cancelled: { icon: XCircle, color: "bg-red-100 text-red-700", label: "Cancelled" },
  refunded: { icon: AlertCircle, color: "bg-gray-100 text-gray-700", label: "Refunded" },
};

const POSSIBLE_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];

export default function OrderDetailModal({ 
  order, 
  open, 
  onOpenChange, 
  onBuyAgain, 
  onContactVendor, 
  onContactBuyer,
  onUpdateStatus,
  userRole = "buyer" 
}) {
  if (!order) return null;

  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;
  const isVendor = userRole === "vendor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 pb-4 bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md border-b dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <Badge className={`${status.color} border-0 flex items-center gap-1.5`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </Badge>
            <p className="text-xs text-slate-400 font-mono">#{order._id?.slice(-12)}</p>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Order Details</DialogTitle>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(order.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-1 font-medium">
              {isVendor ? (
                <>
                  <User className="w-3.5 h-3.5" />
                  Buyer: {order.buyer_name || `@${order.buyer_username}`}
                </>
              ) : (
                <>
                  <Store className="w-3.5 h-3.5" />
                  {order.store_name}
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-8">
          {/* Vendor Status Management */}
          {isVendor && (
            <section className="bg-indigo-50/30 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Manage Order Status
              </h3>
              <div className="flex items-center gap-3">
                <Select 
                  value={order.status} 
                  onValueChange={(newStatus) => onUpdateStatus?.(order._id || order.id, newStatus)}
                >
                  <SelectTrigger className="flex-1 bg-white dark:bg-slate-700 rounded-xl h-11 border-indigo-100 dark:border-indigo-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSSIBLE_STATUSES.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge className={`${status.color} border-0 h-11 px-4 rounded-xl flex items-center gap-2 text-xs`}>
                  Current: {status.label}
                </Badge>
              </div>
            </section>
          )}

          {/* Status Tracker — only for shipped/shipping orders, not pickup */}
          {["pending", "processing", "shipped", "delivered", "confirmed"].includes(order.status) && order.delivery_method !== "pickup" && (
            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                {order.delivery_method === "delivery" ? (
                  <Navigation className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Truck className="w-4 h-4 text-indigo-600" />
                )}
                {order.delivery_method === "delivery" ? "Delivery Status" : "Tracking Status"}
              </h3>
              <OrderTrackingPanel order={order} />
            </div>
          )}

          {/* Pickup status info */}
          {order.delivery_method === "pickup" && ["pending", "confirmed", "processing"].includes(order.status) && order.pickup_instructions && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4">
              <Package className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider mb-1">Pickup Instructions</p>
                <p className="text-xs text-amber-700 leading-relaxed">{order.pickup_instructions}</p>
              </div>
            </div>
          )}

          {/* Items Section */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              Items ({order.items?.length})
            </h3>
            <div className="space-y-4">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex gap-4 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-2xl transition-colors">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-100 dark:border-slate-600">
                    {item.product_image ? (
                      <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.product_title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.quantity} x {formatCurrency(item.price)}
                    </p>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                    {formatCurrency(item.quantity * item.price)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator className="bg-slate-100 dark:bg-slate-700" />

          {/* Summary and Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                Payment Info
              </h3>
              <div className="space-y-3 bg-slate-50/50 dark:bg-slate-700/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-600">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Method</span>
                  <span className="font-medium text-slate-900 dark:text-white capitalize">{order.payment_method?.replace('_', ' ') || 'Card'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Status</span>
                  <Badge variant="outline" className={`text-[10px] h-5 capitalize px-1.5 ${
                    order.payment_status === 'paid' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                  }`}>
                    {order.payment_status}
                  </Badge>
                </div>
                <div className="pt-2 flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white border-t border-slate-200/60 dark:border-slate-600">
                  <span>Total Amount</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                {order.delivery_method === "pickup" ? (
                  <Package className="w-4 h-4 text-indigo-600" />
                ) : order.delivery_method === "delivery" ? (
                  <Navigation className="w-4 h-4 text-indigo-600" />
                ) : (
                  <MapPin className="w-4 h-4 text-indigo-600" />
                )}
                {order.delivery_method === "pickup" ? "Store Pickup" : order.delivery_method === "delivery" ? "Local Delivery" : "Delivery Address"}
              </h3>
              <div className="bg-slate-50/50 dark:bg-slate-700/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 h-full min-h-[100px] flex flex-col gap-3">
                {order.delivery_method === "pickup" ? (
                  <>
                    {order.pickup_instructions && (
                      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl p-3">
                        <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 leading-relaxed">{order.pickup_instructions}</p>
                      </div>
                    )}
                    {order.shipping_address && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{order.shipping_address}</p>
                    )}
                    {!order.pickup_instructions && !order.shipping_address && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Collect from store location</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
                    {order.shipping_address || "No address provided"}
                  </p>
                )}
                {order.delivery_method && (
                  <div className="mt-auto">
                    <Badge variant="secondary" className={`text-[10px] capitalize font-medium ${
                      order.delivery_method === "pickup" ? "bg-amber-100 text-amber-700" :
                      order.delivery_method === "delivery" ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {order.delivery_method === "pickup" ? "Store Pickup" : order.delivery_method === "delivery" ? "Local Delivery" : "Shipping"}
                    </Badge>
                  </div>
                )}
              </div>
            </section>
          </div>

          {order.order_note && (
            <section className="bg-amber-50/50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-800/30">
              <h4 className="text-xs font-bold text-amber-900 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertCircle className="w-3.5 h-3.5" />
                Customer Note
              </h4>
              <p className="text-xs text-amber-700 leading-relaxed italic">
                "{order.order_note}"
              </p>
            </section>
          )}

          <div className="flex flex-col gap-3 pt-4">
            {isVendor ? (
              <Button 
                onClick={() => onContactBuyer?.(order.buyer_username)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 h-12 font-semibold shadow-lg shadow-indigo-100"
              >
                <MessageCircle className="w-4 h-4" />
                Chat with Buyer
              </Button>
            ) : (
              <>
                <Button 
                  onClick={() => onContactVendor?.(order.vendor_username)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 h-12 font-semibold shadow-lg shadow-indigo-100"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contact Vendor
                </Button>
                {order.status === 'delivered' && (
                  <Button 
                    variant="outline" 
                    onClick={() => onBuyAgain?.(order)}
                    className="w-full rounded-xl gap-2 border-slate-200 dark:border-slate-600 h-12 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Buy Again
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
