import React from "react";

// Drop-in replacement for a bare avatar/media `<img>`: swaps to `fallback` when
// `src` is empty OR the image actually fails to load (broken/expired URL), instead
// of the browser rendering its broken-image glyph + alt text inside the box.
export default function AvatarImg({ src, alt = "", className, fallback = null, onLoadError, ...imgProps }) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return fallback;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => { setFailed(true); onLoadError?.(); }}
      {...imgProps}
    />
  );
}
