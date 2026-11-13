import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSitemap } from "./sitemap.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const distDir = resolve(projectRoot, "dist");
const serverEntry = resolve(projectRoot, "dist-ssr/entry-server.js");
const templatePath = resolve(distDir, "index.html");
const siteUrl = "https://anycircumstances.com";

const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function injectHead(template, route) {
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>\s*/i, "");
  html = html.replace(/<meta\b(?=[^>]*\bname=["'](?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image)["'])[^>]*>\s*/gi, "");
  html = html.replace(/<meta\b(?=[^>]*\bproperty=["'](?:og:title|og:description|og:type|og:url|og:image|og:site_name)["'])[^>]*>\s*/gi, "");
  html = html.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>\s*/gi, "");
  html = html.replace(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>\s*/gi, "");

  const canonical = `${siteUrl}${route.path}`;
  const schema = JSON.stringify(route.schema).replaceAll("<", "\\u003c");
  const head = [
    `<title>${escapeHtml(route.title)}</title>`,
    `<meta name="description" content="${escapeHtml(route.description)}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:title" content="${escapeHtml(route.title)}">`,
    `<meta property="og:description" content="${escapeHtml(route.description)}">`,
    `<meta property="og:type" content="${route.type ?? "website"}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${siteUrl}/og-image.svg">`,
    `<meta property="og:site_name" content="AnyCircumstances">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(route.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(route.description)}">`,
    `<meta name="twitter:image" content="${siteUrl}/og-image.svg">`,
    `<script type="application/ld+json" data-route-schema="true">${schema}</script>`,
  ].join("\n    ");
  return html.replace("</head>", `    ${head}\n  </head>`);
}

function injectBody(template, body) {
  // React's streaming renderer can emit NUL text separators at a chunk
  // boundary. They are not meaningful DOM content and should not ship in HTML.
  body = body.replaceAll("\0", "");
  if (!body.includes("<h1")) throw new Error("Rendered route has no H1");
  if (!body.includes('href="/')) throw new Error("Rendered route has no crawlable internal links");
  return template.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

function validateHtml(html, route) {
  const required = [
    `<title>${escapeHtml(route.title)}</title>`,
    '<meta name="description"',
    '<meta name="robots" content="index, follow, max-image-preview:large">',
    `<link rel="canonical" href="${siteUrl}${route.path}">`,
    '<meta property="og:title"',
    '<meta name="twitter:title"',
    '<script type="application/ld+json"',
    "<h1",
    'href="/',
  ];
  const missing = required.filter((value) => !html.includes(value));
  if (missing.length) throw new Error(`${route.path} is missing required prerendered markup: ${missing.join(", ")}`);
  if (html.includes('<div id="root"></div>')) throw new Error(`${route.path} has an empty React root`);

  const schemaMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!schemaMatch) throw new Error(`${route.path} has no JSON-LD`);
  JSON.parse(schemaMatch[1]);
}

function outputPath(pathname) {
  return pathname === "/" ? resolve(distDir, "index.html") : resolve(distDir, pathname.slice(1), "index.html");
}

function sitemap(routes) {
  return buildSitemap(routes, siteUrl);
}

async function main() {
  const { render, renderNotFound, getPrerenderManifest } = await import(`${pathToFileURL(serverEntry).href}?v=${Date.now()}`);
  const routes = getPrerenderManifest();
  if (!Array.isArray(routes) || routes.length === 0) throw new Error("Prerender manifest is empty");
  if (new Set(routes.map(({ path }) => path)).size !== routes.length) throw new Error("Prerender manifest contains duplicate paths");

  const template = await readFile(templatePath, "utf8");
  let spaHtml = injectHead(template, {
    path: "/",
    title: "Account | AnyCircumstances",
    description: "Secure AnyCircumstances account page.",
    type: "website",
    schema: { "@context": "https://schema.org", "@type": "WebPage", name: "AnyCircumstances Account" },
  });
  spaHtml = spaHtml
    .replace('content="index, follow, max-image-preview:large"', 'content="noindex, follow"')
    .replace(/\s*<link rel="canonical"[^>]*>/, "")
    .replace(/\s*<meta property="og:url"[^>]*>/, "")
    .replace(/\s*<script type="application\/ld\+json" data-route-schema="true">[\s\S]*?<\/script>/, "");
  await writeFile(resolve(distDir, "spa.html"), spaHtml);

  for (const route of routes) {
    const html = injectBody(injectHead(template, route), await render(route.path));
    validateHtml(html, route);
    const target = outputPath(route.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html);
  }

  const notFoundRoute = { path: "/404", title: "Page Not Found | AnyCircumstances", description: "The requested page could not be found.", type: "website", schema: { "@context": "https://schema.org", "@type": "WebPage", name: "Page Not Found", url: `${siteUrl}/404` } };
  let notFoundHtml = injectBody(injectHead(template, notFoundRoute), await renderNotFound());
  notFoundHtml = notFoundHtml.replace('content="index, follow, max-image-preview:large"', 'content="noindex, follow"');
  await writeFile(resolve(distDir, "404.html"), notFoundHtml);

  const sitemapXml = sitemap(routes);
  await writeFile(resolve(distDir, "sitemap.xml"), sitemapXml);
  await writeFile(resolve(projectRoot, "public/sitemap.xml"), sitemapXml);
  await writeFile(resolve(distDir, "prerender-manifest.json"), `${JSON.stringify(routes.map(({ path }) => path), null, 2)}\n`);
  console.log(`Prerendered and validated ${routes.length} public routes.`);
}

main().catch((error) => {
  console.error("Prerender failed:", error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
