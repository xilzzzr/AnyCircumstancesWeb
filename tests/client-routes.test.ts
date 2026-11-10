import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { clientOnlyRoutes } from "@/seo/clientRoutes";
import { prerenderRoutes } from "@/seo/prerenderRoutes";

// Every static route in App.tsx must either be prerendered or have an app-shell copy,
// otherwise opening it directly (from an email link or a refresh) can return a 404.
function staticAppRoutes() {
  const source = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
  return [...source.matchAll(/path="([^"]+)"/g)]
    .map(([, path]) => (path.startsWith("/") ? path : `/app/${path}`))
    .filter((path) => !path.includes(":") && !path.includes("*"));
}

describe("client-only routes", () => {
  test("cover every static route that is not prerendered", () => {
    const prerendered = new Set(prerenderRoutes.map((route) => route.path));
    const client = new Set<string>(clientOnlyRoutes);
    const uncovered = staticAppRoutes().filter((path) => !prerendered.has(path) && !client.has(path));
    expect(uncovered).toEqual([]);
  });

  test("include the pages linked from emails", () => {
    for (const path of ["/reset-password", "/email-verified", "/verify-email", "/forgot-password"]) {
      expect(clientOnlyRoutes).toContain(path);
    }
  });

  test("never overlap with prerendered public pages", () => {
    const prerendered = new Set(prerenderRoutes.map((route) => route.path));
    expect(clientOnlyRoutes.filter((path) => prerendered.has(path))).toEqual([]);
  });
});
