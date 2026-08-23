import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Share2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useAffiliateLink } from "@/hooks/useAffiliateLink";
import { useNativeShare } from "@/hooks/useNativeShare";
import ShareModal from "./ShareModal";

/**
 * A standalone share control for listings that draw their own product markup
 * rather than using ProductCard.
 *
 * Everything a share needs — minting the sharer's affiliate link, the native
 * sheet, and the dialog fallback — is packed in here so a listing only has to
 * drop in one element. Renders nothing where there is nothing to earn, so it
 * never becomes a second, weaker share button next to a real one.
 */
export default function ProductShareButton({ product, className = "", size = "sm" }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const affiliate = useAffiliateLink(product, currentUser, { authoritative: false });
  const nativeShare = useNativeShare({
    product,
    resolveUrl: affiliate.ensureLink,
    onFallback: () => setIsShareModalOpen(true),
  });

  if (!product || !affiliate.eligible || affiliate.amount <= 0) return null;

  const box = size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const icon = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          nativeShare();
        }}
        aria-label={t("affiliate.shareToEarn")}
        title={t("affiliate.shareToEarn")}
        className={`${box} flex items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors shrink-0 ${className}`}
      >
        <Share2 className={icon} />
      </button>

      <ShareModal
        isOpen={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        product={product}
        currentUser={currentUser}
      />
    </>
  );
}
