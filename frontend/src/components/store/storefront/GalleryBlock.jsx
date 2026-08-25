import React from "react";

export default function GalleryBlock({ block }) {
  const data = block?.data || {};
  const { title, images = [] } = data;

  if (!images.length) return null;

  return (
    <div className="w-full">
      {title && (
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6">{title}</h2>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((url, i) => (
          <div key={`${url}-${i}`} className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-ink-800">
            <img src={url} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
