import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import {
  Image, Video, X, Send, Loader2, Globe, Users, Lock, Smile, ShoppingBag, Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { authAPI, productsAPI, affiliateLinksAPI, communitiesAPI, usersAPI, postsAPI } from "@/api/apiClient";
import { generateVideoThumbnail } from "@/lib/videoThumbnail";
import { usePostUpload } from "@/lib/PostUploadContext";
import AvatarImg from "@/components/shared/AvatarImg";
import BackLink from "@/components/shared/BackLink";
import { useTranslation } from "react-i18next";

const QUICK_EMOJIS = ["😍", "🔥", "💯", "🎉", "❤️", "✨", "🛍️", "👏"];
const MAX_TAGGED_ITEMS = 3;

export default function CreatePost() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { startUpload } = usePostUpload();
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get('edit');
  const isEditMode = !!editPostId;
  const communityId = searchParams.get('community_id');
  const tagProductId = searchParams.get('tag_product');

  const VISIBILITY_OPTIONS = [
    { value: "public", icon: Globe, label: t("create.visibilityPublic") },
    { value: "followers", icon: Users, label: t("create.visibilityFollowers") },
    { value: "community", icon: Lock, label: t("create.visibilityCommunity") },
  ];
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState([]);
  // Index-aligned with mediaFiles: { file, previewUrl } for auto-generated video posters, or null
  const [mediaThumbnails, setMediaThumbnails] = useState([]);
  const [visibility, setVisibility] = useState(communityId ? "community" : "public");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [taggedProducts, setTaggedProducts] = useState([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [selectedAffiliateLinks, setSelectedAffiliateLinks] = useState([]);
  const [showAffiliateSearch, setShowAffiliateSearch] = useState(false);
  const [isFormPopulated, setIsFormPopulated] = useState(false);
  const [hasAppliedPrefillProduct, setHasAppliedPrefillProduct] = useState(false);
  const textareaRef = useRef(null);
  // Text right after an "@" the caret is currently inside, or null when not mid-mention
  const [mentionQuery, setMentionQuery] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authAPI.me(),
  });

  const { data: postingCommunity } = useQuery({
    queryKey: ["community", communityId],
    queryFn: async () => {
      const res = await communitiesAPI.get(communityId);
      return res.data || res;
    },
    enabled: !!communityId && !isEditMode,
  });

  const { data: searchedProductsResponse } = useQuery({
    queryKey: ["productSearch", productQuery],
    queryFn: () => productQuery
      ? productsAPI.list({ search: productQuery, limit: 20 })
      : productsAPI.list({ sort: "-sales_count", limit: 20 }),
    enabled: showProductSearch,
    staleTime: 60000,
  });

  const { data: myAffiliateLinksResponse } = useQuery({
    queryKey: ["myAffiliateLinks"],
    queryFn: () => affiliateLinksAPI.listForMe({ status: 'active', limit: 50 }),
    enabled: showAffiliateSearch,
    staleTime: 60000,
  });

  const { data: mentionResults } = useQuery({
    queryKey: ["mentionSearch", mentionQuery],
    queryFn: () => usersAPI.search(mentionQuery),
    enabled: !!mentionQuery,
    staleTime: 30000,
  });
  const mentionUsers = (Array.isArray(mentionResults) ? mentionResults : mentionResults?.data || [])
    .filter(u => u.username !== currentUser?.username)
    .slice(0, 6);

  const { data: editPost, isLoading: editPostLoading } = useQuery({
    queryKey: ["postDetail", editPostId],
    queryFn: async () => postsAPI.get(editPostId),
    enabled: !!editPostId,
  });

  const { data: editTaggedProducts } = useQuery({
    queryKey: ["editTaggedProducts", editPost?.tagged_products],
    queryFn: async () => {
      const ids = editPost?.tagged_products || [];
      if (ids.length === 0) return [];
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await productsAPI.get(id);
            return res?.data || res;
          } catch {
            return null;
          }
        })
      );
      return results.filter(Boolean);
    },
    enabled: !!editPost?.tagged_products?.length,
  });

  // Seller shortcut: MyStore links to `?tag_product=<id>` so the composer opens with
  // that product already tagged, instead of the seller having to search for it.
  const { data: prefillProduct } = useQuery({
    queryKey: ["prefillTagProduct", tagProductId],
    queryFn: async () => {
      const res = await productsAPI.get(tagProductId);
      return res?.data || res;
    },
    enabled: !!tagProductId && !isEditMode,
    staleTime: 60000,
  });

  const { data: editAffiliateLinks } = useQuery({
    queryKey: ["editAffiliateLinks", editPost?.affiliate_links],
    queryFn: async () => {
      const ids = editPost?.affiliate_links || [];
      if (ids.length === 0) return [];
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await affiliateLinksAPI.get(id);
            return res?.data || res;
          } catch {
            return null;
          }
        })
      );
      return results.filter(Boolean);
    },
    enabled: !!editPost?.affiliate_links?.length,
  });

  const detectMediaType = (url) => {
    if (!url) return 'image';
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".m4v", ".avi", ".mkv", ".flv", ".wmv", ".3gp"];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || url.includes("video/upload") ? "video" : "image";
  };

  useEffect(() => {
    if (editPostId) {
      setContent("");
      setVisibility("public");
      setMediaPreviewUrls([]);
      setMediaFiles([]);
      setMediaThumbnails([]);
      setTaggedProducts([]);
      setSelectedAffiliateLinks([]);
      setIsFormPopulated(false);
    }
  }, [editPostId]);

  useEffect(() => {
    if (editPost && !isFormPopulated) {
      setContent(editPost.content || "");
      setVisibility(editPost.visibility || "public");
      setMediaPreviewUrls((editPost.media_urls || []).map(url => ({ url, type: detectMediaType(url) })));
      setMediaFiles(new Array((editPost.media_urls || []).length).fill(null));
      setMediaThumbnails(new Array((editPost.media_urls || []).length).fill(null));
      setTaggedProducts((editTaggedProducts || []).map(p => ({ ...p, id: p.id || p._id })));
      setSelectedAffiliateLinks((editAffiliateLinks || []).map(l => ({ ...l, id: l.id || l._id })));
      setIsFormPopulated(true);
    }
  }, [editPost, editTaggedProducts, editAffiliateLinks, isFormPopulated]);

  useEffect(() => {
    if (prefillProduct && !hasAppliedPrefillProduct) {
      const productId = prefillProduct.id || prefillProduct._id;
      setTaggedProducts(prev => prev.some(p => (p.id || p._id) === productId)
        ? prev
        : [...prev, { ...prefillProduct, id: productId }].slice(0, MAX_TAGGED_ITEMS));
      setHasAppliedPrefillProduct(true);
    }
  }, [prefillProduct, hasAppliedPrefillProduct]);

  // Extract products array from response (handle both array and object responses)
  const searchedProducts = Array.isArray(searchedProductsResponse)
    ? searchedProductsResponse
    : searchedProductsResponse?.data || [];

  const filteredProducts = productQuery
    ? searchedProducts.filter(p => p.title?.toLowerCase().includes(productQuery.toLowerCase()))
    : searchedProducts.slice(0, 6);

  const myAffiliateLinks = (myAffiliateLinksResponse?.links || []).map(l => ({ ...l, id: l.id || l._id }));

  // Hands the actual upload + post creation off to PostUploadProvider (mounted
  // once at the app root) and leaves immediately — the request keeps running
  // in the background regardless of what page the user navigates to next,
  // with progress surfaced globally via PostUploadIndicator and a toast on
  // completion instead of blocking this screen until the network finishes.
  const handleSubmit = () => {
    if (!canPost) return;
    setIsSubmitting(true);

    startUpload({
      content,
      mediaFiles,
      mediaPreviewUrls,
      mediaThumbnails,
      taggedProducts,
      selectedAffiliateLinks,
      visibility,
      isEditMode,
      editPostId,
      editPost,
      communityId,
    });

    navigate(
      isEditMode
        ? createPageUrl("PostDetail") + `?id=${editPostId}`
        : communityId
        ? createPageUrl("CommunityDetail") + `?id=${communityId}`
        : createPageUrl("Home")
    );
  };

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file types and size
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg'];
    let hasInvalidFiles = false;
    
    const valid = files.filter(f => {
      if (!validTypes.includes(f.type)) {
        toast.error(`Unsupported file type: ${f.type}. Supported: images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, OGG)`);
        hasInvalidFiles = true;
        return false;
      }
      if (f.size >= 200 * 1024 * 1024) {
        toast.error(`File too large: ${f.name} (${Math.round(f.size / 1024 / 1024)}MB). Max 200MB.`);
        hasInvalidFiles = true;
        return false;
      }
      return true;
    });
    
    if (hasInvalidFiles) {
      toast.error(t("create.someFilesRejected"));
    }

    if (valid.length === 0) {
      e.target.value = "";
      return;
    }

    const startIndex = mediaFiles.length;
    setMediaFiles(prev => [...prev, ...valid]);
    setMediaThumbnails(prev => {
      const next = [...prev];
      valid.forEach((_, j) => { next[startIndex + j] = null; });
      return next;
    });

    valid.forEach((file, j) => {
      const targetIndex = startIndex + j;
      const reader = new FileReader();
      reader.onload = (ev) => setMediaPreviewUrls(prev => [...prev, { url: ev.target.result, type: file.type }]);
      reader.readAsDataURL(file);

      if (file.type.startsWith("video/")) {
        generateVideoThumbnail(file)
          .then(thumbFile => {
            const previewUrl = URL.createObjectURL(thumbFile);
            setMediaThumbnails(prev => {
              const next = [...prev];
              next[targetIndex] = { file: thumbFile, previewUrl };
              return next;
            });
          })
          .catch(err => console.warn("Thumbnail generation failed:", err));
      }
    });
    e.target.value = "";
  };

  const removeMedia = (index) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setMediaThumbnails(prev => {
      const removed = prev[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const addEmoji = (emoji) => {
    setContent(c => c + emoji);
    setShowEmoji(false);
  };

  const MENTION_TOKEN_REGEX = /(?:^|\s)@([a-zA-Z0-9_]{0,30})$/;

  // Reads the caret position out of the textarea to tell whether it's
  // sitting right after an in-progress "@username" token.
  const syncMentionQuery = (el) => {
    if (!el) return;
    const uptoCursor = el.value.slice(0, el.selectionStart);
    const match = uptoCursor.match(MENTION_TOKEN_REGEX);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (username) => {
    const el = textareaRef.current;
    const cursor = el ? el.selectionStart : content.length;
    const uptoCursor = content.slice(0, cursor);
    const afterCursor = content.slice(cursor);
    const replaced = uptoCursor.replace(MENTION_TOKEN_REGEX, (m) => `${m.slice(0, m.length - mentionQuery.length - 1)}@${username} `);
    const newContent = replaced + afterCursor;
    setContent(newContent);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(replaced.length, replaced.length);
    });
  };

  const toggleProduct = (product) => {
    setTaggedProducts(prev => {
      if (prev.find(p => p.id === product.id)) return prev.filter(p => p.id !== product.id);
      if (prev.length >= MAX_TAGGED_ITEMS) {
        toast.error(t("create.maxTaggedProducts", { max: MAX_TAGGED_ITEMS }) || `You can tag up to ${MAX_TAGGED_ITEMS} products`);
        return prev;
      }
      return [...prev, product];
    });
  };

  const toggleAffiliateLink = (link) => {
    setSelectedAffiliateLinks(prev => {
      if (prev.find(l => l.id === link.id)) return prev.filter(l => l.id !== link.id);
      if (prev.length >= MAX_TAGGED_ITEMS) {
        toast.error(t("create.maxAffiliateLinks", { max: MAX_TAGGED_ITEMS }) || `You can add up to ${MAX_TAGGED_ITEMS} affiliate links`);
        return prev;
      }
      return [...prev, link];
    });
  };

  const canPost = (content.trim() || mediaPreviewUrls.length > 0) && !isSubmitting;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <BackLink to="Home" label={t("common.backTo", { page: t("nav.home") })} />
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{isEditMode ? (t("create.editPost") || "Edit Post") : t("create.createPost")}</h1>

      {isEditMode && editPostLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
        {/* Author row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-semibold text-lg shrink-0">
            {currentUser?.full_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{currentUser?.full_name || t("create.you")}</p>
            {communityId && !isEditMode ? (
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Lock className="w-3 h-3" />
                {t("create.postingInCommunity", { name: postingCommunity?.name || t("create.visibilityCommunity") })}
              </p>
            ) : (
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="h-6 text-xs w-auto border-none shadow-none p-0 px-1 text-slate-500 dark:text-slate-400 gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-1.5">
                        <opt.icon className="w-3 h-3" />{opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Text area */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={e => { setContent(e.target.value); syncMentionQuery(e.target); }}
          onClick={e => syncMentionQuery(e.target)}
          onKeyUp={e => { if (e.key !== "Escape") syncMentionQuery(e.target); }}
          onKeyDown={e => { if (e.key === "Escape" && mentionQuery !== null) setMentionQuery(null); }}
          placeholder={t("create.postPlaceholder")}
          className="border-none shadow-none resize-none text-base placeholder:text-slate-300 dark:placeholder:text-slate-600 focus-visible:ring-0 min-h-[120px] p-0 text-slate-800 dark:text-slate-200"
        />

        {/* @mention autocomplete */}
        {mentionQuery !== null && mentionQuery.length > 0 && (
          <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            {mentionUsers.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">{t("create.noUsersFound") || "No users found"}</p>
            ) : mentionUsers.map(u => (
              <button
                key={u.username}
                onClick={() => insertMention(u.username)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <AvatarImg
                    src={u.avatar_url}
                    className="w-full h-full object-cover"
                    fallback={(u.display_name || u.username)?.[0]?.toUpperCase()}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{u.display_name || u.username}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Tagged products */}
        {taggedProducts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-xl border border-orange-100 dark:border-orange-900">
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 w-full mb-1">{t("create.taggedProducts")} ({taggedProducts.length}/{MAX_TAGGED_ITEMS})</p>
            {taggedProducts.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1 border border-orange-100 dark:border-orange-900 text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium">{p.title}</span>
                <button onClick={() => toggleProduct(p)} className="text-slate-400 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Selected affiliate links */}
        {selectedAffiliateLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 p-3 bg-purple-50 dark:bg-purple-950 rounded-xl border border-purple-100 dark:border-purple-900">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 w-full mb-1">Affiliate Links ({selectedAffiliateLinks.length}/{MAX_TAGGED_ITEMS})</p>
            {selectedAffiliateLinks.map(link => (
              <div key={link.id} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1 border border-purple-100 dark:border-purple-900 text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium">{link.product_title}</span>
                <span className="text-purple-600 dark:text-purple-400 font-bold">{link.commission_pct}%</span>
                <button onClick={() => toggleAffiliateLink(link)} className="text-slate-400 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Media previews */}
        {mediaPreviewUrls.length > 0 && (
          <div className={`grid gap-2 mt-4 ${mediaPreviewUrls.length === 1 ? "grid-cols-1" : mediaPreviewUrls.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
            {mediaPreviewUrls.map((media, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 group">
                {media.type?.startsWith("video") ? (
                  <video
                    src={media.url}
                    poster={mediaThumbnails[i]?.previewUrl}
                    className="w-full h-auto max-h-96 object-contain"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <>
                    <img src={media.url} alt="" className="w-full h-auto max-h-96 object-contain" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </>
                )}
                <button
                  onClick={() => removeMedia(i)}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors z-20"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                {media.type?.startsWith("video") && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full z-20 pointer-events-none">VIDEO</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Product tag search */}
        <AnimatePresence>
          {showProductSearch && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 p-2 border-b border-slate-100 dark:border-slate-700">
                <input
                  autoFocus
                  value={productQuery}
                  onChange={e => setProductQuery(e.target.value)}
                  placeholder={t("create.searchProductsToTag")}
                  className="flex-1 text-sm outline-none text-slate-700 dark:text-slate-300 bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 px-1"
                />
                <button onClick={() => { setShowProductSearch(false); setProductQuery(""); }}><X className="w-4 h-4 text-slate-400 dark:text-slate-500" /></button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">{t("create.noProductsFound")}</p>
                ) : filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { toggleProduct(p); setShowProductSearch(false); setProductQuery(""); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{p.title}</p>
                      <p className="text-xs text-orange-600 font-bold">{formatCurrency(p.price)}</p>
                    </div>
                    {taggedProducts.find(tp => tp.id === p.id) && (
                      <Badge className="bg-orange-100 text-orange-700 text-[10px] border-0">{t("create.taggedLabel")}</Badge>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Affiliate link search */}
        <AnimatePresence>
          {showAffiliateSearch && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 p-2 border-b border-slate-100 dark:border-slate-700">
                <input
                  autoFocus
                  placeholder="Search your affiliate links"
                  className="flex-1 text-sm outline-none text-slate-700 dark:text-slate-300 bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 px-1"
                />
                <button onClick={() => setShowAffiliateSearch(false)}><X className="w-4 h-4 text-slate-400 dark:text-slate-500" /></button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {myAffiliateLinks.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No affiliate links found. Create some first!</p>
                ) : myAffiliateLinks.map(link => (
                  <button
                    key={link.id}
                    onClick={() => { toggleAffiliateLink(link); setShowAffiliateSearch(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900 overflow-hidden shrink-0 flex items-center justify-center">
                      <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{link.product_title}</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-bold">{link.commission_pct}% commission</p>
                    </div>
                    {selectedAffiliateLinks.find(sl => sl.id === link.id) && (
                      <Badge className="bg-purple-100 text-purple-700 text-[10px] border-0">Selected</Badge>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emoji picker */}
        <AnimatePresence>
          {showEmoji && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex gap-2 mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              {QUICK_EMOJIS.map(e => (
                <button key={e} onClick={() => addEmoji(e)} className="text-2xl hover:scale-125 transition-transform">{e}</button>
              ))}
              <button onClick={() => setShowEmoji(false)} className="ml-auto text-slate-400 dark:text-slate-500"><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action bar */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1 flex-wrap">
            <label className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-slate-500 dark:text-slate-400 text-sm transition-colors">
              <Image className="w-5 h-5 text-green-500" />
              <span className="hidden sm:inline text-xs">{t("create.photo")}</span>
              <input type="file" accept="image/*,image/gif" multiple className="hidden" onChange={handleMediaSelect} />
            </label>
            <label className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-slate-500 dark:text-slate-400 text-sm transition-colors">
              <Video className="w-5 h-5 text-orange-500" />
              <span className="hidden sm:inline text-xs">{t("create.video")}</span>
              <input type="file" accept="video/*" multiple className="hidden" onChange={handleMediaSelect} />
            </label>
            <button
              onClick={() => { setShowProductSearch(v => !v); setShowEmoji(false); setShowAffiliateSearch(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-slate-500 dark:text-slate-400 text-sm transition-colors ${showProductSearch ? "bg-orange-50 dark:bg-orange-950 text-orange-600" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              <ShoppingBag className="w-5 h-5 text-purple-500" />
              <span className="hidden sm:inline text-xs">{t("create.tag")}</span>
            </button>
            <button
              onClick={() => { setShowAffiliateSearch(v => !v); setShowEmoji(false); setShowProductSearch(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-slate-500 dark:text-slate-400 text-sm transition-colors ${showAffiliateSearch ? "bg-purple-50 dark:bg-purple-950 text-purple-600" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              <Link2 className="w-5 h-5 text-purple-500" />
              <span className="hidden sm:inline text-xs">Affiliate</span>
            </button>
            <button
              onClick={() => { setShowEmoji(v => !v); setShowProductSearch(false); setShowAffiliateSearch(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-slate-500 dark:text-slate-400 text-sm transition-colors ${showEmoji ? "bg-amber-50 dark:bg-amber-950 text-amber-600" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              <Smile className="w-5 h-5 text-amber-500" />
            </button>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canPost}
            className="bg-orange-600 hover:bg-orange-700 rounded-xl px-5 gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t("create.posting")}</>
            ) : (
              <><Send className="w-4 h-4" /> {isEditMode ? (t("create.update") || "Update") : t("create.post")}</>
            )}
          </Button>
        </div>
      </div>

      {/* Character count hint */}
      {content.length > 200 && (
        <p className={`text-xs mt-2 text-right ${content.length > 2200 ? "text-red-500" : "text-slate-400 dark:text-slate-500"}`}>
          {content.length}/2200
        </p>
      )}
        </>
      )}
    </div>
  );
}
