# Admin dashboard

The admin sign-in page is `/admin/login`; the dashboard is `/admin`.
It uses an existing verified, active AnyCircumstances account, then requires
password verification to issue a separate 15-minute admin cookie. Admin access
does not require a paid subscription or completed customer onboarding.

## Deployment

1. Merge this change and deploy the normal client build and backend together.
2. On the server, find the **existing account's numeric ID** using a parameterized
   database query, or your database console:

   ```sql
   SELECT id, email, status, email_verified_at FROM users
   WHERE email = 'replace-with-your-admin-email@example.com';
   ```

3. Add this setting to the backend's existing server environment, replacing
   the example IDs with the intended account IDs:

   ```dotenv
   ADMIN_USER_IDS=123,456
   ```

   Never put this variable in a frontend `VITE_` setting. With no configured
   IDs, all admin requests are denied. IDs avoid granting access accidentally
   when an email changes. There is no hardcoded admin password or shared login.
   To revoke access, remove the ID and restart the backend.

4. Keep the existing `STRIPE_SECRET_KEY`, database configuration, secure cookies,
   HTTPS origin restrictions, and JWT secret. The existing Stripe client needs
   read access to subscriptions, customers, coupons, promotion codes, balance
   transactions, and charges. No new API keys or database migration are required.
5. Add `/admin /admin/login` to the existing Caddy `@client_spa` path matcher,
   as shown in `deploy/Caddyfile.routing.example`. Preserve production settings;
   do not replace the whole Caddyfile. API traffic continues through `/auth/*`.
   Validate and reload Caddy, then restart `uac-backend` with the updated environment.
6. Open `https://anycircumstances.com/admin/login` and sign in with the authorized
   account's email and password. Verify an ordinary account receives no access.

## What is displayed

- Searchable customer ID/email list, account and subscription status, monthly or
  annual plan price, check-in frequency, add-ons, and billing providers.
- Customer storage used and configured storage limit. The aggregate covers all
  `files` records, including reservations, and is independent of search/pagination.
  “GB” matches existing upload enforcement: 1 GB = 1,073,741,824 bytes.
- Stripe subscription coupon name/code, percentage or fixed amount, duration,
  expiry, price nickname, optional subscription metadata `sale_name` / `sale`,
  and an annual-pricing label. A sale embedded directly into a custom price can
  only be identified by its name/metadata; no historical list price is invented.
- Current monthly recurring revenue, estimated before fees/tax. Annual amounts
  are divided by 12. Recurring discounts are applied; once-only discounts do not
  reduce ongoing MRR. Trial, canceled, delinquent, and collection-paused
  subscriptions do not contribute. Cancel-at-period-end subscriptions remain
  in MRR while active. Unsupported mixed-interval, tiered, or metered plans
  show unknown amounts and a notice instead of an invented value.
- Actual payments, transaction fees, refunds/adjustments, and net receipts from
  Stripe balance transactions for a selected UTC calendar month. These figures
  cover Stripe customers linked to UAC billing profiles/subscriptions and may
  include other payments from those same Stripe customers. Payouts are excluded.
  Amounts include any tax collected, so net receipts are not business profit.
  Account-wide fees (for example, separately billed Stripe Billing charges) and
  unattributed adjustments are excluded with notices. Historic transactions for
  customers whose billing links were permanently deleted cannot be attributed.
- Currencies are shown separately. Apple subscription plan entitlements appear,
  but Apple prices, offers, commissions, and revenue are unavailable from the
  existing stored data and are explicitly excluded from Stripe totals.

Stripe reports load in the background, are polled, and are cached for five
minutes per month per backend process. Refresh reloads customer data and the
latest cached report. This avoids tying report generation to the API's 15-second
request timeout. Errors never turn into zero revenue. Generation is bounded by
pagination/time limits; larger accounts should move it to a durable reporting job.

## Access controls and validation

Every admin API route uses the existing server-side user/session checks (including
verification, disabled/deleted accounts, duress locks, and session version), plus
the server allowlist. Reporting also requires the separate signed admin cookie,
bound to the user ID and session version with issuer/audience validation. Password
verification and API traffic are rate limited. Existing origin/CSRF controls apply.
Responses use `no-store`; admin pages are excluded from search indexing. The API
returns explicit business fields and never reads vault contents, passwords, or PINs.

Run:

```sh
node --test backend/admin.test.js backend/admin_reporting.test.js
npx tsc --noEmit -p tsconfig.app.json
npx eslint src/pages/admin/AdminPage.tsx src/App.tsx src/components/seo/RouteSeo.tsx
npm run build
node scripts/verify-build-assets.mjs
```

Tests cover permission denial, forged roles, password checks, expired and revoked
sessions, cookie properties, field filtering, SQL parameterization, pagination,
coupons, annual normalization, trial/cancellation handling, refunds, currency
separation, and excluding unrelated transactions. Stripe calls and SQL are mocked;
production reconciliation still requires the configured live Stripe account.
