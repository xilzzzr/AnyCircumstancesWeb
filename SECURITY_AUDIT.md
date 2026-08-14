# Security audit and hardening report

Date: 2026-08-14

Scope: React/Vite frontend, Express backend, MySQL access, S3 upload/download flows, Stripe and Apple billing, SMTP/APNs notifications, authentication, emergency-contact sharing, dependencies, tracked files, and Git history.

This is a code-level review. It cannot prove the live AWS, DNS, reverse-proxy, database, bucket, IAM, SSH, Cloudflare, or deployment configuration.

## Executive summary

The review found three critical application issues and several high-severity weaknesses. The clear code-level remediations are implemented in this branch. The most urgent operational action is credential rotation: historical commits contain a database password, JWT signing secret, and SMTP credential. Values are intentionally omitted from this report.

The application also uses a server-held escrow private key capable of unwrapping file keys. That architecture is not end-to-end encryption against a compromised application server and needs a deliberate product/security decision plus KMS/HSM design review.

## Endpoint and attack-surface inventory

The backend exposes 40 authentication/account/billing/contact routes, 19 file/key/share routes, two signed provider webhooks, and one health route. The rate-limit matrix below covers all of them individually or in behaviorally equivalent groups.

- Anonymous application surfaces are registration/login/recovery/verification, the escrow public key and file health check, bearer share/contact-verification flows, signed Stripe/Apple webhooks, and health. Expensive anonymous email paths now have destination and global ceilings.
- Authenticated file, contact, billing, device, verification, and account routes derive identity from the verified HttpOnly access cookie. Client-supplied user IDs are not accepted as authorization state.
- There are no backend admin, debug, maintenance, database-reset, test-email, NoSQL, WebSocket, remote-URL fetch, or shell-command endpoints. The inert frontend `/admin` placeholders and development role switch were removed; any future admin implementation must add a server-stored role and backend authorization tests before UI routes are connected.
- Database queries use parameter placeholders. The limited dynamic SQL uses server-owned placeholder counts or allowlisted table names rather than client-controlled SQL fragments.
- The one `dangerouslySetInnerHTML` use generates CSS from developer-defined chart configuration, not user content. Security-sensitive randomness uses Node/WebCrypto; remaining `Math.random` calls are presentation/local UI identifiers only.
- The tracked-file scan found no current private-key blocks or recognizable live AWS/Stripe secret formats, and the production bundle contains no source maps. The historical credential finding still requires rotation because Git deletion does not revoke a secret.

## Vulnerability report

### Critical — password-reset credential disclosed to the requester — fixed

- Location: `backend/auth.js`, password-reset request route (around lines 813–855 before this fix).
- Vulnerability: the API returned the raw reset token and reset URL in `reset_token_dev_only` and `reset_url_dev_only` fields in every environment.
- Danger: anyone who knew a verified email address could request a token and immediately reset that account's password.
- Attack: submit the victim's email to `/auth/password-reset/request`, read the token from JSON, then call `/auth/password-reset/confirm`.
- Fix: removed all reset/verification development secrets from responses; reset tokens now travel in the email link fragment and are removed from browser history immediately after page load.

### Critical — cross-user file assignment enabled emergency-share BOLA — fixed

- Location: `backend/auth.js`, emergency contact creation and file assignment routes around lines 2304–2538; emergency dispatch queries around lines 1800–2020.
- Vulnerability: client-supplied file IDs were inserted without verifying that every file belonged to the authenticated user. Dispatch trusted those assignment rows.
- Danger: a crafted assignment could connect another user's file to an attacker-controlled contact and later produce a valid bearer share link.
- Attack: authenticate as a paid user, submit a known/leaked victim file ID while creating or updating a contact, verify an attacker email, and trigger emergency delivery.
- Fix: normalize/deduplicate/cap the ID array, verify all IDs with `files.user_id = authenticated user`, independently re-check contact/file owner equality during listing, dispatch, and every public share-token operation, dispatch only to verified contacts, and revoke outstanding bearer links when recipient identity or assignments change. Legacy invalid rows/tokens therefore fail closed.

### Critical — production accepted Apple sandbox transactions — fixed

