import React from "react";
import { createPageUrl, storeUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import StoreHeaderBar from "@/components/store/StoreHeaderBar";
import BlockWrapper from "./BlockWrapper";
import HeroBlock from "./HeroBlock";
import RichTextBlock from "./RichTextBlock";
import ImageBlock from "./ImageBlock";
import ImageTextBlock from "./ImageTextBlock";
import GalleryBlock from "./GalleryBlock";
import ProductGridBlock from "./ProductGridBlock";
import VideoBlock from "./VideoBlock";
import TestimonialsBlock from "./TestimonialsBlock";
import CtaBannerBlock from "./CtaBannerBlock";
import CategoriesBlock from "./CategoriesBlock";
import ContactBlock from "./ContactBlock";
import DividerBlock from "./DividerBlock";

const BLOCK_COMPONENTS = {
  hero: HeroBlock,
  rich_text: RichTextBlock,
  image: ImageBlock,
  image_text: ImageTextBlock,
  gallery: GalleryBlock,
  product_grid: ProductGridBlock,
  video: VideoBlock,
  testimonials: TestimonialsBlock,
  cta_banner: CtaBannerBlock,
  categories: CategoriesBlock,
  contact: ContactBlock,
  divider: DividerBlock,
};

// Hero renders its own full-bleed layout, so it skips BlockWrapper's
// max-width/padding shell rather than being nested inside it.
const UNWRAPPED_TYPES = new Set(["hero"]);

export default function StorefrontRenderer({
  store,
  products = [],
  currentUser,
  isFollowing,
  isFollowedBy,
  onFollowToggle,
  followPending,
  onShare,
}) {
  const { t } = useTranslation();
  const theme = store?.storefront_config?.theme || {};
  const blocks = (store?.storefront_config?.blocks || []).filter((b) => b.visible !== false);
  const storeId = store?.id || store?._id;
  // Every CTA/button link on the storefront falls back to the store's own
  // full product catalog when left blank — never a bare "#". This is also
  // where AI- or vendor-entered links land if they turn out to be invalid
  // (sanitized server-side in stores.ts/ai.ts before ever being saved).
  const shopLink = storeId ? storeUrl(store, { view: "shop" }) : createPageUrl("Marketplace");

  return (
    <div
      className="w-full min-h-screen bg-white dark:bg-slate-900"
      style={{
        "--store-primary": theme.primary_color || "#ea580c",
        "--store-accent": theme.accent_color || "#f97316",
      }}
    >
      <StoreHeaderBar
        store={store}
        onShare={onShare}
        backTo={createPageUrl("Marketplace")}
        backLabel={t("storeDetail.marketplace")}
        shopLink={shopLink}
      />

      <div className="flex flex-col gap-10 sm:gap-14 py-6">
        {blocks.map((block) => {
          const Component = BLOCK_COMPONENTS[block.type];
          if (!Component) return null;

          const content = (
            <Component
              block={block}
              store={store}
              products={products}
              currentUser={currentUser}
              isFollowing={isFollowing}
              isFollowedBy={isFollowedBy}
              onFollowToggle={onFollowToggle}
              followPending={followPending}
              shopLink={shopLink}
            />
          );

          if (UNWRAPPED_TYPES.has(block.type)) {
            return (
              <div key={block.id} className="max-w-6xl mx-auto w-full px-4">
                {content}
              </div>
            );
          }

          return (
            <BlockWrapper key={block.id} style={block.style}>
              {content}
            </BlockWrapper>
          );
        })}
      </div>
    </div>
  );
}
