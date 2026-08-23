import { useEffect } from "react";

const SITE_NAME = "Aicon X";
const SITE_URL = "https://www.aiconx.net";

function setMetaByName(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setMetaByProperty(property, content) {
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
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
 * Sets document title, meta description, canonical URL and Open Graph/Twitter
 * tags for a public, indexable page. Restores the previous values on unmount
 * since routes share a single index.html document.
 */
export default function Seo({ title, description, path = "/" }) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    const canonicalUrl = `${SITE_URL}${path}`;
    const prevTitle = document.title;

    document.title = fullTitle;
    if (description) {
      setMetaByName("description", description);
      setMetaByProperty("og:description", description);
      setMetaByName("twitter:description", description);
    }
    setMetaByProperty("og:title", fullTitle);
    setMetaByName("twitter:title", fullTitle);
    setMetaByProperty("og:url", canonicalUrl);
    setCanonical(canonicalUrl);

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, path]);

  return null;
}
