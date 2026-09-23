const { initializeEnvironment, validateBackendEnvironment } = require("./environment");

initializeEnvironment();
validateBackendEnvironment();

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const { authRouter, authPool, stripeWebhookHandler } = require("./auth");
const { createAppleNotificationHandler } = require("./apple_subscriptions");
const { filesRouter } = require("./files");
const {
  authenticatedUserKey,
  createFixedWindowLimiter,
  positiveInt,
  rejectCrossSiteMutation,
  stableHash,
} = require("./security");

const app = express();
app.set("trust proxy", 1);
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));

app.set("etag", false);

// Includes middleware failures before the authentication router is reached.
const { verificationBrowserErrors } = require("./email_verification_route");
app.use(verificationBrowserErrors(process.env.PUBLIC_WEB_BASE_URL || "https://anycircumstances.com"));

const webhookCircuitBreaker = createFixedWindowLimiter({
  name: "signed_webhook_global",
  windowMs: 60_000,
  limit: positiveInt(
    process.env.WEBHOOK_GLOBAL_LIMIT_PER_MINUTE || process.env.STRIPE_WEBHOOK_GLOBAL_LIMIT_PER_MINUTE,
    600
  ),
  key: () => "global",
});

app.post(
  "/stripe/webhook",
  webhookCircuitBreaker,
  require("express").raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use((req, res, next) => {
  const t0 = Date.now();
  console.log("[REQ_START]", req.method, req.path);
  res.setTimeout(15000, () => {
    console.error("[REQ_TIMEOUT]", req.method, req.path);
    if (!res.headersSent) res.status(504).json({ ok: false, error: "timeout" });
  });
  res.on("finish", () =>
    console.log("[REQ_END]", req.method, req.path, res.statusCode, Date.now() - t0 + "ms")
  );
  next();
});

const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "http://localhost:8080,http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === "production" && !allowedOrigins.some((origin) => origin.startsWith("https://"))) {
  throw new Error("ALLOWED_ORIGINS must include an HTTPS origin in production");
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("origin_not_allowed"));
    },
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  next();
});

const globalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

const { createAuthLimiters } = require("./auth_limits");
const { authLimiter, loginLimiter, loginAccountLimiter } = createAuthLimiters();

const filesLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const applicationCircuitBreaker = createFixedWindowLimiter({
  name: "application_global",
  windowMs: 60_000,
  limit: positiveInt(process.env.APPLICATION_GLOBAL_LIMIT_PER_MINUTE, 3000),
  key: () => "global",
});

app.use(applicationCircuitBreaker, globalLimiter);


app.use((req, res, next) => {
  if (req.path.startsWith("/auth") || req.path.startsWith("/files")) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const publicEmailDestinationLimiter = createFixedWindowLimiter({
  name: "public_email_destination",
  windowMs: 60 * 60 * 1000,
  limit: positiveInt(process.env.PUBLIC_EMAIL_DESTINATION_LIMIT_PER_HOUR, 5),
  key: (req) => stableHash(String(req.body?.email || "").trim().toLowerCase()),
});
const publicEmailGlobalLimiter = createFixedWindowLimiter({
  name: "public_email_global",
  windowMs: 60 * 60 * 1000,
  limit: positiveInt(process.env.PUBLIC_EMAIL_GLOBAL_LIMIT_PER_HOUR, 300),
  key: () => "global",
});
const verificationAccountLimiter = createFixedWindowLimiter({
  name: "verification_account",
  windowMs: 15 * 60 * 1000,
  limit: positiveInt(process.env.VERIFICATION_ACCOUNT_LIMIT_PER_15_MINUTES, 10),
  key: (req) => stableHash(String(req.body?.email || req.query?.token || "").trim().toLowerCase()),
});
const pinUserLimiter = createFixedWindowLimiter({
  name: "pin_user",
  windowMs: 15 * 60 * 1000,
  limit: positiveInt(process.env.PIN_USER_LIMIT_PER_15_MINUTES, 10),
  key: authenticatedUserKey,
});
const sensitiveUserLimiter = createFixedWindowLimiter({
  name: "sensitive_user",
  windowMs: 60 * 60 * 1000,
  limit: positiveInt(process.env.SENSITIVE_USER_LIMIT_PER_HOUR, 20),
  key: authenticatedUserKey,
});
const publicShareGlobalLimiter = createFixedWindowLimiter({
  name: "public_share_global",
  windowMs: 60_000,
  limit: positiveInt(process.env.PUBLIC_SHARE_GLOBAL_LIMIT_PER_MINUTE, 600),
  key: () => "global",
});

app.use(rejectCrossSiteMutation(allowedOrigins));
app.use(
  ["/auth/register", "/auth/resend-verification", "/auth/password-reset/request"],
  publicEmailGlobalLimiter,
  publicEmailDestinationLimiter
);
app.use("/auth/login", loginAccountLimiter);
app.use(["/auth/verify-email", "/auth/verify-email-code", "/auth/emergency-contacts/verify"], verificationAccountLimiter);
app.use(["/auth/unlock-vault", "/auth/verification-check-in"], pinUserLimiter);
app.use(
  [
    "/auth/billing/create-checkout-session",
    "/auth/billing/create-portal-session",
    "/auth/billing/portal",
    "/auth/billing/update-plan",
    "/auth/billing/apple/sync",
    "/auth/account/cancel-subscription",
    "/auth/account",
  ],
  sensitiveUserLimiter
);
app.use("/auth/emergency-contacts", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  return sensitiveUserLimiter(req, res, next);
});
app.use(
  [
    "/files/share-lookup",
    "/files/share-set-contact-public-key",
    "/files/share-get-contact-envelope",
    "/files/share-presign-download",
  ],
  publicShareGlobalLimiter
);

app.post("/apple/app-store-notifications", webhookCircuitBreaker, createAppleNotificationHandler(authPool));

app.get("/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true });
});

app.use("/auth/login", loginLimiter);
app.use("/auth", authLimiter, authRouter);
app.use("/files", filesLimiter, filesRouter);

// API_404_GUARD
app.use((req, res, next) => {
  if (
    req.path === "/health" ||
    req.path.startsWith("/auth") ||
    req.path.startsWith("/files") ||
    req.path === "/stripe/webhook" ||
    req.path.startsWith("/apple") ||
    req.path.startsWith("/api")
  ) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }
  next();
});

app.use((err, req, res, next) => {
  const msg = String((err && err.message) || "");
  if (msg === "origin_not_allowed") {
    return res.status(403).json({ ok: false, error: "origin_not_allowed" });
  }
  const isJsonParse =
    err &&
    (err.type === "entity.parse.failed" || err instanceof SyntaxError || msg.toLowerCase().includes("json"));

  if (isJsonParse) {
    console.error("[API ERROR] invalid_json", {
      method: req.method,
      path: req.path,
    });
    if (res.headersSent) return next(err);
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  console.error("[API ERROR]", err && (err.stack || err));
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: "server_error" });
});

const PORT = Number(process.env.PORT || 3002);
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Backend listening on http://127.0.0.1:${PORT}`);
});
