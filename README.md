# AnyCircumstances

Website and backend for [anycircumstances.com](https://anycircumstances.com): an encrypted document vault with
scheduled check-ins and email delivery to chosen recipients.

## Local development

Requires Node.js and npm.

```sh
npm ci
npm run dev        # website on http://localhost:8080
npm test           # frontend unit tests
npm run build      # production build with prerendered public pages
```

The backend lives in `backend/` and has its own `package.json` (`npm ci --prefix backend`,
`npm test --prefix backend`).

## Tech stack

- Vite, React, TypeScript
- Tailwind CSS and shadcn/ui components
- Express and MySQL backend (`backend/`)

## Deployment

The site is not deployed from GitHub. See `deploy/PRERENDER_AND_CADDY.md` for the build,
prerender and Caddy routing steps.

## Apple App Store subscriptions

The backend accepts App Store Server Notifications V2 and stores Apple and Stripe
subscriptions as independent entitlements. A user has paid access while at least
one provider entitlement is active.

1. Apply `backend/20260812_add_multi_provider_entitlements.sql` to the application database.
2. Download Apple's root certificates and store the DER files on the backend host.
3. Configure these backend environment variables:

```text
APPLE_BUNDLE_ID=com.example.app
APPLE_APP_ID=1234567890
APPLE_SUBSCRIPTION_PRODUCT_IDS=com.example.monthly,com.example.annual
APPLE_ROOT_CA_PATHS=/secure/path/AppleRootCA-G3.cer,/secure/path/AppleRootCA-G2.cer
```

The built-in product mapping matches the iOS app's Starter (5 GB/monthly), Plus
(25 GB/weekly), and Commercial (200 GB/daily) products. Override it, if needed,
with `APPLE_PRODUCT_PLAN_JSON`, keyed by App Store product ID.

4. In App Store Connect, configure the App Store Server Notifications V2 URL as:

```text
https://your-api-host/apple/app-store-notifications
```

5. Before the iOS app starts a purchase, request
`GET /auth/billing/apple/account-token` and pass the returned UUID to StoreKit as
the purchase `appAccountToken`. After purchase, POST StoreKit's signed transaction
to `/auth/billing/apple/sync` as `signedTransactionInfo` to make website access
available immediately; server notifications keep renewals, expirations, refunds,
and revocations synchronized afterward.
