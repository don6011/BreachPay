import { useEffect } from "react";
import { jsonLdGraph, type PageMeta } from "@/lib/settlements/content";
import { SITE_NAME, SITE_URL } from "@/lib/settlements/format";

function upsert(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  apply(el);
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  upsert(
    `meta[${attr}="${key}"]`,
    () => {
      const m = document.createElement("meta");
      m.setAttribute(attr, key);
      return m;
    },
    (el) => el.setAttribute("content", content),
  );
}

/**
 * Keeps the document head in step with the page being viewed. Pre-rendered
 * pages already ship these tags; this updates them on client-side navigation.
 */
export function useSeo(meta: PageMeta | null) {
  const serialized = meta ? JSON.stringify(meta) : null;
  useEffect(() => {
    if (!meta) return;
    document.title = meta.title;
    setMeta("name", "description", meta.description);
    setMeta("name", "robots", meta.noindex ? "noindex, follow" : "index, follow");
    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    if (meta.canonical) setMeta("property", "og:url", meta.canonical);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:image", `${SITE_URL}/og-image.png`);
    if (meta.canonical) {
      upsert(
        'link[rel="canonical"]',
        () => {
          const l = document.createElement("link");
          l.setAttribute("rel", "canonical");
          return l;
        },
        (el) => el.setAttribute("href", meta.canonical),
      );
    } else {
      document.head.querySelector('link[rel="canonical"]')?.remove();
    }
    upsert(
      "script#page-jsonld",
      () => {
        const s = document.createElement("script");
        s.id = "page-jsonld";
        s.setAttribute("type", "application/ld+json");
        return s;
      },
      (el) => {
        el.textContent = jsonLdGraph(meta);
      },
    );
    // `serialized` captures every field of `meta`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
}
