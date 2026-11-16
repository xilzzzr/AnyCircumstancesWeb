const SITE_URL = "https://anycircumstances.com";

// Home page only. Tells Google the site's name, including the spaced spelling
// people search for ("any circumstances"), and which organization runs it.
// https://developers.google.com/search/docs/appearance/site-names
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "AnyCircumstances",
  alternateName: ["Any Circumstances", "anycircumstances.com"],
  url: `${SITE_URL}/`,
  publisher: { "@id": `${SITE_URL}/#organization` },
};

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "AnyCircumstances",
  alternateName: "Any Circumstances",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/favicon-256.png`,
};

export const breadcrumbSchema = (items: Array<{ name: string; path: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: `${SITE_URL}${item.path}`,
  })),
});
