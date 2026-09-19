# Signup and onboarding recovery report

Base: `origin/main` at `da29198`. Branch: `fix/signup-onboarding-blank-pages`.
Work was isolated in a separate worktree; the original checkout's uncommitted
changes were not modified.

## Findings and authentication flow

Registration creates an account awaiting email verification and sets no session.
The frontend stored the pending email and navigated twice; it now navigates once.
Code verification consumes the verification credential, marks the email verified,
issues access and refresh tokens, and sets cookies. `/auth/me` returns
`{ ok: true, role: "user", userId, user: { id, email } }`.

The frontend previously only set `role = user`, leaving `user = null`. The shared
provider persists across verification, both PIN pages, onboarding and the app, so
this incomplete state persisted too. The app guard trusted only role. These are
confirmed consistency defects, but without a real browser trace they do not prove
the exact exception behind the reported production blank screen.

Verification now removes the pending email, awaits `refreshSession()`, and only
then shows success and navigates to PIN creation. Session failure sends the user
to sign in with an explanation. `refreshSession` reports success as a boolean.
The sole external `setRole` call was verification; the public setter was removed.
Role is derived from the loaded user, making an independently authenticated role
impossible. The existing legacy `{email}` response fallback is preserved.

Normal and emergency PIN handlers require the session and current password,
update their respective hashes, and leave session cookies intact. No redundant
refresh was added to either PIN page or onboarding. The existing shared session
loader still deduplicates simultaneous checks and refresh-token rotation under
StrictMode. Login also checks whether its session load succeeded.

An additional backend flaw was found: already-verified accounts bypassed code
validation before cookies were issued. The endpoint now always consumes a valid,
unused credential before issuing tokens. Used/invalid codes cannot establish a
session. A user who already verified through the email link should sign in.

## Rendering, guide and performance

The existing ErrorBoundary was not mounted at the root. It now catches app-shell,
route-render and rejected lazy-module errors. Production UI contains safe recovery
text, manual reload and a full-navigation dashboard link; ordinary render errors
also offer Try again. Error details remain logged, and are displayed only in
development. There is no automatic reload loop. Full navigation clears cached
React.lazy rejections.

All lazy routes already had visible Suspense skeletons, including both provider
and protected-layout modules. No route splitting was removed. All four onboarding
links are React Router links to existing routes. All five guide CTAs navigate to
existing routes; its first two upload destinations match their upload CTA text.
No onboarding redesign or route changes were needed.

The guide's wheel listener was already local to its open carousel and cleaned up.
Its select/reInit subscriptions now explicitly stop when closed. The underlying
carousel did leak its reInit subscription; both handlers now detach. DOM tests
compare AppLayout with and without the guide: both render, transition successfully,
and produce no console errors or closed-guide non-passive wheel listener. The
guide remains present. These tests do not measure device CPU or prove the cause
of production lag.

Storage polling now aborts on cleanup and prevents overlapping cycles, including
when one request fails early while the sibling remains pending. Both requests
settle before the next cycle is allowed. Existing late-result guards remain.

## Changed files

