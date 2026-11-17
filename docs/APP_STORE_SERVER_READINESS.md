# Native App Store release support

Apple review and TestFlight use real, Apple-signed sandbox transactions. The
production API must be able to verify these without allowing arbitrary accounts
to use sandbox purchases for production access.

Set `ALLOW_APPLE_SANDBOX=true` and `APPLE_SANDBOX_ACCOUNT_TOKENS` to a comma-separated
list of the dedicated review/test accounts' opaque UUIDs. Get a UUID through the
authenticated `/auth/billing/apple/account-token` endpoint before buying. An
empty or malformed allowlist does not enable sandbox on a production server.
Whenever a nonempty allowlist is configured it is enforced even if `NODE_ENV`
was accidentally omitted.

Both production and sandbox transactions still go through Apple's certificate,
bundle, environment and online verification. A client environment hint does not
skip production verification. The authenticated sync route separately enforces
the app-account-token owner and original-transaction owner. StoreKit's local
Xcode test signatures remain invalid on this server. Sandbox notifications use
the same transaction policy before writing an entitlement.

Configure `APPLE_APP_ID=6770357123`, `APPLE_BUNDLE_ID=com.anycircumstances.app`, the
three native product IDs, and Apple's real DER root certificates. Remove
placeholder IDs. App Store builds use production APNs; sandbox/development device
tokens need a separate testing backend/configuration.

Native logout optionally sends its `deviceToken`. The API deletes only that
user/token pair in the session-revocation transaction. This prevents reminders
for a signed-out account from staying registered on a shared device. Website
logout without this optional field retains its existing behavior.

`node --test backend/apple_app_review.test.js backend/account_safety_routes.test.js`
covers the review allowlist, invalid signatures, untrusted environment hints,
write prevention, and scoped device-token removal. The full backend suite passes
150 tests. These tests use isolated transports and do not exercise a real Apple
sandbox purchase or send email/push notifications.

Keep any review password and PIN outside the repository and logs. Populate the
App Review credential fields only with the dedicated account. Test actual
purchases, restores, refunds and notifications before review submission.
