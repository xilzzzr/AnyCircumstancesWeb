# Open PR release review, 16 November 2026

Use the consolidated review branch/PR as the release candidate. It combines the
open changes and their corrections in one tested tree. Do not deploy the old
branches independently and assume these corrections are included. Main was not
changed, and production was not accessed or deployed.

## PR coverage

| Original PR | Review result in this release candidate |
| --- | --- |
| #50 | Website cleanup and assets retained; verified in the production build. |
| #51 | Direct client routes, anchor scrolling, menu behavior and robots rules retained. |
| #52 | Recovery, checkout identity and emergency quota changes retained; additional webhook and share-flow regressions covered. |
| #53 | Retry, account reauthentication and subscription synchronization retained; incomplete subscription state now fails closed. |
| #54 | Release checks, confirmation pages and admin authenticator support retained; test fixture, ciphertext comparison, delivery cleanup and native compatibility corrected. |
| #55 | Backend dependency updates retained. |
| #56 | Frontend dependency updates retained; lockfile reconciled and vulnerable lint-tool transitives updated. |
| #57 | date-fns 4 retained; DayPicker upgraded together with its local Calendar wrapper. |
| #58 | jsdom 31 retained. |
| #59 | Vite 8 retained; React SWC plugin, chunk configuration, browser targets and explicit esbuild test dependency updated together. |
| #60 | **Defer this major upgrade.** Keep @eslint/js and ESLint on 9 together. The installed accessibility/hooks plugin peers do not support ESLint 10. Do not merge the original standalone bump. |
| #61 | Search metadata, schema and sitemap generation retained. |
| #62 | Guides and old-guide redirect retained. |
| #63 | Preferred-source link retained with no third-party script. |
| #64 | Additional guides retained. |
| #65 | Comparison and digital-vault guides retained. |

The review covers code behavior, deployment compatibility and test coverage.
Competitor pricing and editorial claims in guides still need periodic upkeep.

## Corrections made during review

- Use UTC in both the MySQL session and JS driver for API and dispatcher pools.
  Setting only the driver's timezone does not control CURRENT_TIMESTAMP defaults.
  Real database tests caught immediate retries and competing claims on a server
  with a non-UTC default. Each new connection now initializes its session to UTC.
- Recheck pending release state after creating links, clean up partially created
  tokens after an insert error, and retain working links after successful SMTP
  acceptance even if recording completion fails. Count delivered messages once.
- Check escrow ciphertext by decoded bytes, including legacy base64 spellings.
- Never verify an email on GET or HEAD, including legacy JSON endpoints. Explicit
  POST confirmation and the existing code verification endpoint perform the write.
- Do not activate incomplete Stripe entitlements or trust a stale active payload
  when the current subscription cannot be retrieved.
- Recover a recipient package load through its HttpOnly session after redemption,
  without trying to redeem the one-use token again.
- Keep creating 200,000-iteration vault bundles for interoperability with the
  current native app. Web/backend readers accept 600,000 too. Do not enable new
  600,000-iteration bundles until a compatible native reader is released; stored
  keys cannot simply be replaced later.
- Run both .test.ts and .test.tsx files, enforce frontend type checks, and add
  real MySQL integration and encryption/share regression checks to CI.
- Keep the secret scanner enabled; replace the false-positive dummy fixture.
- Serve the existing font package locally so production CSP does not block
  the stylesheet or depend on a third-party font request.

## Deployment requirements

1. Use Node 22.13+ in the 22 line, or Node 24+. Install from the committed npm
   lockfiles in the root and backend. Build and deploy frontend and backend
   together. Serve `dist`, never the Vite development/preview server or `dist-ssr`.
2. Existing security, vault-document and scheduled-check-in migrations remain
   prerequisites. Run the documented schema checks before restarting the backend;
   this review adds no production schema migration.
3. Keep the dispatcher timer enabled. Failed emergency delivery is durable and
   retried with backoff; monitor delivery failures and exhausted retry logs.
4. Configure Stripe to send checkout.session.completed,
   customer.subscription.updated, customer.subscription.deleted, invoice.paid
   and invoice.payment_failed. Admin authenticator secrets are server-only:
   `node backend/create_admin_totp.js <admin-user-id>` generates the setup data.
   Add the resulting mapping to ADMIN_TOTP_SECRETS outside the repository.
5. Use the routing example and preserve the live host's TLS, logging and other
   settings. It includes client routes, no-store private pages, real asset/URL
   404s, the guide redirect and www canonicalization. Build-generated shells also
   protect static client entry points when the server matcher is incomplete.
6. MySQL DATETIME data is expected to represent UTC. New connections enforce UTC;
   review any historical rows if a prior deployment used local-time writes.
   Do not apply a blanket timezone conversion without establishing their origin.
7. Destructive account API requests require the current password, safety PIN and
   confirmation phrase. The web dialog supplies all three. The separate native
   client at the time of review omits the PIN/password in its account-action
   methods and needs a companion client update to use those methods successfully.
   Those calls already omitted the PIN required by main before this review.

## Validation and limits

Local results: 111 frontend tests, 145 backend tests, 12 MySQL tests (including
the parent suite), 15 encryption/share regression tests and one native
interoperability test passed. Both dependency audits reported zero known
vulnerabilities. Production output contains 33 public routes and 29 client shells;
the asset verifier checked 127 assets and 616 emitted JS/CSS references.

Run these checks from the repository root:

```sh
npm ci
npm run typecheck
npm test
npm run test:crypto
npm run build
node scripts/verify-build-assets.mjs
python3 scripts/verify-public.py
npm audit
npm ci --prefix backend
npm test --prefix backend
npm audit --prefix backend
```

For the database checks, provide an explicitly isolated MySQL server through
MYSQL_TEST_HOST/PORT/USER/PASSWORD or MYSQL_TEST_SOCKET and run
`npm run test:mysql --prefix backend`. The tests create and drop their own random
`uac_release_test_*` database. They never use application DB_* credentials. CI
runs them on MySQL 8.4; local review used MySQL 9.0.1 with a non-UTC server default.
SMTP and Stripe are simulated; database queries and transactions are real.

The native interoperability check uses the current Swift crypto sources and
actual native cryptography on macOS. It exchanges key bundles and multi-chunk
files in both directions, including legacy file decryption and a wrong password.

The repository-wide legacy lint report remains non-gating: 23 existing type/style
errors and 11 warnings were present in the reviewed tree. Type checks, runtime
regressions, dependency audits, production build and integration checks are
separate gates. Lint debt is not evidence of a clean global lint run.

No live server configuration, production data, actual SMTP delivery, Stripe
account events or AWS permissions were exercised. Passing these checks supports
this release candidate within that scope; it cannot establish zero possible bugs
or security defects in an unexamined production environment.
