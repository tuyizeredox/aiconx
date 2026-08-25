import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import { recordSignal } from "@/lib/personalization";

/**
 * The products worn/used in a post, one tap away from the post itself.
 *
 * Two rules shape this sheet:
 *  - it is the only thing between the content and the product page, so every
 *    row goes straight there (Post → Shop this look → Buy);
 *  - affiliate attribution rides along invisibly as `?ref=`, because a
 *    shopper should never have to think about who gets credit for the sale.
 */
export default function ShopThisLook({ open, onOpenChange, products = [], refCode, creatorName }) {
  const { t } = useTranslation();

  const productUrl = (id) =>
    createPageUrl("ProductDetail") + "?id=" + id + (refCode ? "&ref=" + refCode : "");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 max-h-[85vh]">
        <DrawerHeader className="text-left px-5 pt-2 pb-3">
          <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white">
            {t("home.shopThisLook")}
          </DrawerTitle>
          <DrawerDescription className="text-sm text-slate-500 dark:text-ink-400">
            {creatorName
              ? t("home.shopThisLookByCreator", { count: products.length, name: creatorName })
              : t("home.shopThisLookCount", { count: products.length })}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-3 pb-5 overflow-y-auto overscroll-contain">
          {products.map((p) => {
            const id = p.id || p._id;
            const soldOut = p.status === "sold_out" || p.inventory_count === 0;
            return (
              <Link
                key={id}
                to={productUrl(id)}
                onClick={() => {
                  recordSignal("view", { id, category: p.category, price: p.price, store_id: p.store_id });
                  onOpenChange(false);
                }}
                className="flex items-center gap-3.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-ink-800/60 transition-colors"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-ink-800 shrink-0 flex items-center justify-center">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-5 h-5 text-slate-300 dark:text-ink-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-1">
                    {p.title || t("common.viewTaggedProduct")}
                  </p>
                  <p className="text-[15px] font-bold text-slate-900 dark:text-white mt-0.5">
                    {formatCurrency(p.price)}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${soldOut ? "text-slate-400 dark:text-ink-500" : "text-green-600 dark:text-green-500"}`}>
                    {soldOut ? t("product.outOfStock") : t("product.inStock")}
                    {p.store_name ? " · " + p.store_name : ""}
                  </p>
                </div>

                <span className="shrink-0 h-9 px-4 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 text-[13px] font-bold flex items-center">
                  {soldOut ? t("common.view") : t("product.buyNow")}
                </span>
              </Link>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
