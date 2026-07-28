import React from "react";
import { cn } from "@/lib/utils";

const PADDING_CLASSES = {
  none: "py-0",
  sm: "py-6 sm:py-8",
  md: "py-12 sm:py-16",
  lg: "py-16 sm:py-24",
};

const ALIGN_CLASSES = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
};

export default function BlockWrapper({ style = {}, children, className = "" }) {
  const {
    background_color,
    background_image_url,
    padding = "md",
    text_align = "left",
    width = "contained",
  } = style || {};

  return (
    <section
      className={cn("relative w-full", PADDING_CLASSES[padding] || PADDING_CLASSES.md, className)}
      style={{
        backgroundColor: background_color || undefined,
        backgroundImage: background_image_url ? `url(${background_image_url})` : undefined,
        backgroundSize: background_image_url ? "cover" : undefined,
        backgroundPosition: background_image_url ? "center" : undefined,
      }}
    >
      <div
        className={cn(
          "flex flex-col px-4 sm:px-6",
          width === "full" ? "w-full" : "max-w-6xl mx-auto w-full",
          ALIGN_CLASSES[text_align] || ALIGN_CLASSES.left
        )}
      >
        {children}
      </div>
    </section>
  );
}
