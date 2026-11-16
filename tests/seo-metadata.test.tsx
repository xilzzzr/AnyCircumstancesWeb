import { describe, expect, test } from "vitest";
import { prerenderRoutes } from "@/seo/prerenderRoutes";
// @ts-expect-error -- plain ESM build script without type declarations
import { buildSitemap } from "../scripts/sitemap.mjs";
// @ts-expect-error -- plain ESM build script without type declarations
import { redirectPage, redirects } from "../scripts/redirects.mjs";
import { guides } from "@/data/guides";
import content from "@/data/publicContent.json";

const SITE = "https://anycircumstances.com";
const schemaTypes = (path: string) => {
  const route = prerenderRoutes.find((r) => r.path === path);
  const items = Array.isArray(route?.schema) ? route.schema : [route?.schema];
  return items.map((item) => (item as Record<string, unknown>)?.["@type"]);
};

describe("search metadata", () => {
  test("the home page tells Google the site name, its spaced spelling and the organization", () => {
    const home = prerenderRoutes.find((r) => r.path === "/");
    const items = (Array.isArray(home?.schema) ? home.schema : [home?.schema]) as Record<string, unknown>[];
    const website = items.find((i) => i["@type"] === "WebSite");
    const organization = items.find((i) => i["@type"] === "Organization");
    expect(website).toMatchObject({ "@id": `${SITE}/#website`, name: "AnyCircumstances", url: `${SITE}/` });
    expect(website?.alternateName).toContain("Any Circumstances");
    expect(organization).toMatchObject({ "@id": `${SITE}/#organization`, name: "AnyCircumstances", logo: `${SITE}/favicon-256.png` });
    // Other pages reference the home page's WebSite instead of repeating it.
    expect(schemaTypes("/pricing")).not.toContain("WebSite");
  });

  test("every public page has a unique title and description", () => {
    const titles = prerenderRoutes.map((r) => r.title);
    const descriptions = prerenderRoutes.map((r) => r.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    // Google shows roughly 155-160 characters of a description.
    for (const route of prerenderRoutes) expect(route.description.length, route.path).toBeLessThanOrEqual(170);
  });

  test("the dead man's switch page and its email guide target different searches", () => {
    const page = prerenderRoutes.find((r) => r.path === "/dead-mans-switch");
    const guide = prerenderRoutes.find((r) => r.path === "/guides/dead-mans-switch-email");
    expect(page?.title).toMatch(/^Dead Man's Switch Email/);
    expect(guide?.title).toMatch(/^How a Dead Man's Switch Email Works/);
    expect(page?.title).not.toBe(guide?.title);
  });

  test("moved pages point at a real page, and nothing links to the old address", () => {
    const paths = new Set(prerenderRoutes.map((r) => r.path));
    const allLinks = JSON.stringify([guides, content]);
    for (const redirect of redirects as Array<{ from: string; to: string; title: string }>) {
      expect(paths.has(redirect.to), redirect.to).toBe(true);
      expect(paths.has(redirect.from), redirect.from).toBe(false);
      expect(allLinks).not.toContain(`"${redirect.from}"`);
      const html: string = redirectPage(redirect, SITE);
      expect(html).toContain(`<link rel="canonical" href="${SITE}${redirect.to}">`);
      expect(html).toContain(`<meta http-equiv="refresh" content="0; url=${redirect.to}">`);
    }
  });

  test("the digital vault cost guide lists the real prices", () => {
    const guide = guides.find((g) => g.slug === "digital-vault-cost");
    const text = JSON.stringify(guide);
    for (const price of ["$4.99", "$7.99", "$12.99", "$17.99", "$22.99", "$29.99", "+$1.99", "+$2.99", "$6.98", "$69.80"]) {
      expect(text).toContain(price);
    }
  });

  test("the sitemap lists every page and gives guides their real last-updated date", () => {
    const xml: string = buildSitemap(prerenderRoutes, SITE);
    expect(xml.match(/<url>/g)?.length).toBe(prerenderRoutes.length);
    expect(xml).toContain(`<url><loc>${SITE}/guides/dead-mans-switch-email</loc><lastmod>`);
    expect(xml).toContain(`<url><loc>${SITE}/pricing</loc></url>`);
    expect(() => buildSitemap([{ path: "/x", lastmod: "September 8" }], SITE)).toThrow(/invalid lastmod/);
  });
});
