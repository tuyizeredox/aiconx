import React from "react";

export default function VideoBlock({ block }) {
  const data = block?.data || {};
  const { video_url, caption } = data;

  if (!video_url) return null;

  return (
    <figure className="w-full">
      <video src={video_url} controls className="w-full rounded-2xl bg-black" />
      {caption && (
        <figcaption className="mt-2 text-sm text-slate-500 dark:text-ink-400">{caption}</figcaption>
      )}
    </figure>
  );
}
