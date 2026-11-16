// Builds sitemap.xml for the prerendered public routes.
// <lastmod> is written only for routes that record a real content date (the
// guides). Google ignores lastmod values that aren't accurate, so pages
// without a known date are listed without one.
export function buildSitemap(routes, siteUrl) {
  const urls = routes.map(({ path, lastmod }) => {
    if (lastmod && !/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) throw new Error(`${path} has an invalid lastmod: ${lastmod}`);
    return `  <url><loc>${siteUrl}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
