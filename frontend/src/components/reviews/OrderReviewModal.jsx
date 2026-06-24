import React, { useState, useEffect } from "react";
import { reviewsAPI, storeReviewsAPI, filesAPI } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Star, Camera, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import StarRating from "./StarRating";

export default function OrderReviewModal({ open, onClose, order, currentUser }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const updatedFiles = [...mediaFiles, ...files].slice(0, 3);
    
    previews.forEach(url => URL.revokeObjectURL(url));
    const updatedPreviews = updatedFiles.map(f => URL.createObjectURL(f));
    
    setMediaFiles(updatedFiles);
    setPreviews(updatedPreviews);
  };

  const removeMedia = (index) => {
    URL.revokeObjectURL(previews[index]);
    setMediaFiles(mediaFiles.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const getRatingLabel = (r) => {
    if (r === 0) return t("orders.tapToRate");
    if (r === 5) return t("product.ratingExcellent");
    if (r === 4) return t("orders.ratingGreat");
    if (r === 3) return t("product.ratingGood");
    if (r === 2) return t("product.ratingFair");
    return t("product.ratingPoor");
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      const uploadedUrls = [];
      try {
        for (const file of mediaFiles) {
          const res = await filesAPI.upload(file);
          if (res.url) uploadedUrls.push(res.url);
        }
      } catch (err) {
        toast.error(t("product.failedToUploadMedia"));
        throw err;
      } finally {
        setUploading(false);
      }

      const itemPromises = (order.items || []).map(item => {
        if (!item.product_id) return Promise.resolve();
        return reviewsAPI.create({
          product_id: item.product_id,
          order_id: order.id || order._id,
          store_id: order.store_id || order.merchant_id,
          reviewer_username: currentUser.username,
          reviewer_name: currentUser.display_name || currentUser.username,
          rating,
          title,
          content,
          media_urls: uploadedUrls,
          is_verified_purchase: true,
        });
      });

      const storeId = order.store_id || order.merchant_id;
      const storePromise = storeId ? storeReviewsAPI.create({
        store_id: storeId,
        order_id: order.id || order._id,
        store_name: order.store_name,
        vendor_username: order.vendor_username || order.merchant_username,
        reviewer_username: currentUser.username,
        reviewer_name: currentUser.display_name || currentUser.username,
        rating,
        title,
        content,
        is_verified_purchase: true,
      }) : Promise.resolve();

      await Promise.all([...itemPromises, storePromise]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      queryClient.invalidateQueries({ queryKey: ["storeReviews"] });
      queryClient.invalidateQueries({ queryKey: ["productReviews"] });
      toast.success(t("orders.reviewsSubmitted"));
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            {t("orders.rateYourOrder")}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-slate-50 rounded-xl p-3 mb-2">
          <p className="text-xs font-semibold text-slate-700">{order.store_name || t("profile.store")}</p>
          <p className="text-[11px] text-slate-400">{t("orders.orderNumber", { id: order.id?.slice(-8) })}</p>
          {order.items?.slice(0, 2).map((item, i) => (
            <div key={i} className="flex items-center gap-2 mt-2">
              {item.product_image && <img src={item.product_image} className="w-8 h-8 rounded-lg object-cover" alt="" />}
              <p className="text-xs text-slate-600 truncate">{item.product_title}</p>
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-2">{t("orders.yourRating")}</label>
          <StarRating value={rating} onChange={setRating} size={7} />
          <p className="text-[11px] text-slate-400 mt-1">{getRatingLabel(rating)}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">{t("orders.titleOptional")}</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t("orders.titlePlaceholder")}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">{t("orders.reviewOptional")}</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            placeholder={t("orders.reviewPlaceholder")}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-300 resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-2 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" /> {t("orders.photosUpTo3")}
          </label>
          <div className="flex gap-2">
            {previews.map((url, i) => (
              <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-100 group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeMedia(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {mediaFiles.length < 3 && (
              <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all text-slate-400">
                <Upload className="w-4 h-4" />
                <span className="text-[9px] mt-0.5 font-medium">{t("common.upload")}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl" size="sm">{t("common.cancel")}</Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={rating === 0 || submitMutation.isPending || uploading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-xl h-9 font-bold"
            size="sm"
          >
            {submitMutation.isPending || uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {uploading ? t("orders.uploading") : t("product.submitting")}</>
            ) : t("product.submitReview")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
