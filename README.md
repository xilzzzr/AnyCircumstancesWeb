# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

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

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
