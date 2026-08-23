import {
  Sparkles, AlignLeft, Image as ImageIcon, Columns, Images, ShoppingBag,
  Video, MessageSquare, Megaphone, Tag, Phone, Minus,
} from "lucide-react";

export const BLOCK_TYPE_META = {
  hero: { label: "Hero", icon: Sparkles },
  rich_text: { label: "Text", icon: AlignLeft },
  image: { label: "Image", icon: ImageIcon },
  image_text: { label: "Image + Text", icon: Columns },
  gallery: { label: "Gallery", icon: Images },
  product_grid: { label: "Product Grid", icon: ShoppingBag },
  video: { label: "Video", icon: Video },
  testimonials: { label: "Testimonials", icon: MessageSquare },
  cta_banner: { label: "Call to Action", icon: Megaphone },
  categories: { label: "Categories", icon: Tag },
  contact: { label: "Contact", icon: Phone },
  divider: { label: "Spacer", icon: Minus },
};

export const BLOCK_TYPES = Object.keys(BLOCK_TYPE_META);

export function defaultBlockData(type) {
  switch (type) {
    case "hero":
      return { type, headline: "", subheadline: "", image_url: "", video_url: "", cta_text: "", cta_link: "", overlay_opacity: 0.35, height: "tall" };
    case "rich_text":
      return { type, title: "", body: "" };
    case "image":
      return { type, image_url: "", caption: "", link: "" };
    case "image_text":
      return { type, image_url: "", title: "", body: "", cta_text: "", cta_link: "", image_position: "left" };
    case "gallery":
      return { type, title: "", images: [] };
    case "product_grid":
      return { type, title: "", mode: "newest", product_ids: [], category: "", columns: "4" };
    case "video":
      return { type, video_url: "", caption: "" };
    case "testimonials":
      return { type, title: "" };
    case "cta_banner":
      return { type, heading: "", body: "", button_text: "", button_link: "" };
    case "categories":
      return { type, title: "" };
    case "contact":
      return { type, title: "", show_social: true, show_address: true };
    case "divider":
      return { type, height: "md" };
    default:
      return { type };
  }
}

export function defaultBlockStyle(type) {
  if (type === "hero") return {};
  if (type === "divider") return { padding: "none" };
  return { padding: "md", text_align: "left", width: "contained" };
}

export function newBlock(type) {
  return {
    id: (crypto.randomUUID ? crypto.randomUUID() : `blk_${Date.now()}_${Math.random().toString(36).slice(2)}`),
    type,
    visible: true,
    style: defaultBlockStyle(type),
    data: defaultBlockData(type),
  };
}
