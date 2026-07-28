import React from "react";
import SmartLink from "./SmartLink";

export default function CtaBannerBlock({ block, shopLink }) {
  const data = block?.data || {};
  const { heading, body, button_text, button_link } = data;

  if (!heading && !body && !button_text) return null;

  return (
    <div
      className="w-full rounded-2xl px-6 py-12 sm:py-16 text-center"
      style={{ backgroundColor: "var(--store-primary, #ea580c)" }}
    >
      {heading && <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">{heading}</h2>}
      {body && <p className="text-white/90 max-w-xl mx-auto mb-6 leading-relaxed">{body}</p>}
      {button_text && (
        <SmartLink
          href={button_link || shopLink}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--store-accent, #f97316)" }}
        >
          {button_text}
        </SmartLink>
      )}
    </div>
  );
}