- Location: `backend/apple_subscriptions.js`, transaction and notification verification around lines 16–100.
- Vulnerability: production verification fell back to Apple's sandbox verifier, including when the client supplied a sandbox environment hint.
- Danger: a valid test purchase could be converted into a production paid entitlement.
- Attack: send a legitimately signed sandbox transaction to `/auth/billing/apple/sync` while authenticated to a production account.
- Fix: production now verifies only Production receipts and notifications. Sandbox acceptance requires both a non-production process and `ALLOW_APPLE_SANDBOX=true`; client sync also requires the signed transaction's `appAccountToken` to match the server-issued account token.

### High — unbounded S3 upload and client-trusted size enabled denial of wallet — fixed

- Location: `backend/files.js`, `/presign-upload` and `/confirm-upload` around lines 320–500; `src/pages/app/UploadPage.tsx`.
- Vulnerability: the browser received a presigned PUT without a content-length policy, and confirmation trusted `size_bytes` supplied by the browser.
- Danger: an authenticated subscriber could upload objects far above the configured maximum or plan quota and report a smaller value, increasing storage and transfer costs.
- Attack: obtain a presigned URL, PUT a very large object directly, then confirm a fake small size.
- Fix: use a presigned POST with an S3 content-length policy, reserve quota atomically while locking the billing profile, enforce plan storage limits, require SSE-S3, HEAD the object on confirmation, compare its real size with the reservation, and delete mismatched objects/rows.
- Deployment dependency: update the S3 CORS policy to permit browser `POST` and the `x-amz-server-side-encryption` field.

### High — credentials committed in Git history — infrastructure action required

- Location: historical `backend/.env` blobs in Git history; the current file is ignored and no longer tracked.
- Vulnerability: database, JWT, and SMTP credentials existed in committed history.
- Danger: deleted Git files remain available in clones, forks, caches, pull-request refs, and provider history.
- Attack: anyone with repository-history access recovers old credentials and connects to services or forges sessions if those credentials remain valid.
- Fix: rotate/revoke all affected credentials first. Then use `git filter-repo` or GitHub support to remove sensitive blobs where appropriate. History rewriting does not replace rotation.

### High — contact and account destructive changes needed re-authentication — fixed

- Location: `backend/auth.js` contact, PIN, cancellation, and deletion routes; corresponding React forms.
- Vulnerability: a stolen session alone could replace PINs, create/change recipients, assign files, cancel billing and erase files, or delete the account.
- Danger: the emergency-sharing design makes recipient changes especially sensitive.
- Attack: use a stolen cookie to add an attacker email, assign files, replace the panic PIN, and trigger delivery.
- Fix: require the current account password server-side for PIN creation/change, contact creation/edit/deletion/file assignment, subscription cancellation, and account deletion. Frontend forms now collect it explicitly.

### High — public key replacement could redirect future envelopes — fixed

- Location: `backend/files.js`, user/contact public-key routes around lines 270–310 and 640–730.
- Vulnerability: authenticated requests or a bearer share link could overwrite an existing key.
- Danger: replacement could make existing ciphertext unavailable or redirect newly generated envelopes to an attacker key.
- Fix: parse and validate SPKI keys, make established keys immutable, and accept only an identical key on subsequent requests.

### High — contact-verification page allowed stored script injection — fixed

- Location: `backend/auth.js`, `renderEmergencyContactVerifyHtml`.
- Vulnerability: owner-controlled email text was HTML-escaped in markup but was also interpolated through `JSON.stringify` inside an inline `<script>`. A `</script>` sequence could break out of the JavaScript context.
- Danger: an attacker could invite a victim as a contact and execute script on the application/API origin when the victim followed the confirmation link, enabling same-origin requests with the victim's cookies.
- Attack: register an account using a syntactically accepted email containing an HTML script terminator, add a victim contact, and wait for the victim to open the confirmation page.
- Fix: removed the inline script and loading transition. The completed verification result is now rendered directly with context-appropriate HTML escaping and remains compatible with Helmet's CSP.

### High — webhook idempotency could permanently drop failed events — fixed