| File | Change |
| --- | --- |
| `src/pages/auth/SignupPage.tsx` | Remove duplicate navigation; preserve pending-email, toast, navigation order. |
| `src/pages/auth/VerifyEmailPage.tsx` | Await real session; stop progression and offer sign-in when synchronization fails. |
| `src/pages/auth/LoginPage.tsx` | Do not show login success if session synchronization fails. |
| `src/contexts/AuthContext.tsx` | Remove public role setter; derive role from user; return session-load success. |
| `src/routes/ProtectedAppLayout.tsx` | Require isAuthenticated; retain visible account loading state. |
| `src/main.tsx` | Mount existing ErrorBoundary around App under StrictMode. |
| `src/components/ErrorBoundary.tsx` | Safe production recovery, dynamic-import messaging, manual actions, development-only diagnostics. |
| `src/components/ui/carousel.tsx` | Detach both select and reInit handlers. |
| `src/components/app/QuickGuideDialog.tsx` | Subscribe only while open; retain guide and routes. |
| `src/layouts/AppLayout.tsx` | Abort storage requests on unmount and avoid overlapping polling cycles. |
| `backend/auth.js` | Require code consumption even for verified accounts before issuing cookies. |
| `backend/verification_session.test.js` | Execute actual verification route with isolated backend dependencies; test code checks and cookie issuance. |
| `deploy/Caddyfile.routing.example` | Explicit asset handler, exact SPA rewrite, HTML/asset/error cache policy. |
| `deploy/PRERENDER_AND_CADDY.md` | Correct SPA shell name; document complete release switch, retained chunks, cache policy and server checks. |
| `package.json` | Add frontend test command and Vitest, Testing Library, jsdom development dependencies. |
| `package-lock.json` | Lock test dependencies. |
| `vitest.config.ts` | React/alias/DOM test configuration. |
| `tests/setup.ts` | DOM environment shims and per-test cleanup. |
| `tests/onboarding.test.tsx` | Complete journey, four destinations, single navigation, session failure, context, render/lazy recovery and production-safe output. |
| `tests/protected-layout.test.tsx` | Reject incomplete auth, accept valid auth, show loading UI. |
| `tests/auth-session.test.tsx` | Deduplicate StrictMode refresh rotation; preserve legacy email response. |
| `tests/layout-lifecycle.test.tsx` | Guide A/B rendering/navigation and slow polling/abort checks. |
| `tests/carousel.test.tsx` | Listener cleanup, closed-guide wheel cleanup and all five CTA destinations. |
| `scripts/verify-build-assets.mjs` | Validate SPA shell, hashed assets and emitted JS/CSS references. |
| `docs/ONBOARDING_FLOW_FIX.md` | This report and outstanding production verification. |

## Validation

- `npm install`: completed. Test dependencies installed; backend dependencies installed with `npm ci --prefix backend`.
- `npm test`: 25 frontend tests passed across 5 suites.
- `npm test --prefix backend`: 48 tests passed, including 4 new session cases.
- `UAC_NATIVE_ROOT=/Users/arinatarasova/Downloads/AnyCircumstances node --test scripts/*.test.mjs`: 16 tests passed, including Swift/WebCrypto interoperability and sharing regressions.
- `npm run build`: browser build, SSR build and 28 public prerenders passed.
- `node scripts/verify-build-assets.mjs`: spa.html, 85 assets, 553 JS/CSS references validated; no missing referenced files detected.
- `npx tsc -p tsconfig.app.json --noEmit`: passed.
- `npx eslint tests vitest.config.ts`: passed.
- `npm run lint`: fails with 88 existing errors and 12 warnings. Separately linting an archive of the base main with the same tools yields 88 errors and 13 warnings; no new errors.
- `git diff --check`: passed. Generated dist and dist-ssr are not committed.

Initial existing-suite runs needed backend dependencies and the explicit native
repository path; after those environment corrections all existing tests passed.
Frontend integration uses actual React pages, providers and routing, with mocked
HTTP responses. It does not contact live email, MySQL, Stripe or storage services.

## Deployment and outstanding verification

The existing Caddy example already limited SPA fallback to client routes; it did
not route missing assets to a 200 SPA response. The example is now explicit about
asset isolation and HTML revalidation. No live Caddy configuration or automated
atomic-release strategy exists in the repository. Old tabs still need old chunks
after an atomic release, so retained assets are necessary as documented.

No browser was available from the session's Browser runtime. Real iOS Safari and
mobile viewport/touch behavior, CPU profiling, nested scrolling, 88dvh, Radix
Dialog/Sheet behavior and deployment-time navigation remain unverified. DOM tests
cannot establish those results. No live server was changed. Caddy is not installed
locally, so its example still needs `caddy validate` against the deployment config.

Before production acceptance, verify actual email and cookie flow through both
PINs and all five destinations; JavaScript content types; missing-asset 404 status;
HTML and hashed-asset cache headers; public and share routes; and navigation in an
old tab across a deployment. This work addresses the confirmed code defects and
adds local regression protection, but does not claim a reproduced production
exception or measured resolution of device-specific lag.
