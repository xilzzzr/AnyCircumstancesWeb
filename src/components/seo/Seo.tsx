import { useEffect } from "react";

type SeoProps = {
  title: string;
  description: string;
  path: string;
};

export function Seo({ title, description, path }: SeoProps) {
  useEffect(() => {
    document.title = title;

    const ensureMeta = (name: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      return tag;
    };

const ensurePropertyMeta = (property: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      return tag;
    };

    const ensureCanonical = () => {
      let tag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
 if (!tag) {
        tag = document.createElement("link");
        tag.setAttribute("rel", "canonical");
        document.head.appendChild(tag);
      }
return tag;
    };

  ensureMeta("description").setAttribute("content", description);
    ensurePropertyMeta("og:title").setAttribute("content", title);
    ensurePropertyMeta("og:description").setAttribute("content", description);
    ensurePropertyMeta("og:type").setAttribute("content", "article");
    ensurePropertyMeta("og:url").setAttribute("content", `https://anycircumstances.com$
{path}`);
    ensureCanonical().setAttribute("href", `https://anycircumstances.com${path}`);
  }, [title, description, path]);

  return null;
}
