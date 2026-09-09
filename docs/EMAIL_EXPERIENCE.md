# AnyCircumstances email system

## Inventory and implementation

Every application-generated email now uses `backend/emails.js` and has HTML and plain-text alternatives.

| Email | Sender/call sites | Notes |
| --- | --- | --- |
| Account verification (signup and resend) | `backend/auth.js`, `sendVerificationEmail` | Browser verification button, visible fallback URL, six-digit code; existing 48-hour expiry |
| Password reset | `backend/auth.js`, `sendPasswordResetEmail` | Existing `/reset-password#token=…` link and reset API preserved |
| Emergency contact invitation (initial and resend) | `backend/auth.js`, `sendEmergencyContactInviteEmail` | Existing contact verification/setup destination preserved |
| Panic-PIN check-in vault delivery | `backend/auth.js`, `dispatchEmergencyForUser` | Every assigned-file URL retained |
| Explicit emergency vault delivery | `backend/auth.js`, `/trigger-emergency` | Uses the same emergency template as manual delivery |
| Overdue check-in/grace-period reminders | `backend/dispatch_emergency.js`, `sendGraceReminders` | Now includes HTML and a check-in button |
| Automatic dead man's switch vault delivery | `backend/dispatch_emergency.js`, `main` | Now includes HTML, all shared-file links, and setup instructions |

Inventory: seven `sendMail` call sites, two existing Nodemailer transports. No additional application email sends were found in the web/backend or adjacent iOS repository. Billing uses Stripe/Apple flows; their provider-generated emails are outside these templates. Contact/support uses mailto links. No separate login/security, email-change, account-notification, direct attachment, or stored-message email sender exists here. No application send path was left unmigrated.

## Reuse

`renderAnyCircumstancesEmail` accepts `title`, optional `heading`, `preview`, trusted `bodyHtml` or escaped `bodyText`, `ctaText`/`ctaUrl`, `secondaryCta: { label, url }`, `verificationCode`, `info: { title, text }`, and `securityNotice` (or legacy `footerNote`). It returns `{ html, text }` for Nodemailer. Escape interpolated user content with `escapeHtml`; never pass untrusted HTML. Use `renderEmergencyEmail` for emergency file deliveries. `emailButton` and `emailSender` are reusable helpers.

The charcoal/sage/soft-white palette, rounded card and pill button come from the site's existing styles. A text wordmark renders with images disabled. Tables, inline styles, a fluid 600px card and an Outlook conditional wrapper provide email-safe structure. Critical links remain visible. No remote font or image dependency is required.

## Verification URLs and compatibility

New signup/resend links target `GET /auth/verify-email/browser?token=…`. The server performs the existing hashed-token lookup and transactional consumption, then sends a 303 redirect to `PUBLIC_WEB_BASE_URL/email-verified?status=success|already_verified|expired|invalid|error`. The final destination contains no token, email address, or database ID. Responses use no-store and no-referrer headers.

Legacy `/auth/verify-email?token=…` links also redirect when the request explicitly accepts `text/html`. Requests with `Accept: application/json`, no Accept header, or the usual API `*/*` continue receiving the original JSON response/status behavior, including `already_used`. The dedicated browser route always redirects. Middleware rate limits and failures also redirect browser verification requests to the error state.

`POST /auth/verify-email-code`, its session cookies, and code-based onboarding remain unchanged. The iOS client in `AnyCircumstances/Services/APIClient.swift` uses this code endpoint; no Swift changes are required. Token generation, hashing, expiration, reset behavior, sharing permissions, delivery scheduling and recipient selection remain unchanged. Existing consumed-token records identify repeat clicks; deleted/unrecognized records display the invalid state.

`/email-verified` has five branded states and links to `/login`. Expired/invalid/error states link to `/verify-email?resend=1`, where users can enter their email without needing signup session storage. Resend calls the existing rate-limited API with generic, non-enumerating confirmation copy.

## Deployment and configuration

No new environment variables or database migrations are required. Existing `PUBLIC_API_BASE_URL` and `PUBLIC_WEB_BASE_URL` must identify the deployed API and frontend. Keep `PUBLIC_APP_BASE_URL` if used for shared-file/check-in URLs.

