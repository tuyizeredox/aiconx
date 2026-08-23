import React, { useState, useRef, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const TOKEN_REGEX = /(@[a-zA-Z0-9_]{3,30}|#[a-zA-Z0-9_]+)/g;

function renderTokens(text) {
  return text.split(TOKEN_REGEX).map((part, i) => {
    if (!part) return null;
    if (part[0] === "@") {
      return (
        <Link
          key={i}
          to={createPageUrl("Profile") + `?username=${part.slice(1)}`}
          className="text-orange-600 dark:text-orange-400 font-semibold hover:underline"
        >
          {part}
        </Link>
      );
    }
    if (part[0] === "#") {
      return (
        <Link
          key={i}
          to={createPageUrl("Explore") + `?search=${encodeURIComponent(part.slice(1))}`}
          className="text-orange-600 dark:text-orange-400 font-semibold hover:underline"
        >
          {part}
        </Link>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// Renders post content with clickable @mentions / #hashtags, and only shows
// a See more/See less toggle when the text actually overflows the 3-line
// clamp (measured from the rendered box, not guessed from character count).
export default function PostContent({ content, clamp = true, className = "" }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    if (!clamp) return;
    const el = textRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [content, clamp]);

  if (!content) return null;

  const isClamped = clamp && !expanded;
  const showToggle = clamp && isOverflowing;

  return (
    <div className={className}>
      <p
        ref={textRef}
        className={`text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words ${isClamped ? "line-clamp-3" : ""}`}
      >
        {renderTokens(content)}
      </p>
      {showToggle && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-orange-600 dark:text-orange-400 mt-1 hover:text-orange-700 dark:hover:text-orange-300"
        >
          {expanded ? t("common.seeLess") : t("common.seeMore")}
        </button>
      )}
    </div>
  );
}
