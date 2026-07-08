const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const { authRouter, stripeWebhookHandler } = require("./auth");
const { filesRouter } = require("./files");

const app = express();
app.set("trust proxy", 1);
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));

app.set("etag", false);

app.post(
  "/stripe/webhook",
  require("express").raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use((req, res, next) => {
  const t0 = Date.now();
console.log("[REQ_START]", req.method, req.url);
  res.setTimeout(15000, () => {
    console.error("[REQ_TIMEOUT]", req.method, req.url);
    if (!res.headersSent) res.status(504).json({ ok: false, error: "timeout" });
  });
  res.on("finish", () =>
    console.log("[REQ_END]", req.method, req.url, res.statusCode, Date.now() - t0 + "ms")
  );
  next();
});

const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "http://localhost:8080,http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      console.error("[CORS_BLOCK] origin=", origin, "allowedOrigins=", allowedOrigins);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const globalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const filesLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});


app.use(globalLimiter);


app.use((req, res, next) => {
  if (req.path.startsWith("/auth") || req.path.startsWith("/files")) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      req.rawBody = buf ? buf.toString("utf8") : "";
    },
  })
);
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true });
});

app.use("/auth/login", loginLimiter);
app.use("/auth", authLimiter, authRouter);
app.use("/files", filesLimiter, filesRouter);

// API_404_GUARD
app.use((req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/auth") || req.path.startsWith("/api")) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }
  next();
});

app.use((err, req, res, next) => {
  const msg = String((err && err.message) || "");
  const isJsonParse =
    err &&
    (err.type === "entity.parse.failed" || err instanceof SyntaxError || msg.toLowerCase().includes("json"));

  const maskSecrets = (s) => {
    const str = String(s || "");
    return str
      .replace(/("password"\s*:\s*)"(.*?)"/gi, '$1"***"')
      .replace(/("pin"\s*:\s*)"(.*?)"/gi, '$1"***"')
      .slice(0, 400);
  };

  if (isJsonParse) {
    const raw = maskSecrets(req.rawBody || "");
    console.error("[API ERROR] invalid_json", {
      method: req.method,
      path: req.originalUrl || req.url,
      raw,
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