- Location: `backend/auth.js` Stripe webhook around lines 2790–2920; `backend/apple_subscriptions.js` notification handler around lines 209–245.
- Vulnerability: event IDs were recorded before processing. A later error left the ID recorded, so the provider retry was answered as a duplicate and skipped.
- Danger: paid access, revocation, invoice, or renewal state could permanently diverge.
- Fix: distinguish duplicate-key errors from database failures and remove the event marker after a processing failure so the provider can retry. Stripe subscription ownership also falls back to the server-side subscription mapping instead of metadata alone.

### High — failed Stripe plan edits could grant unbilled storage or erase local plan state — fixed

- Location: `backend/auth.js`, `/billing/update-plan`; the billing editor flow.
- Vulnerability: local billing-profile values were written before Stripe accepted the subscription change. A failed provider call could therefore leave the database describing a plan that was never purchased. Opening and abandoning the editor could also make valid plan state appear cancelled in the dashboard.
- Danger: an attacker could request the largest storage allowance and exploit a Stripe/provider failure to retain the local quota without paying; ordinary customers could incorrectly lose access after cancelling an edit.
- Attack: call the plan-update endpoint with a valid high-tier request while forcing the downstream Stripe operation to fail after the local write, or enter and exit the editor without confirming.
- Fix: opening/abandoning the editor is read-only. Updates now require a server-recorded active Stripe entitlement, retrieve and verify the live Stripe subscription, update Stripe first, and persist allowlisted plan/quota values only after Stripe succeeds.

### High — vulnerable backend dependency chain — fixed

- Location: `backend/package.json` and lockfile.
- Vulnerability: the initial backend audit included a critical XML-parser advisory plus high-severity Nodemailer advisories.
- Fix: upgraded the AWS dependency graph, Nodemailer, React Router, and Vite and removed unused SSG packages. Both root and backend `npm audit` now report zero vulnerabilities.

### Medium — refresh/reset/verification token races — fixed

- Location: `backend/auth.js`, token consumption helpers around lines 340–475.
- Vulnerability: one-time tokens were selected without row locks, allowing concurrent requests to pass pre-consumption checks.
- Fix: added `FOR UPDATE`, atomic refresh rotation, refresh-token reuse detection that revokes the user's live refresh tokens, and invalidation of all sibling email-verification credentials after one succeeds.

### Medium — weak verification-link entropy and long-lived share links — fixed

- Location: `backend/auth.js` verification token generation; `backend/files.js` and `backend/dispatch_emergency.js` share creation.
- Vulnerability: email/contact links used six-digit codes, and emergency file links lasted ten years.
- Fix: link credentials now contain 384 bits of cryptographic randomness. Six-digit email entry remains account-scoped and rate-limited. Share links default to 30 days and are capped at 90 days through `SHARE_LINK_TTL_DAYS`.

### Medium — CSRF and sensitive URL logging — fixed

- Location: `backend/server.js` around lines 43–77 and 191–227.
- Vulnerability: cookie-authenticated mutations relied primarily on SameSite behavior, request logs included full query strings, and malformed JSON logging included portions of the body.
- Fix: reject browser cross-site mutations using `Sec-Fetch-Site` and an exact Origin allowlist, preserve native clients that send neither header, log paths without query strings, never log rejected request bodies, and retain HttpOnly/Secure/SameSite cookies. Production forces `Secure` cookies.

### Medium — plan return paths accepted untrusted navigation values — fixed

- Location: `src/pages/app/PlanBuilderPage.tsx` and `src/pages/app/EditPlanPage.tsx`.
- Vulnerability: `returnTo` was read directly from the query string and later passed to navigation/persistence without verifying that it was a same-origin application path.
- Danger: browser/router behavior can turn crafted absolute, protocol-relative, or backslash-normalized values into an open redirect, making trusted application links useful for phishing.
- Attack: send a user a crafted plan-editor URL with a malicious `returnTo`, then rely on exit/save navigation to move the user to the attacker-controlled destination.
- Fix: canonicalize through the browser URL parser, require the current origin and an explicit single-leading-slash path, and otherwise use a fixed dashboard/billing fallback.

