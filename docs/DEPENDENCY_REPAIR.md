# Dependency update repair

This replaces the incompatible grouped upgrades with a tested frontend/backend
dependency set. React 18, the existing calendar/panel/chart component APIs,
TypeScript 5.8, ESLint 9, and the Stripe 22 API generation are retained.
ESLint's accessibility plugin does not currently accept ESLint 10 as a peer.

The frontend moves to Tailwind 4 with its PostCSS integration and matching
`tailwind-merge`. The existing theme/animations are loaded explicitly with
`@config`; container padding/centering and border/button defaults are preserved.
The unused Lovable editor tagger is removed. This eliminates the old
Tailwind/chokidar/glob dependency paths responsible for unpatched audit findings.
Tailwind 4 supports Safari 16.4+, Chrome 111+, and Firefox 128+.

Vitest 4.1.12 replaces the vulnerable test-worker dependency chain. PostCSS
selector parsing is constrained to the patched compatible 7.x line. Both npm
lockfiles are regenerated and tested using ordinary `npm ci`, without forcing
or bypassing peer dependencies. Security audit gates remain enabled.

Dependabot continues checking all dependencies. Patch/minor upgrades stay
grouped, while breaking major upgrades are proposed separately for review.

Validation uses the frontend tests, backend tests, TypeScript, production
client/SSR build with prerendering, asset validation, and npm security audits.
The landing page and admin sign-in are also inspected in a browser.
