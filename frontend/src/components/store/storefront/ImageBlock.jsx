import React from "react";

export default function ImageBlock({ block }) {
  const data = block?.data || {};
  const { image_url, caption, link } = data;

  if (!image_url) return null;

  const img = (
    <img src={image_url} alt={caption || ""} className="w-full rounded-2xl object-cover" />
  );

  return (
    <figure className="w-full">
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer">
          {img}
        </a>
      ) : (
        img
      )}
      {caption && (
        <figcaption className="mt-2 text-sm text-slate-500 dark:text-ink-400">{caption}</figcaption>
      )}
    </figure>
  );
}
