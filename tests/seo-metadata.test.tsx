import { describe, expect, test } from "vitest";
import { prerenderRoutes } from "@/seo/prerenderRoutes";
// @ts-expect-error -- plain ESM build script without type declarations
import { buildSitemap } from "../scripts/sitemap.mjs";

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

  test("the sitemap lists every page and gives guides their real last-updated date", () => {
    const xml: string = buildSitemap(prerenderRoutes, SITE);
    expect(xml.match(/<url>/g)?.length).toBe(prerenderRoutes.length);
    expect(xml).toContain(`<url><loc>${SITE}/guides/dead-mans-switch-email</loc><lastmod>`);
    expect(xml).toContain(`<url><loc>${SITE}/pricing</loc></url>`);
    expect(() => buildSitemap([{ path: "/x", lastmod: "September 8" }], SITE)).toThrow(/invalid lastmod/);
  });
});