### Medium — distributed and cost-triggering endpoint abuse — partially fixed

- Location: `backend/security.js` and `backend/server.js`.
- Vulnerability: most limits were per-IP only, allowing rotating IPs to multiply bcrypt, SMTP, Stripe, APNs, S3, and database work.
- Fix: added account/destination limits plus single-process global hard ceilings, `Retry-After`, hashed security-limit logs, PIN limits, emergency dispatch quotas, public-share ceilings, billing/action quotas, and a bounded in-memory key map.
- Remaining risk: these counters are process-local. Multi-instance enforcement needs Redis or an edge/WAF rule; see infrastructure actions.

### Medium — device-token reassignment and unbounded devices — fixed

- Location: `backend/auth.js`, `/device-token` around lines 2670–2720.
- Vulnerability: duplicate APNs tokens could be reassigned to a different user and accounts could accumulate unlimited active tokens.
- Fix: reject cross-user token ownership and cap active tokens at ten per account.

### Medium — public cryptography claims overstated the implemented guarantees — fixed in copy; architecture remains

- Location: public landing/features/how-it-works/vault/dead-man's-switch pages, login/signup panels, footer, and email template.
- Vulnerability: the site claimed “zero-knowledge,” “end-to-end,” and that the service never had encryption-key access while the backend holds an escrow private key that can unwrap per-file keys.
- Danger: customers could make sensitive storage decisions based on a stronger threat model than the implementation provides; a server-runtime compromise can defeat the claimed boundary.
- Attack: compromise the application runtime, database and object-storage access, then use the escrow key path to unwrap stored file keys.
- Fix: replaced those claims with accurate client-side encryption/ciphertext/recovery-key language. Eliminating the architectural risk still requires the KMS/HSM or true end-to-end redesign described below.

### Low/defense in depth — validation and response minimization — fixed

- Added maximum email/name/relationship/password sizes, bcrypt's 72-byte input boundary, plan allowlists and numeric ranges, file-array caps, base64/key validation, real file existence checks before presigning downloads, and reduced public share lookup data.
- Registration no longer confirms whether an email already exists.
- Login performs a constant-cost dummy password check for unknown accounts. New password-reset and share bearer URLs keep tokens in the browser fragment and immediately remove it from the address bar; legacy path share links remain read-only compatible.
- Removed the unused browser mock API that contained demo credentials/fixed verification codes; the vault now imports only standalone display-format helpers.
- JWT verification explicitly allows only HS256, and production refuses a signing secret shorter than 32 bytes.
- Production Vite output contains no source-map files.

## Rate-limit matrix

All non-webhook routes inherit a process-local global ceiling of 3,000 requests/minute and an IP ceiling of 600 requests/5 minutes. `/auth/*` also inherits 60/IP/15 minutes; `/files/*` inherits 120/IP/5 minutes. Values are environment-overridable where shown in `backend/server.js`.

