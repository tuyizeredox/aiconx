import React from "react";
import StoreReviewSection from "@/components/store/StoreReviewSection";

export default function TestimonialsBlock({ block, store, currentUser }) {
  if (!store) return null;
  const title = block?.data?.title;
  return (
    <div className="w-full">
      {title && (
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6">{title}</h2>
      )}
      <StoreReviewSection store={store} currentUser={currentUser} />
    </div>
  );
}
