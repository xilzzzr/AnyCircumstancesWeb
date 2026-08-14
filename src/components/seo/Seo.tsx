import { useEffect } from "react";

const SITE_URL = "https://anycircumstances.com";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.svg`;

export type SeoProps = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  type?: "website" | "article";
  schema?: Record<string, unknown> | Record<string, unknown>[];
};

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

export function Seo({ title, description, path, noindex = false, type = "website", schema }: SeoProps) {
  useEffect(() => {
    const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "");
    const canonical = `${SITE_URL}${normalizedPath}`;
    document.title = title;

    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[name="robots"]', "name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large");
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:type"]', "property", "og:type", type);
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
    upsertMeta('meta[property="og:image"]', "property", "og:image", DEFAULT_IMAGE);
    upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", "AnyCircumstances");
    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", DEFAULT_IMAGE);

    let canonicalTag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement("link");
      canonicalTag.rel = "canonical";
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = canonical;

    document.querySelectorAll('script[data-route-schema="true"]').forEach((node) => node.remove());
    if (schema) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.routeSchema = "true";
      script.text = JSON.stringify(schema).replace(/</g, "\\u003c");
      document.head.appendChild(script);
    }
  }, [description, noindex, path, schema, title, type]);

  return null;
}