| Endpoint | Auth required? | IP limit | User/account limit | Destination limit | Global hard ceiling | CAPTCHA? | External cost? |
|---|---|---|---|---|---|---|---|
| `POST /auth/register` | No | 60/15m | — | 5/email/hour | 300 email actions/hour; 3,000 app/min | Adaptive | bcrypt, DB, SMTP |
| `POST /auth/login` | No | 10/15m | 10/email/15m | — | 3,000 app/min | Adaptive | bcrypt, DB |
| `GET /auth/verify-email` | Bearer link | 60/15m | 10/token/15m | — | 3,000 app/min | No | DB |
| `POST /auth/verify-email-code` | Email + code | 60/15m | 10/email/15m | — | 3,000 app/min | After failures | DB/session |
| `POST /auth/resend-verification` | No | 60/15m | — | 5/email/hour | 300 email actions/hour; 3,000 app/min | Adaptive | DB, SMTP |
| `POST /auth/password-reset/request` | No | 60/15m | — | 5/email/hour | 300 email actions/hour; 3,000 app/min | Adaptive | DB, SMTP |
| `POST /auth/password-reset/confirm` | Bearer token | 60/15m | — | — | 3,000 app/min | No | bcrypt, DB |
| `POST /auth/refresh`, `POST /auth/logout` | Refresh cookie | 60/15m | — | — | 3,000 app/min | No | DB |
| `GET /auth/me` | Access cookie for positive result | 60/15m | — | — | 3,000 app/min | No | DB |
| `POST /auth/set-pin`, `/set-panic-pin` | Access cookie + password | 60/15m | 20/user/hour | — | 3,000 app/min | No | bcrypt, DB |
| `GET/PUT /auth/verification-settings` | Access cookie | 60/15m | mutation: 20/user/hour | — | 3,000 app/min | No | DB |
| `POST /auth/verification-check-in` | Access cookie + PIN | 60/15m | 10 PIN attempts/15m; panic dispatch 2/user/hour | — | 50 panic dispatches/hour; otherwise 3,000 app/min | No | bcrypt, DB; panic PIN can dispatch |
| `POST /auth/unlock-vault` | Access cookie + PIN | 60/15m | 10/user/15m | — | 3,000 app/min | No | bcrypt, DB |
| `GET /auth/verification-checkins`, `/verification-status` | Access cookie | 60/15m | — | — | 3,000 app/min | No | DB |
| Billing status/summary/invoices/quote/account-token routes | Access cookie | 60/15m | — | — | 3,000 app/min | No | DB |
| Billing portal/checkout/update/Apple sync routes | Access cookie; provider proof where applicable | 60/15m | 20/user/hour | — | 3,000 app/min | No | Stripe/Apple, DB |
| `POST /auth/trigger-emergency` | Paid access cookie + panic PIN | 60/15m | 2/user/hour | — | 50 dispatches/hour | No | bcrypt, DB, SMTP |
| `GET /auth/emergency-contacts` | Paid access cookie | 60/15m | — | — | 3,000 app/min | No | DB |
| Contact create/edit/delete/files/resend routes | Paid access cookie; password except resend | 60/15m | 20/user/hour | — | 3,000 app/min | No | bcrypt/DB; SMTP on create/resend |
| `GET /auth/emergency-contacts/verify` | Bearer link | 60/15m | 10/token/15m | — | 3,000 app/min | No | DB |
| `POST /auth/device-token` | Access cookie | 60/15m | max 10 devices/account | — | 3,000 app/min | No | DB; future APNs |
| Account cancel/delete routes | Access cookie + password + phrase | 60/15m | 20/user/hour | — | 3,000 app/min | No | Stripe, S3, DB |
| `GET /files/escrow-public-key`, `/files/health` | No | 120/5m | — | — | 3,000 app/min | No | Cheap; cache key at edge |
| `POST /files/presign-upload` | Paid access cookie | 120/5m | 20/user/5m plus storage quota | — | 3,000 app/min | No | S3/storage |
| `POST /files/confirm-upload` | Paid access cookie | 120/5m | 60/user/5m | — | 3,000 app/min | No | S3 HEAD/DELETE |
| `POST /files/presign-download` | Paid cookie + ownership | 120/5m | 120/user/5m | — | 3,000 app/min | No | S3 egress |
| `POST /files/delete` | Paid cookie + ownership | 120/5m | 30/user/5m | — | 3,000 app/min | No | S3, DB |
| File list/key/envelope/contact-key routes | Paid cookie + ownership | 120/5m | — | — | 3,000 app/min | No | DB; escrow crypto on envelope creation |
| Public share-token routes | Bearer share token | 120/5m | — | — | 600 share requests/min | Anomaly-based | DB, RSA, S3 egress |
| `POST /stripe/webhook` | Stripe signature | edge recommended | provider event ID | — | 600 webhook requests/min | No | DB, Stripe fallback read |
| `POST /apple/app-store-notifications` | Apple JWS chain | edge recommended | notification UUID | — | 600 webhook requests/min | No | JWS/certificate verification, DB |
| `GET /health` | No | 600/5m | — | — | 3,000 app/min | No | Cheap |

The global and account counters above protect one Node process. Production with multiple processes/hosts must use a shared Redis-backed limiter or edge-enforced global rules.

## Infrastructure configuration required

