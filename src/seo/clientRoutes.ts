// Pages that are rendered in the browser rather than prerendered. People reach several of
// them straight from an email (password reset, email verification) or by refreshing, so the
// build writes a copy of the app shell (dist/spa.html) to dist/<route>/index.html for each one.
// That way they load even if the web server's single-page-app route list is incomplete.
// tests/client-routes.test.ts checks that every non-public route in App.tsx is listed here.
export const clientOnlyRoutes = [
  "/admin",
  "/admin/login",
  "/cookies",
  "/status",
  "/share",
  "/verification",
  "/login",
  "/signup",
  "/email-verified",
  "/verify-email",
  "/create-pin",
  "/create-panic-pin",
  "/onboarding",
  "/forgot-password",
  "/reset-password",
  "/app",
  "/app/vault",
  "/app/upload",
  "/app/verification",
  "/app/check-in",
  "/app/emergency-contacts",
  "/app/billing/payment",
  "/app/billing",
  "/app/activity",
  "/app/settings",
  "/app/plan",
  "/app/edit-plan",
  "/app/ideas",
  "/app/help",
] as const;
