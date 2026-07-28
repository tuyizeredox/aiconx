import React from "react";

export default function RichTextBlock({ block }) {
  const data = block?.data || {};
  const { title, body } = data;

  if (!title && !body) return null;

  return (
    <div className="max-w-3xl">
      {title && (
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">{title}</h2>
      )}
      {body && (
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{body}</p>
      )}
    </div>
  );
}
