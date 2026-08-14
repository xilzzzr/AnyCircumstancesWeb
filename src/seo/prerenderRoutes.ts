import { guides } from "@/data/guides";
import { breadcrumbSchema } from "@/components/seo/schema";
import { publicRoutes, type PublicRouteSeo } from "@/seo/publicRoutes";

const SITE_URL = "https://anycircumstances.com";

const guideRoutes: PublicRouteSeo[] = guides.map((guide) => {
  const path = `/guides/${guide.slug}`;
  return {
    path,
    title: guide.seoTitle,
    description: guide.description,
    type: "article",
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        datePublished: guide.published,
        dateModified: guide.modified,
        author: { "@type": "Organization", name: "AnyCircumstances" },
        publisher: {
          "@type": "Organization",
          name: "AnyCircumstances",
          logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon-256.png` },
        },
        mainEntityOfPage: `${SITE_URL}${path}`,
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Guides", path: "/guides" },
        { name: guide.title, path },
      ]),
    ],
  };
});

export const prerenderRoutes = [...publicRoutes, ...guideRoutes];
const prerenderRouteMap = new Map(prerenderRoutes.map((route) => [route.path, route]));

export function getPrerenderRouteSeo(pathname: string) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  return prerenderRouteMap.get(normalized);
}
