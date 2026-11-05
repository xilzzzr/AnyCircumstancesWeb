# Pioneer invitations (30 days free + lifetime 20% off)

## Offer
- 50 random, unique invitation codes, each redeemable **once**.
- A 30-day Stripe subscription trial starts at Checkout completion. Stripe Checkout collects a payment method and does not charge the subscription during the trial.
- A single 20% off **forever** coupon is attached via the individual Stripe promotion code to the subscription. The recurring discount stays after the trial; cancellation ends the subscription.
- Annual subscriptions get 30 days free followed by 20% off annual billing, not a free annual billing cycle.
- The limitation is per redemption, not an identity guarantee. Refunds/abandoned sessions should be audited in Stripe.

## Setup (do not run in a public terminal or commit secrets)
1. Deploy the web and backend changes together after testing in Stripe test mode.
2. On a secured machine with the backend dependencies installed, run:
   `STRIPE_SECRET_KEY=sk_test_... node backend/create_pioneer_codes.js /absolute/private/path/pioneer-codes-test.csv`
3. Keep the CSV confidential, send each unique code individually. Repeat **once** with the live key and a different private output path after successful testing.
4. The script reuses its marked coupon and any already-created marked codes; it caps the batch at 50. It refuses to overwrite an existing CSV. Store the file outside the repository.
5. Test a code end-to-end: Pricing page -> Checkout -> subscription trialing with 20% forever discount -> trial renewal invoice. Use Stripe test clocks if practical. Test second redemption rejected.
6. Confirm the existing Stripe webhook URL is receiving `checkout.session.completed` and `customer.subscription.updated` events; existing authorization treats `trialing` as active.

## Caveats
- Checkout now accepts promo codes **on the Pricing page rather than within hosted Stripe Checkout**, for ALL Stripe promo codes. This ensures the trial is included only for the special marked pioneer codes.
- Existing codes without the pioneer marker still work as ordinary Stripe discounts (without the trial).
- This does not apply to Apple in-app purchases.
- This PR does **not** create live Stripe objects or deploy to the server. The Stripe secret is deliberately never placed in Git.
- Backend direct checkout calls cannot bypass Stripe's promotion redemption count; the server checks the marker and redemption status before requesting a Stripe Checkout session.
