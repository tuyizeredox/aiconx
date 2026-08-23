import React from "react";
import { cn } from "@/lib/utils";
import SmartLink from "./SmartLink";

export default function ImageTextBlock({ block, shopLink }) {
  const data = block?.data || {};
  const { image_url, title, body, cta_text, cta_link, image_position = "left" } = data;

  return (
    <div
      className={cn(
        "w-full flex flex-col md:flex-row items-center gap-8",
        image_position === "right" && "md:flex-row-reverse"
      )}
    >
      {image_url && (
        <div className="w-full md:w-1/2 shrink-0">
          <img src={image_url} alt="" className="w-full rounded-2xl object-cover aspect-[4/3]" />
        </div>
      )}
      <div className="w-full md:w-1/2">
        {title && (
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">{title}</h2>
        )}
        {body && (
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line mb-5">
            {body}
          </p>
        )}
        {cta_text && (
          <SmartLink
            href={cta_link || shopLink}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--store-accent, #f97316)" }}
          >
            {cta_text}
          </SmartLink>
        )}
      </div>
    </div>
  );
}
