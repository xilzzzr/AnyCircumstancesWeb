import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import { StaticRouter } from "react-router";
import { PassThrough } from "node:stream";
import { AppWithinRouter } from "@/App";
import { getPrerenderRouteSeo, prerenderRoutes } from "@/seo/prerenderRoutes";
import { clientOnlyRoutes } from "@/seo/clientRoutes";

function renderApp(pathname: string) {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const stream = new PassThrough();
    let html = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => { html += chunk; });
    stream.on("end", () => { if (!settled) { settled = true; resolve(html); } });
    stream.on("error", (error) => { if (!settled) { settled = true; reject(error); } });

    const { pipe, abort } = renderToPipeableStream(
      <StaticRouter location={pathname}>
        <AppWithinRouter />
      </StaticRouter>,
      {
        onAllReady() { pipe(stream); },
        onShellError(error) { if (!settled) { settled = true; reject(error); } },
        onError(error) { console.error(`SSR error while rendering ${pathname}:`, error); },
      },
    );
    setTimeout(() => abort(), 15_000).unref();
  });
}

export function render(pathname: string) {
  const route = getPrerenderRouteSeo(pathname);
  if (!route) throw new Error(`Refusing to prerender non-public route: ${pathname}`);
  return renderApp(pathname);
}

export function renderNotFound() {
  return renderApp("/404");
}

export function getPrerenderManifest() {
  return prerenderRoutes;
}

export function getClientOnlyRoutes(): readonly string[] {
  return clientOnlyRoutes;
}
