import React from "react";
import { cn } from "@/lib/utils";
import SmartLink from "./SmartLink";

const HEIGHT_CLASSES = {
  compact: "min-h-[20rem] sm:min-h-[24rem]",
  tall: "min-h-[28rem] sm:min-h-[36rem]",
};

export default function HeroBlock({ block, shopLink }) {
  const data = block?.data || {};
  const {
    headline,
    subheadline,
    image_url,
    video_url,
    cta_text,
    cta_link,
    overlay_opacity = 0.35,
    height = "tall",
  } = data;

  return (
    <div
      className={cn(
        "relative w-full flex items-center justify-center overflow-hidden rounded-2xl",
        HEIGHT_CLASSES[height] || HEIGHT_CLASSES.tall
      )}
      style={{ backgroundColor: "var(--store-primary, #ea580c)" }}
    >
      {video_url ? (
        <video
          src={video_url}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : image_url ? (
        <img src={image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : null}
      {(image_url || video_url) && (
        <div className="absolute inset-0 bg-black" style={{ opacity: overlay_opacity }} />
      )}

      <div className="relative z-10 text-center px-6 py-16 max-w-2xl mx-auto">
        {headline && (
          <h1 className="text-3xl sm:text-5xl font-black text-white mb-4 leading-tight drop-shadow-sm">
            {headline}
          </h1>
        )}
        {subheadline && (
          <p className="text-base sm:text-lg text-white/90 mb-8 leading-relaxed">{subheadline}</p>
        )}
        {cta_text && (
          <SmartLink
            href={cta_link || shopLink}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--store-accent, #f97316)" }}
          >
            {cta_text}
          </SmartLink>
        )}
      </div>
    </div>
  );
}