1. **Rotate exposed credentials immediately.** Rotate the historical database password, JWT secret, and SMTP credential. Rotating the JWT secret intentionally invalidates existing access tokens. Check provider audit logs from the earliest exposure date.
2. **Cloudflare/AWS WAF.** Put the API behind managed DDoS/bot protection. Add global and per-route rate rules for login, signup, reset/resend, share endpoints, webhooks, S3 signing, and emergency actions. Use managed challenges for suspicious anonymous traffic rather than always-on CAPTCHA.
3. **Shared rate-limit store.** Use Redis/ElastiCache with atomic counters for account, destination, endpoint, and global ceilings. Configure fail-safe behavior for cost-triggering routes if the limit store is unavailable.
4. **Outbound work queues.** Put SMTP/APNs and scheduled emergency delivery behind a durable outbox/queue with idempotency keys, bounded workers, retry/backoff and a global concurrency ceiling. The code-level request limits reduce abuse but do not provide durable delivery or cross-host concurrency control.
5. **S3.** Block all public access; disable ACLs with bucket-owner enforcement; allow only the application IAM role; require TLS and server-side encryption in bucket policy; configure CORS for the new presigned `POST`; enable access logging/CloudTrail data events, version/lifecycle policy as appropriate, and storage/egress billing alarms.
6. **Escrow key.** Move `ESCROW_PRIVATE_KEY_PEM` out of a process environment variable into KMS/HSM-backed envelope operations. Restrict decrypt permission to the narrow emergency workflow, log every decrypt without key material, alarm on volume, and define rotation/recovery procedures.
7. **Secrets.** Store DB, JWT, SMTP, Stripe, Apple and APNs credentials in AWS Secrets Manager or SSM Parameter Store with KMS, least-privilege IAM, rotation and audit logging. Keep production and non-production accounts/secrets separate.
8. **RDS/network.** RDS must not have public accessibility or `0.0.0.0/0` database ingress. Permit 3306 only from the application security group; require TLS and certificate validation; use a least-privilege application DB user and encrypted backups.
9. **Host/reverse proxy.** Expose only 443 at the edge, redirect HTTP to HTTPS before requests reach Node, retain HSTS, block dotfiles/backups/source maps, restrict SSH to SSM/VPN or allowlisted keys, disable password/root SSH, patch Node/OS/OpenSSL regularly, and do not expose Redis, Docker, metrics or admin tooling.
10. **Monitoring.** Alert on failed-login/reset spikes, 429 volume, WAF blocks, emergency dispatches, share downloads, recipient/key changes, webhook failures, unusual S3 bytes, SMTP/APNs volume, DB saturation, 5xx/latency, and AWS/Stripe cost anomalies.
11. **Durable audit trail.** Add an append-only audit sink/table for logins, password/PIN changes, recipient and assignment changes, key registration, downloads, emergency dispatch, billing changes, cancellation/deletion and admin actions. Include user, action, target, outcome, timestamp, request ID, hashed/session-safe metadata, and IP; never log secrets or bearer URLs.
12. **GitHub.** Enable secret scanning/push protection, Dependabot alerts/updates, required status checks, branch protection and code-owner review for auth/billing/crypto files.

## Tests

Implemented:

- `backend/security.test.js` verifies global hard-ceiling behavior, `429`/`Retry-After`, cross-site mutation rejection, same-origin acceptance, and native-client compatibility.
- Production frontend build verifies integration and confirms no emitted `.map` files.
- Node syntax checks cover all modified backend modules.
- Root and backend dependency audits report zero vulnerabilities, including development dependencies.

Recommended integration/security tests in an isolated database and provider sandbox:

