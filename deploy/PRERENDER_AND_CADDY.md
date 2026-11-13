# Prerender deployment and Caddy routing

`npm run build` now performs the browser build, a build-only SSR bundle, and
static prerendering. Deploy `dist/`; `dist-ssr/` is a build intermediate and is
not required on the server.

`dist/spa.html` is the empty-root, `noindex` browser shell used only for
authentication, dashboard, and sharing routes. It prevents those routes from
receiving or attempting to hydrate the prerendered homepage markup.

The prerender route manifest is generated from `src/seo/publicRoutes.ts`. Guide
routes are derived automatically from `src/data/guides.ts`. The same manifest
generates `dist/sitemap.xml`, `public/sitemap.xml`, and
`dist/prerender-manifest.json`. A missing H1, head field, internal link, invalid
JSON-LD document, duplicate route, or render exception fails the build.

## Caddy integration

There was no production Caddyfile in this repository when this configuration
was added. Do not overwrite `/etc/caddy/Caddyfile` blindly. First inspect the
active unit and config on the EC2 host:

```sh
sudo systemctl cat caddy
sudo sed -n '1,260p' /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Merge the routing pattern from `deploy/Caddyfile.routing.example` into the
existing `anycircumstances.com` site block. Preserve the live root, upstream,
TLS, logging, security headers, and any other reverse-proxy matchers. The key
behavior is:

- backend namespaces are handled before frontend files;
- only known client routes receive `/spa.html` fallback;
- public paths use an actual file or `<path>/index.html`;
- the final static handler uses `=404`;
- `handle_errors 404` serves `/404.html` while retaining status 404.

After editing, format and validate before reloading:

```sh
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-prerender
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Use `reload`, not `restart`, after validation. Caddy continues managing the
existing HTTPS certificates and listeners.

## Production verification

```sh
curl -sSI https://anycircumstances.com/
curl -sSI https://anycircumstances.com/dead-mans-switch
curl -sSI https://anycircumstances.com/digital-vault
curl -sSI https://anycircumstances.com/guides/emergency-information-checklist
curl -sSI https://anycircumstances.com/app
curl -sSI https://anycircumstances.com/share/test-token
curl -sSI https://anycircumstances.com/completely-fake-page-123
curl -sS https://anycircumstances.com/dead-mans-switch | grep -E '<title>|name="description"|rel="canonical"|application/ld\+json|<h1'
```

The public, `/app`, and `/share/...` requests should resolve through their
intended handlers. The fake page must report `404`, and its response body should
be the generated branded `dist/404.html` page.

## Complete builds and cache policy

The repository does not automate atomic frontend releases. Build in a separate
release directory, upload the complete `dist/`, verify it, then atomically switch
the served directory (for example a symlink). Keep the prior release for rollback.
Do not run a destructive in-place sync against the directory currently served.
If an atomic switch is unavailable, upload assets first and HTML entry points last.

An atomic switch alone does not protect already-open tabs: keep previous hashed
assets available under `/assets/` across releases, in a shared asset store or by
copying retained assets into each release before switching. Do not immediately
delete old chunks. HTML should revalidate (`Cache-Control: no-cache`); hashed
assets can use `public, max-age=31536000, immutable`. Error responses should not
inherit immutable caching. The example explicitly separates `/assets/*` from
SPA routing and makes missing files return 404.

Verify on the live server after deploying the reviewed configuration:

```sh
curl -sSI https://anycircumstances.com/app/upload
curl -sSI https://anycircumstances.com/assets/nonexistent-route-chunk.js
# Also request a real hashed JS filename from the deployed spa.html.
```

The app URL must serve the SPA shell with revalidation. Existing JS must have a
JavaScript content type and immutable cache header; missing JS must return 404,
never HTML with status 200. Keep an old tab open across a release and follow an
unvisited setup link. If a chunk still fails, the application offers manual reload
and dashboard recovery, with no automatic reload loop.

## One address for search engines

The live server currently answers `https://www.anycircumstances.com/` with a
full copy of the site, so Google sees two versions of every page. Every page's
canonical tag already points to `https://anycircumstances.com`, but a permanent
redirect is the clear signal. Give `www.anycircumstances.com` its own site block
that redirects, as in `Caddyfile.routing.example`:

```caddy
www.anycircumstances.com {
	redir https://anycircumstances.com{uri} permanent
}
```

and remove `www.anycircumstances.com` from the main site block's address list.
Check after reloading Caddy:

```sh
curl -sSI https://www.anycircumstances.com/pricing
# expect: 308 with location: https://anycircumstances.com/pricing
```

## Pages that moved

`scripts/redirects.mjs` lists old addresses of pages that were merged or
renamed. The build writes a small page at each old address that sends visitors
and search engines to the new one, so this works without a server change. A
server redirect is still the cleanest signal; the example Caddyfile has one
`redir` line per entry:

```caddy
redir /guides/what-happens-to-bitcoin-when-you-die /guides/what-happens-to-crypto-when-you-die permanent
```
