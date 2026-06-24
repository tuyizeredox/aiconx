import React, { useState } from "react";
import { reviewsAPI, filesAPI } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Upload, X, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export default function ReviewForm({ productId, storeId, currentUser, onClose }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  // Cleanup object URLs to prevent memory leaks
  React.useEffect(() => {
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const updatedFiles = [...mediaFiles, ...files].slice(0, 5);
    
    // Revoke old previews before creating new ones
    previews.forEach(url => URL.revokeObjectURL(url));
    
    const updatedPreviews = updatedFiles.map(f => URL.createObjectURL(f));
    setMediaFiles(updatedFiles);
    setPreviews(updatedPreviews);
  };

  const removeMedia = (index) => {
    // Revoke the specific URL being removed
    URL.revokeObjectURL(previews[index]);
    
    const updatedFiles = mediaFiles.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    setMediaFiles(updatedFiles);
    setPreviews(updatedPreviews);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!productId || !storeId) {
        toast.error(t("product.missingProductInfo"));
        throw new Error("Missing product_id or store_id");
      }

      setUploading(true);
      let uploadedUrls = [];
      try {
        for (const file of mediaFiles) {
          const res = await filesAPI.upload(file);
          if (res.url) {
            uploadedUrls.push(res.url);
          }
        }
      } catch (error) {
        toast.error(t("product.failedToUploadMedia"));
        throw error;
      } finally {
        setUploading(false);
      }
      
      await reviewsAPI.create({
        product_id: productId,
        store_id: storeId,
        reviewer_username: currentUser.username,
        reviewer_name: currentUser.display_name || currentUser.username,
        rating,
        title,
        content,
        media_urls: uploadedUrls,
        is_verified_purchase: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productReviews"] });
      toast.success(t("product.reviewSubmitted"));
      onClose?.();
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-200 p-5">
      <h4 className="font-semibold text-slate-900 mb-4">{t("product.writeReview")}</h4>

      {/* Star Rating */}
      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            onMouseEnter={() => setHoverRating(s)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(s)}
          >
            <Star className={`w-8 h-8 transition-colors ${s <= (hoverRating || rating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
          </button>
        ))}
        {rating > 0 && <span className="text-sm text-slate-500 ml-2">{["", t("product.ratingPoor"), t("product.ratingFair"), t("product.ratingGood"), t("product.ratingVeryGood"), t("product.ratingExcellent")][rating]}</span>}
      </div>

      <Input
        placeholder={t("product.reviewTitlePlaceholder")}
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="mb-3 rounded-xl"
      />
      <Textarea
        placeholder={t("product.reviewContentPlaceholder")}
        value={content}
        onChange={e => setContent(e.target.value)}
        className="mb-3 rounded-xl h-24"
      />

      {/* Media Upload */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" /> {t("product.addPhotosVideos")}
        </p>
        <div className="flex gap-2 flex-wrap">
          {previews.map((prev, i) => (
            <div key={`preview-${i}-${prev}`} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200">
              <img src={prev} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeMedia(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {mediaFiles.length < 5 && (
            <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 transition-colors">
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-[9px] text-slate-400 mt-0.5">{t("common.upload")}</span>
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
            </label>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={rating === 0 || !content.trim() || submitMutation.isPending}
          className="bg-orange-600 hover:bg-orange-700 rounded-xl flex-1"
        >
          {submitMutation.isPending || uploading
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {uploading ? t("product.uploadingMedia") : t("product.submitting")}</>
            : t("product.submitReview")
          }
        </Button>
        {onClose && (
          <Button variant="outline" onClick={onClose} className="rounded-xl">{t("common.cancel")}</Button>
        )}
      </div>
    </motion.div>
  );
}