Sender resolution is now consistent: `EMAIL_FROM`, then `MAIL_FROM`, then `SMTP_FROM`, then `SMTP_USER`; the configured mailbox is retained with display name `AnyCircumstances`. If both EMAIL_FROM and MAIL_FROM are set differently, the dispatcher now follows EMAIL_FROM like auth. Align these existing variables with the intended verified sender mailbox before rollout. SMTP host, port, credentials and transport settings were not changed.

Deploy the frontend and Caddy route update before or alongside the backend. Add `/email-verified` to the production SPA matcher as shown in `deploy/Caddyfile.routing.example`; otherwise direct redirects will return 404. Reload Caddy using your existing deployment process. No deployment or live email sends were performed as part of this change.

## Validation

- `npm run build`: passed, including SSR and 28 prerendered public pages.
- `npm test --prefix backend`: 20 tests passed, including template tests and real HTTP verification-handler tests with a simulated database, plus existing backend tests.
- `NODE_ENV=production node scripts/check-email-result.mjs`: checks compiled markup for all five states plus unknown-state fallback and login/resend destinations.
- Backend JavaScript syntax and `git diff --check`: passed.
- Repository-wide email search repeated: all seven sends supply HTML and text from shared templates.
- Code verification, password reset token/fragment handling, contact setup and iOS API paths inspected for compatibility.
- `npx tsc --noEmit -p tsconfig.app.json` reports existing errors in unchanged `EmergencyContactsPage.tsx:165` (`ApiListResp.contacts`) and `PricingPage.tsx:113` (`billingInterval` type).
- No connected browser was available. Real SMTP, database end-to-end flows, native iOS execution, mobile screenshots, and Gmail/Apple Mail/Outlook rendering were not exercised.

## Production manual checklist

1. Create a test account. Check sender identity, subject, preview, branding, code, expiry copy and fallback link in Gmail, Apple Mail and Outlook at phone and desktop widths, with images disabled.
2. Click verification: confirm a clean `/email-verified?status=success` URL and working Sign in CTA. Click again: confirm the already-verified state.
3. Test expired and invalid credentials plus a simulated API outage/rate limit. Confirm branded pages and working resend recovery from a fresh browser with no signup session.
4. Request a new verification email and verify by code on both website and iOS. Check API JSON payloads and session behavior. Confirm superseded/expired codes do not verify an unverified account.
5. Request/reset a password. Confirm the fragment token is removed from browser history, the reset succeeds once, and expired/reused links fail appropriately.
6. Invite and resend to a controlled emergency contact. Complete contact verification/setup. Exercise manual and panic-PIN delivery with synthetic files and verify every assigned-file link.
7. With controlled test accounts, trigger an overdue grace reminder and automatic delivery after grace expiry. Check timing and setup-incomplete messaging; do not use real emergency contacts for this test.
8. Confirm no content overflows on narrow screens, text and links remain readable, and keyboard focus is visible on the result/resend pages.

## Design and setup follow-up

Emails now use a dark sage gradient header, layered charcoal card, gradient code/info panels and a sage gradient action button. Every gradient has a solid-color fallback; dark color-scheme hints help supporting clients retain the design. Run `node scripts/preview-emails.mjs` to create synthetic HTML/text previews under `dist/email-previews`, including a desktop/phone-width preview viewer.

The setup guide no longer pretends a step is complete when it is clicked. It links to existing plan, verification, contact and upload pages; the dashboard links back to the guide. `/verification` redirects to `/app/verification`, and the former `/app/billing/payment` destination redirects to billing. Add `/verification` to the production Caddy SPA matcher along with `/email-verified`.

Protected app routes now wait for the session request before deciding to redirect to login. Verification settings have bounded loading, explicit error/retry recovery, a setup return link and inline save controls. Network errors no longer masquerade as free-plan restrictions.

Removed `body > #root > div { min-height: 100vh; }`: it applied viewport height to utility siblings such as toast regions as well as page shells. Layout shells retain their own minimum heights. This fixes that source of excess document height without hiding content or suppressing scrolling. Live browser geometry still needs confirmation because no browser was connected in the development session.

Follow-up checks: production build, 20 backend tests, targeted frontend lint, compiled setup-link checks (`NODE_ENV=production node scripts/check-setup.mjs`) and email-result checks passed. Confirm in deployment that the footer is the end of the document, toast notifications do not add document height, all four setup destinations open on mobile, and settings errors offer recovery.
