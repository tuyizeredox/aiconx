import React, { useState } from "react";
import { Star } from "lucide-react";

export default function StarRating({ value = 0, onChange, size = 6, readonly = false }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = (hovered || value) >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => !readonly && onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            className={`transition-transform ${!readonly ? "hover:scale-110 cursor-pointer" : "cursor-default"}`}
          >
            <Star
              className={`w-${size} h-${size} transition-colors ${filled ? "fill-amber-400 text-amber-400" : "fill-none text-slate-300"}`}
            />
          </button>
        );
      })}
    </div>
  );
}