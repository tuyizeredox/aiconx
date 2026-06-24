import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import {
  Image, Video, X, Send, Loader2, Globe, Users, Lock, Smile, ShoppingBag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { authAPI, productsAPI, filesAPI, postsAPI } from "@/api/apiClient";
import { useTranslation } from "react-i18next";

const QUICK_EMOJIS = ["😍", "🔥", "💯", "🎉", "❤️", "✨", "🛍️", "👏"];

export default function CreatePost() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const VISIBILITY_OPTIONS = [
    { value: "public", icon: Globe, label: t("create.visibilityPublic") },
    { value: "followers", icon: Users, label: t("create.visibilityFollowers") },
    { value: "community", icon: Lock, label: t("create.visibilityCommunity") },
  ];
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState([]);
  const [visibility, setVisibility] = useState("public");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [taggedProducts, setTaggedProducts] = useState([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productQuery, setProductQuery] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authAPI.me(),
  });

  const { data: searchedProductsResponse } = useQuery({
    queryKey: ["productSearch", productQuery],
    queryFn: () => productsAPI.list({ sort: "-sales_count", limit: 20 }),
    enabled: showProductSearch,
    staleTime: 60000,
  });

  // Extract products array from response (handle both array and object responses)
  const searchedProducts = Array.isArray(searchedProductsResponse) 
    ? searchedProductsResponse 
    : searchedProductsResponse?.products || [];

  const filteredProducts = productQuery
    ? searchedProducts.filter(p => p.title?.toLowerCase().includes(productQuery.toLowerCase()))
    : searchedProducts.slice(0, 6);

  const createMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      setUploadProgress(0);

      const uploadedUrls = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        
        try {
          console.log(`Uploading file ${i + 1}/${mediaFiles.length}:`, file.name);
          const res = await filesAPI.upload(file);
          const file_url = res.url;
          if (!file_url) throw new Error("No URL returned from upload");
          uploadedUrls.push(file_url);
          setUploadProgress(Math.round(((i + 1) / mediaFiles.length) * 100));
        } catch (error) {
          console.error(`Failed to upload file ${i + 1}:`, error);
          throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        }
      }

      const hasVideo = mediaFiles.some(f => f.type?.startsWith("video"));
      const mediaType = mediaFiles.length === 0 ? "text" : hasVideo ? "video" : "image";

      const postData = {
        content: content?.trim() || "",
        media_urls: uploadedUrls || [],
        media_type: mediaType || "text",
        tagged_products: (taggedProducts || [])
          .map(p => {
            const rawId = p.id || p._id || (typeof p === 'string' ? p : null);
            if (!rawId || rawId === "undefined" || rawId === "null" || typeof rawId === "object") return null;
            return String(rawId);
          })
          .filter(id => !!id && id !== "[object Object]"),
        visibility: visibility || "public",
        author_username: currentUser?.username || undefined,
        author_name: (currentUser?.full_name || currentUser?.display_name) || undefined,
      };

      console.log('Creating post with final data:', JSON.stringify(postData, null, 2));
      
      try {
        const response = await postsAPI.create(postData);
        return response;
      } catch (err) {
        console.error('API Error during post creation:', err);
        if (err.details) {
          const detailMsg = Array.isArray(err.details) 
            ? err.details.map(d => `${d.path.join('.')}: ${d.message}`).join(', ')
            : JSON.stringify(err.details);
          throw new Error(`Validation failed: ${detailMsg}`);
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      toast.success(t("create.postCreated"));
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      // Clear local state
      setContent("");
      setMediaFiles([]);
      setMediaPreviewUrls([]);
      setTaggedProducts([]);
      
      navigate(createPageUrl("Home"));
    },
    onError: (error) => {
      console.error('Post creation failed:', error);
      toast.error(error.message || t("create.failedToCreatePost"));
    },
    onSettled: () => { setUploading(false); setUploadProgress(0); },
  });

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file types and size
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg'];
    const valid = files.filter(f => {
      if (!validTypes.includes(f.type)) {
        toast.error(`Unsupported file type: ${f.type}. Supported: images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, OGG)`);
        return false;
      }
      if (f.size >= 50 * 1024 * 1024) {
        toast.error(`File too large: ${f.name} (${Math.round(f.size / 1024 / 1024)}MB). Max 50MB.`);
        return false;
      }
      return true;
    });
    
    if (valid.length < files.length) {
      toast.error(t("create.someFilesRejected"));
    }

    setMediaFiles(prev => [...prev, ...valid]);
    valid.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setMediaPreviewUrls(prev => [...prev, { url: ev.target.result, type: file.type }]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeMedia = (index) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const addEmoji = (emoji) => {
    setContent(c => c + emoji);
    setShowEmoji(false);
  };

  const toggleProduct = (product) => {
    setTaggedProducts(prev =>
      prev.find(p => p.id === product.id)
        ? prev.filter(p => p.id !== product.id)
        : [...prev, product]
    );
  };

  const canPost = (content.trim() || mediaFiles.length > 0) && !uploading;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t("create.createPost")}</h1>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        {/* Author row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-lg shrink-0">
            {currentUser?.full_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{currentUser?.full_name || t("create.you")}</p>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="h-6 text-xs w-auto border-none shadow-none p-0 px-1 text-slate-500 gap-1">
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
          </div>
        </div>

        {/* Text area */}
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={t("create.postPlaceholder")}
          className="border-none shadow-none resize-none text-base placeholder:text-slate-300 focus-visible:ring-0 min-h-[120px] p-0 text-slate-800"
        />

        {/* Tagged products */}
        {taggedProducts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <p className="text-xs font-semibold text-indigo-700 w-full mb-1">{t("create.taggedProducts")}</p>
            {taggedProducts.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-1 border border-indigo-100 text-xs">
                <span className="text-slate-700 font-medium">{p.title}</span>
                <button onClick={() => toggleProduct(p)} className="text-slate-400 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Media previews */}
        {mediaPreviewUrls.length > 0 && (
          <div className={`grid gap-2 mt-4 ${mediaPreviewUrls.length === 1 ? "grid-cols-1" : mediaPreviewUrls.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {mediaPreviewUrls.map((media, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group">
                {media.type?.startsWith("video") ? (
                  <video src={media.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={media.url} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <button
                  onClick={() => removeMedia(i)}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                {media.type?.startsWith("video") && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">VIDEO</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload progress */}
        {uploading && uploadProgress > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{t("create.uploadingMedia")}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-indigo-500 rounded-full"
              />
            </div>
          </div>
        )}

        {/* Product tag search */}
        <AnimatePresence>
          {showProductSearch && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 p-2 border-b border-slate-100">
                <input
                  autoFocus
                  value={productQuery}
                  onChange={e => setProductQuery(e.target.value)}
                  placeholder={t("create.searchProductsToTag")}
                  className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400 px-1"
                />
                <button onClick={() => { setShowProductSearch(false); setProductQuery(""); }}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">{t("create.noProductsFound")}</p>
                ) : filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { toggleProduct(p); setShowProductSearch(false); setProductQuery(""); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{p.title}</p>
                      <p className="text-xs text-indigo-600 font-bold">{formatCurrency(p.price)}</p>
                    </div>
                    {taggedProducts.find(tp => tp.id === p.id) && (
                      <Badge className="bg-indigo-100 text-indigo-700 text-[10px] border-0">{t("create.taggedLabel")}</Badge>
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
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex gap-2 mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              {QUICK_EMOJIS.map(e => (
                <button key={e} onClick={() => addEmoji(e)} className="text-2xl hover:scale-125 transition-transform">{e}</button>
              ))}
              <button onClick={() => setShowEmoji(false)} className="ml-auto text-slate-400"><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action bar */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1 flex-wrap">
            <label className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 cursor-pointer text-slate-500 text-sm transition-colors">
              <Image className="w-5 h-5 text-green-500" />
              <span className="hidden sm:inline text-xs">{t("create.photo")}</span>
              <input type="file" accept="image/*,image/gif" multiple className="hidden" onChange={handleMediaSelect} />
            </label>
            <label className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 cursor-pointer text-slate-500 text-sm transition-colors">
              <Video className="w-5 h-5 text-blue-500" />
              <span className="hidden sm:inline text-xs">{t("create.video")}</span>
              <input type="file" accept="video/*" multiple className="hidden" onChange={handleMediaSelect} />
            </label>
            <button
              onClick={() => { setShowProductSearch(v => !v); setShowEmoji(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-slate-500 text-sm transition-colors ${showProductSearch ? "bg-indigo-50 text-indigo-600" : "hover:bg-slate-50"}`}
            >
              <ShoppingBag className="w-5 h-5 text-purple-500" />
              <span className="hidden sm:inline text-xs">{t("create.tag")}</span>
            </button>
            <button
              onClick={() => { setShowEmoji(v => !v); setShowProductSearch(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-slate-500 text-sm transition-colors ${showEmoji ? "bg-amber-50 text-amber-600" : "hover:bg-slate-50"}`}
            >
              <Smile className="w-5 h-5 text-amber-500" />
            </button>
          </div>

          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canPost}
            className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-5 gap-2"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t("create.posting")}</>
            ) : (
              <><Send className="w-4 h-4" /> {t("create.post")}</>
            )}
          </Button>
        </div>
      </div>

      {/* Character count hint */}
      {content.length > 200 && (
        <p className={`text-xs mt-2 text-right ${content.length > 2200 ? "text-red-500" : "text-slate-400"}`}>
          {content.length}/2200
        </p>
      )}
    </div>
  );
}