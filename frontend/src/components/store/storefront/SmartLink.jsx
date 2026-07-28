import React from "react";
import { Link } from "react-router-dom";

// CTA links are either an internal app path (the "shop this store" fallback,
// or any relative link a vendor entered) or a real external URL (their
// Instagram/WhatsApp, etc — the only kind of custom link the AI/save-path
// sanitizers allow through). Internal links use react-router's Link so the
// SPA doesn't full-reload; external links get a real <a> in a new tab.
export default function SmartLink({ href, className, style, children }) {
  const isExternal = /^https?:\/\//i.test(href || "");

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {children}
      </a>
    );
  }

  return (
    <Link to={href || "#"} className={className} style={style}>
      {children}
    </Link>
  );
}
