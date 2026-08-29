import { useEffect } from "react";
import { SITE_NAME, SITE_URL, FALLBACK_IMAGE, pruneJsonLd } from "@/lib/previewMeta";

// Every tag this component touches, so a page that sets fewer of them than the
// previous one still gets the rest put back rather than inheriting them.
const NAME_TAGS = ["description", "robots", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"];
const PROPERTY_TAGS = ["og:type", "og:title", "og:description", "og:url", "og:image", "og:image:secure_url", "og:image:alt", "og:image:width", "og:image:height"];

function findByName(name) {
  return document.querySelector(`meta[name="${name}"]`);
}

function findByProperty(property) {
  return document.querySelector(`meta[property="${property}"]`);
}

function setMeta(attr, key, content) {
  const selector = attr === "name" ? findByName(key) : findByProperty(key);
  if (content === null || content === undefined || content === "") {
    if (selector) selector.remove();
    return;
  }
  let tag = selector;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(href) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

/**
 * Structured data is what turns a result into a rich one — a price and a
 * stock state under a product, a byline and a date under a post. It is
 * tagged so this component owns exactly the block it wrote and leaves the
 * site-wide Organization/WebSite blocks in index.html alone.
 */
function setJsonLd(data) {
  const existing = document.querySelector('script[data-seo="page"]');
  const pruned = data ? pruneJsonLd(data) : null;
  if (!pruned) {
    if (existing) existing.remove();
    return;
  }
  const tag = existing || document.createElement("script");
  tag.type = "application/ld+json";
  tag.setAttribute("data-seo", "page");
  tag.textContent = JSON.stringify(pruned);
  if (!existing) document.head.appendChild(tag);
}

function snapshot() {
  const values = {};
  for (const name of NAME_TAGS) values[`name:${name}`] = findByName(name)?.getAttribute("content") ?? null;
  for (const property of PROPERTY_TAGS) values[`property:${property}`] = findByProperty(property)?.getAttribute("content") ?? null;
  values.title = document.title;
  values.canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
  return values;
}

function restore(values) {
  for (const [key, content] of Object.entries(values)) {
    if (key === "title" || key === "canonical") continue;
    const [attr, name] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    setMeta(attr, name, content);
  }
  document.title = values.title;
  if (values.canonical) setCanonical(values.canonical);
}

/**
 * Sets document title, meta description, canonical URL, Open Graph/Twitter
 * tags and structured data for a public, indexable page. Restores the previous
 * values on unmount since routes share a single index.html document.
 *
 * Crawlers that run JavaScript (Google, Bing) read what this sets. Crawlers
 * that do not (WhatsApp, Messenger, Slack) never get this far and are served
 * by api/og.js instead — both describe an item through src/lib/previewMeta.js,
 * so the card in a chat and the page it opens agree.
 *
 * `meta` is a description from previewMeta (title/description/image/type/
 * jsonLd); pass it on an item page and the individual props fill in the rest.
 * `noindex` is for public pages that are not *content* — a scan-to-pay
 * checkout, say, which would otherwise put one thin near-duplicate page per
 * product into the index.
 */
export default function Seo({ title, description, path = "/", noindex = false, meta = null, image, type, jsonLd }) {
  const resolvedTitle = meta?.title ?? title;
  const resolvedDescription = meta?.description ?? description;
  const resolvedImage = image ?? meta?.image ?? null;
  const resolvedType = type ?? meta?.type ?? "website";
  const resolvedJsonLd = jsonLd ?? meta?.jsonLd ?? null;

  // An object identity in a dependency array re-runs the effect on every
  // render, so the effect keys off the serialised form instead.
  const jsonLdKey = resolvedJsonLd ? JSON.stringify(resolvedJsonLd) : "";
  const imageKey = resolvedImage ? JSON.stringify(resolvedImage) : "";

  useEffect(() => {
    const previous = snapshot();

    const fullTitle = resolvedTitle ? `${resolvedTitle} — ${SITE_NAME}` : SITE_NAME;
    const canonicalUrl = `${SITE_URL}${path}`;
    // A normalised {url,width,height} from previewMeta, or a bare string from
    // a caller that only has a URL.
    const img = typeof resolvedImage === "string" ? { url: resolvedImage } : resolvedImage;
    const imageUrl = img?.url || FALLBACK_IMAGE;

    document.title = fullTitle;
    setMeta("name", "description", resolvedDescription || null);
    setMeta("property", "og:description", resolvedDescription || null);
    setMeta("name", "twitter:description", resolvedDescription || null);
    setMeta("property", "og:title", fullTitle);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("property", "og:type", resolvedType);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:image", imageUrl);
    setMeta("property", "og:image:secure_url", imageUrl);
    setMeta("property", "og:image:alt", resolvedTitle || SITE_NAME);
    setMeta("property", "og:image:width", img?.width ? String(img.width) : null);
    setMeta("property", "og:image:height", img?.height ? String(img.height) : null);
    setMeta("name", "twitter:card", img?.square ? "summary" : "summary_large_image");
    setMeta("name", "twitter:image", imageUrl);
    setMeta("name", "twitter:image:alt", resolvedTitle || SITE_NAME);
    setCanonical(canonicalUrl);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    setJsonLd(resolvedJsonLd);

    return () => {
      restore(previous);
      setJsonLd(null);
    };
    // imageKey/jsonLdKey stand in for the objects they serialise, so the
    // effect re-runs when their contents change rather than on every render.
  }, [resolvedTitle, resolvedDescription, path, noindex, resolvedType, imageKey, jsonLdKey]);

  return null;
}