- User A cannot create or update a contact assignment with User B's file ID; dispatch also ignores a pre-seeded invalid row.
- Existing share tokens fail after a recipient email change, recipient deletion, or assignment change; a pre-seeded cross-owner token fails every share API.
- A normal authenticated user cannot access any future admin API; admin tests must assert server-side role state, not frontend state.
- Protected fields such as `user_id`, role, plan status, price, provider and storage limit are ignored/rejected.
- Login, reset, resend, code verification and PIN attempts hit IP, account/destination and global ceilings, including simulated rotating IPs.
- Expired, used and concurrently submitted reset/verification/refresh/share tokens fail safely.
- Malformed JSON, oversized strings/arrays, invalid SPKI/base64, invalid IDs, NaN/range plan values and oversized uploads are rejected before expensive work.
- S3 refuses objects outside the policy; confirmation rejects a mismatched real object size; concurrent reservations cannot exceed quota.
- Paid APIs reject inactive entitlements, sandbox Apple receipts in production, arbitrary add-ons, duplicate checkout, and client-reported payment success.
- Stripe/Apple webhooks reject missing/invalid signatures, deduplicate success, and retry successfully after an injected processing failure.
- Destructive actions and recipient/PIN changes fail with a valid session but wrong/missing password.
- Contact key replacement with a different key fails; identical-key retry remains idempotent.

## Final security checklist

### FIXED

- Reset and verification secrets exposed in API responses
- Cross-user emergency file assignment and dispatch authorization
- Production acceptance of Apple sandbox receipts
- Unbounded/client-trusted S3 upload size and missing plan quota enforcement
- Missing re-authentication on PIN, recipient, cancellation and deletion changes
- CSRF origin checks and sensitive query/body logging
- One-time token races and refresh reuse handling
- Public-key overwrite paths
- Stored XSS in contact confirmation HTML
- Stale recipient/assignment bearer-link revocation
- Webhook failure/idempotency retry loss
- Long-lived/low-entropy bearer links
- Layered account/destination/global application safeguards
- Device-token reassignment/count abuse
- Known root and backend dependency vulnerabilities
- Excessive public share response fields and missing input bounds
- Inaccurate zero-knowledge/end-to-end marketing claims for the escrow architecture
- Unused mock credentials and client-only admin/development role placeholders

### NEEDS INFRASTRUCTURE CONFIGURATION

- Credential rotation and optional history rewrite
- Cloudflare/AWS WAF and managed bot/DDoS controls
- Redis/ElastiCache distributed counters
- Private RDS/security groups/TLS and least-privilege DB user
- Private S3/IAM/bucket policy/CORS/logging/lifecycle/billing alarms
- KMS/HSM escrow-key redesign
- HTTPS-only reverse proxy, host/SSH hardening and dotfile/backup blocking
- Central monitoring, cost alarms and durable audit storage
- GitHub secret scanning, Dependabot and branch protection

### NEEDS MANUAL REVIEW

- Verify live ALLOWED_ORIGINS, proxy count and `X-Forwarded-Proto` behavior
- Verify AWS IAM, RDS, S3, backups, CloudTrail, VPC and security-group state
- Verify Node/OS/OpenSSL/reverse-proxy versions and patch policy
- Exercise Stripe and Apple webhook/reconciliation behavior with real sandbox fixtures
- Define incident response, credential/key rotation and emergency-delivery abuse procedures
- Confirm privacy/retention requirements for contact emails, logs, invoices and deleted accounts

### REMAINING RISKS

- The server escrow private key can decrypt per-file keys; compromise of app runtime plus database/storage can defeat confidentiality. The product must not claim server-compromise-resistant end-to-end encryption without redesign.
- Emergency-contact private keys are exportable and stored unencrypted in browser `localStorage`; XSS or local profile compromise can extract them. Prefer non-extractable WebCrypto keys in IndexedDB or an encrypted export/recovery design.
- Application global limits are per-process until Redis/edge enforcement is deployed; rotating IPs can still multiply load across instances.
- No durable security audit log currently records all sensitive actions.
- Anonymous register/reset/resend responses are generic, but provider/DB processing-time differences can still permit statistical email enumeration. A durable asynchronous outbox plus uniform response timing is the robust remediation.
- Password reset revokes refresh tokens immediately, but already-issued access tokens can remain usable for their short lifetime (15 minutes by default). Immediate cross-device invalidation requires a server-side session/token-version check.
- Automated malware scanning is not present. Vault blobs are client-encrypted, so conventional server-side scanning is not possible without changing the confidentiality model; enforce download-as-attachment and document the tradeoff.
- Contact and escrow workflows are cryptographically complex and need an independent design review and end-to-end threat model.
