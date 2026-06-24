import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Images, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

function isVideo(url) {
  return url && (url.includes(".mp4") || url.includes(".mov") || url.includes(".webm") || url.includes("video"));
}

export default function ReviewGallery({ reviews }) {
  const { t } = useTranslation();
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const allMedia = reviews.flatMap(r =>
    (r.media_urls || []).map(url => ({ url, reviewer: r.reviewer_name, rating: r.rating, content: r.content }))
  ).filter(m => m.url);

  if (allMedia.length === 0) return null;

  const prev = () => setLightboxIndex(i => (i - 1 + allMedia.length) % allMedia.length);
  const next = () => setLightboxIndex(i => (i + 1) % allMedia.length);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Images className="w-5 h-5 text-orange-500" />
        <h3 className="text-base font-bold text-slate-900">{t("product.reviewGallery")}</h3>
        <span className="text-xs text-slate-400 font-medium">{t("product.photosAndVideos", { count: allMedia.length })}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {allMedia.slice(0, 10).map((media, i) => (
          <motion.button
            key={`media-${media.url}-${i}`}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setLightboxIndex(i)}
            className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group"
          >
            {isVideo(media.url) ? (
              <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                <Play className="w-8 h-8 text-slate-500" />
              </div>
            ) : (
              <img src={media.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </motion.button>
        ))}
        {allMedia.length > 10 && (
          <button
            onClick={() => setLightboxIndex(10)}
            className="aspect-square rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            +{allMedia.length - 10}
          </button>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setLightboxIndex(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-3xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxIndex(null)}
                className="absolute -top-10 right-0 text-white/70 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="rounded-2xl overflow-hidden bg-black aspect-square sm:aspect-video">
                {isVideo(allMedia[lightboxIndex]?.url) ? (
                  <video src={allMedia[lightboxIndex]?.url} controls className="w-full h-full object-contain" />
                ) : (
                  <img src={allMedia[lightboxIndex]?.url} alt="" className="w-full h-full object-contain" />
                )}
              </div>

              <div className="mt-3 text-white text-sm text-center">
                <span className="font-medium">{allMedia[lightboxIndex]?.reviewer}</span>
                {allMedia[lightboxIndex]?.content && (
                  <p className="text-white/70 text-xs mt-1 line-clamp-2">{allMedia[lightboxIndex]?.content}</p>
                )}
              </div>

              {allMedia.length > 1 && (
                <>
                  <button onClick={prev} className="absolute left-0 top-1/3 -translate-y-1/2 -translate-x-12 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={next} className="absolute right-0 top-1/3 -translate-y-1/2 translate-x-12 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              <div className="flex justify-center gap-1.5 mt-3">
                {allMedia.map((_, i) => (
                  <button
                    key={`dot-${i}`}
                    onClick={() => setLightboxIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === lightboxIndex ? "bg-white" : "bg-white/30"}`}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}