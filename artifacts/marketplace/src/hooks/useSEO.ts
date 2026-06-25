import { useEffect } from "react";

const SITE = "https://syano.online";
const DEFAULT_TITLE = "Syano — Syria's First Online Marketplace | سيانو";
const DEFAULT_DESCRIPTION =
  "Shop trusted sellers across Aleppo and Syria. Electronics, fashion, home goods and more — fast delivery, secure payments, 30-day returns. سيانو — سوق سوريا الإلكتروني الأول.";
const DEFAULT_OG_IMAGE = `${SITE}/og-image.png`;

interface SEOInput {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  noindex?: boolean;
  type?: "website" | "product" | "article";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function upsertMeta(attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
  }
}

const JSONLD_ID = "page-jsonld";

/**
 * Per-page SEO: dynamically updates <title>, meta description, canonical,
 * Open Graph, Twitter Card, robots, and an optional JSON-LD block.
 *
 * Lightweight (no library) — uses direct DOM updates inside useEffect.
 */
export function useSEO(input: SEOInput) {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    canonical,
    image,
    noindex,
    type,
    jsonLd,
  } = input;

  useEffect(() => {
    const fullTitle = title ? `${title} | Syano` : DEFAULT_TITLE;
    const canonicalUrl = canonical
      ? canonical.startsWith("http")
        ? canonical
        : `${SITE}${canonical.startsWith("/") ? canonical : `/${canonical}`}`
      : window.location.origin + window.location.pathname;
    const ogImage = image || DEFAULT_OG_IMAGE;
    const ogType = type ?? (image ? "product" : "website");

    document.title = fullTitle;
    upsertMeta("name", "description", description);
    upsertMeta(
      "name",
      "robots",
      noindex
        ? "noindex, nofollow"
        : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    );

    upsertLink("canonical", canonicalUrl);

    // Open Graph
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:type", ogType);
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:image:secure_url", ogImage);
    upsertMeta("property", "og:image:alt", fullTitle);
    upsertMeta("property", "og:site_name", "Syano");

    // Twitter
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:url", canonicalUrl);
    upsertMeta("name", "twitter:image", ogImage);
    upsertMeta("name", "twitter:image:alt", fullTitle);

    // JSON-LD
    const existing = document.getElementById(JSONLD_ID);
    if (existing) existing.remove();
    if (jsonLd) {
      const script = document.createElement("script");
      script.id = JSONLD_ID;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const stale = document.getElementById(JSONLD_ID);
      if (stale) stale.remove();
    };
  }, [title, description, canonical, image, noindex, type, JSON.stringify(jsonLd)]);
}
