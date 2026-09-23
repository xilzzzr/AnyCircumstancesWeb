const express = require("express");
const mysql = require("mysql2/promise");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const Stripe = require("stripe");
const { escapeHtml, emailSender, renderAnyCircumstancesEmail, renderEmergencyEmail } = require("./emails");
const { currentApnsEnv } = require("./push_notifications");
const {
  ensureAppleAccountToken,
  refreshAggregateBillingStatus,
  transactionBelongsToAnotherUser,
  upsertAppleEntitlement,
  verifyTransaction,
} = require("./apple_subscriptions");
const { purgeVaultFiles, deleteUserRecords } = require("./account_lifecycle");
const { queueAndDeliverEmergency } = require("./emergency_delivery");
const { createFixedWindowGate, positiveInt } = require("./security");
const { consumeEmailVerificationByTokenOnly } = require("./email_verification");
const { createEmailVerificationHandler } = require("./email_verification_route");
const router = express.Router();

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_SSL_CA,
  JWT_ACCESS_SECRET,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  COOKIE_SECURE,
  COOKIE_DOMAIN,
  PUBLIC_API_BASE_URL,
  PUBLIC_WEB_BASE_URL,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  STRIPE_SECRET_KEY,
} = process.env;

const dbPoolConfig = {
  connectTimeout: 10000,
  host: DB_HOST,
  port: DB_PORT ? Number(DB_PORT) : 3306,
  user: DB_USER,
  password: DB_PASSWORD || "",
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const sslCaPath = String(DB_SSL_CA || "").trim();
if (sslCaPath) {
  dbPoolConfig.ssl = { ca: fs.readFileSync(sslCaPath) };
} else if (String(DB_HOST || "").includes("rds.amazonaws.com")) {
  dbPoolConfig.ssl = { ca: fs.readFileSync("/etc/ssl/certs/rds-global-bundle.pem") };
}

const pool = mysql.createPool(dbPoolConfig);

const accessTtlSeconds = ACCESS_TOKEN_TTL_SECONDS ? Number(ACCESS_TOKEN_TTL_SECONDS) : 900;
const refreshTtlDays = REFRESH_TOKEN_TTL_DAYS ? Number(REFRESH_TOKEN_TTL_DAYS) : 30;
const cookieSecure = process.env.NODE_ENV === "production" || String(COOKIE_SECURE || "").toLowerCase() === "true";
const cookieDomain = COOKIE_DOMAIN || undefined;

const publicApiBaseUrl = (PUBLIC_API_BASE_URL || "http://localhost:3002").replace(/\/+$/, "");
const publicWebBaseUrl = (PUBLIC_WEB_BASE_URL || "https://anycircumstances.com").replace(/\/+$/, "");
if (process.env.NODE_ENV === "production") {
  for (const [name, value] of [
    ["PUBLIC_API_BASE_URL", publicApiBaseUrl],
    ["PUBLIC_WEB_BASE_URL", publicWebBaseUrl],
    ["PUBLIC_APP_BASE_URL", String(process.env.PUBLIC_APP_BASE_URL || publicWebBaseUrl)],
  ]) {
    let url;
    try { url = new URL(value); } catch {}
    if (!url || url.protocol !== "https:") throw new Error(`${name} must be an HTTPS URL in production`);
  }
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
// Equalizes the expensive password-check path when an email is not registered.
const DUMMY_PASSWORD_HASH = "$2b$12$Bzp.v2dUrXUXjidOrU6Nre9/CR1KzXktUVuqYfy1m.WXOKuf7CV2K";
const emergencyGlobalGate = createFixedWindowGate({
  name: "emergency_dispatch_global",
  windowMs: 60 * 60 * 1000,
  limit: positiveInt(process.env.EMERGENCY_GLOBAL_LIMIT_PER_HOUR, 50),
});
const emergencyUserGate = createFixedWindowGate({
  name: "emergency_dispatch_user",
  windowMs: 60 * 60 * 1000,
  limit: positiveInt(process.env.EMERGENCY_USER_LIMIT_PER_HOUR, 2),
});

function consumeEmergencyDispatchQuota(userId, res) {
  const globalResult = emergencyGlobalGate("global");
  const userResult = globalResult.allowed ? emergencyUserGate(`user:${String(userId)}`) : null;
  const blocked = !globalResult.allowed ? globalResult : !userResult.allowed ? userResult : null;
  if (!blocked) return true;
  res.setHeader("Retry-After", String(blocked.retryAfter));
  res.setHeader("Cache-Control", "no-store");
  res.status(429).json({ ok: false, error: "emergency_rate_limited" });
  return false;
}

function logError(context, err) {
  const meta = {
    context,
    name: err?.name,
    message: err?.message,
    code: err?.code,
    errno: err?.errno,
    sqlState: err?.sqlState,
  };
  console.error("[AUTH ERROR]", meta);
  if (err?.stack) console.error(err.stack);
}

function nowUtc() {
  return new Date();
}

function addDays(d, days) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function addHours(d, hours) {
  const x = new Date(d.getTime());
  x.setUTCHours(x.getUTCHours() + hours);
  return x;
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input), "utf8").digest("hex");
}
function shareExpiresAt() {
  const requested = Number(process.env.SHARE_LINK_TTL_DAYS || 30);
  const days = Number.isInteger(requested) ? Math.max(1, Math.min(requested, 90)) : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSixDigitCode(code) {
  return /^\d{6}$/.test(String(code || ""));
}

function genSixDigitCode() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, "0");
}

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { algorithm: "HS256", expiresIn: accessTtlSeconds });
}

function signAccessTokenForUser(user) {
  return signAccessToken({
    sub: String(user.id),
    email: user.email,
    sv: Number(user.session_version || 1),
  });
}

function vaultCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "strict",
    domain: cookieDomain,
    path: "/",
    maxAge: maxAgeMs,
  };
}

function setVaultAuthorizationCookie(res, userId, sessionVersion) {
  const token = jwt.sign(
    { sub: String(userId), sv: Number(sessionVersion || 1), purpose: "vault" },
    JWT_ACCESS_SECRET,
    { algorithm: "HS256", expiresIn: 10 * 60 }
  );
  res.cookie("vault_auth", token, vaultCookieOptions(10 * 60 * 1000));
}

function clearVaultAuthorizationCookie(res) {
  res.clearCookie("vault_auth", {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "strict",
    domain: cookieDomain,
    path: "/",
  });
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    domain: cookieDomain,
    path: "/",
    maxAge: maxAgeMs,
  };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("access_token", accessToken, cookieOptions(accessTtlSeconds * 1000));
  res.cookie("refresh_token", refreshToken, cookieOptions(refreshTtlDays * 24 * 60 * 60 * 1000));
}

function clearAuthCookies(res) {
  const options = { httpOnly: true, secure: cookieSecure, sameSite: "lax", domain: cookieDomain, path: "/" };
  res.clearCookie("access_token", options);
  res.clearCookie("refresh_token", options);
  clearVaultAuthorizationCookie(res);
}

let _mailer = null;

function getMailer() {
  const host = String(SMTP_HOST || "").trim();
  const port = SMTP_PORT ? Number(SMTP_PORT) : 0;
  const user = String(SMTP_USER || "").trim();
  const pass = String(SMTP_PASS || "").replace(/\s+/g, "").trim();
  const secure = String(SMTP_SECURE || "").toLowerCase() === "true";

  if (!host || !port || !user || !pass) return null;
  if (_mailer) return _mailer;

  _mailer = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return _mailer;
}

async function sendVerificationEmail(toEmail, code, verifyUrl) {
  const transporter = getMailer();
  const from = emailSender();

  if (!transporter) {
    console.error("[MAILER] Missing SMTP env vars; skipping verification email.");
    return { ok: false, skipped: true };
  }

  const subject = "Verify your AnyCircumstances email";
  const rendered = renderAnyCircumstancesEmail({
    title: "Verify your email",
    preview: "Confirm your email address to finish setting up your account.",
    bodyText: "Thanks for creating your AnyCircumstances account. Confirm your email address to finish setting up your account.",
    verificationCode: code,
    info: { title: "Valid for 48 hours", text: "For security, this link and code expire after 48 hours." },
    ctaText: "Verify email",
    ctaUrl: verifyUrl,
    footerNote: "If you didn't create an AnyCircumstances account, you can safely ignore this email."
  });

  const text = rendered.text;
  const html = rendered.html;
  await transporter.sendMail({ from, to: toEmail, subject, text, html });
  return { ok: true };
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  const transporter = getMailer();
  const from = emailSender();

  if (!transporter) {
    console.error("[MAILER] Missing SMTP env vars; skipping password reset email.");
    return { ok: false, skipped: true };
  }

  const subject = "Reset your AnyCircumstances password";
  const rendered = renderAnyCircumstancesEmail({
    title: "Reset your password",
    preview: "Choose a new password for your AnyCircumstances account.",
    bodyHtml:
      `<p style="margin:0 0 12px;">We received a request to reset the password for your AnyCircumstances account.</p>` +
      `<p style="margin:0;">Use the button below to choose a new password.</p>`,
    ctaText: "Reset password",
    ctaUrl: resetUrl,
    footerNote: "If you didn't request this, you can safely ignore this email. Your password will not change unless you use the link above."
  });

  const text = rendered.text;
  const html = rendered.html;
  await transporter.sendMail({ from, to: toEmail, subject, text, html });
  return { ok: true };
}

async function getUserByEmail(email) {
  const [rows] = await pool.query(
    "SELECT id, email, password_hash, email_verified_at, status, session_version, duress_locked_until FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

async function getUserById(userId) {
  const [rows] = await pool.query(
    "SELECT id, email, email_verified_at, status, session_version, duress_locked_until FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  return rows[0] || null;
}

function isDuressLocked(user) {
  return Boolean(
    user?.duress_locked_until &&
    new Date(user.duress_locked_until).getTime() > Date.now()
  );
}

async function verifyCurrentPassword(userId, password) {
  if (!password || Buffer.byteLength(String(password), "utf8") > 72) return false;
  const [rows] = await pool.query("SELECT password_hash, status FROM users WHERE id = ? LIMIT 1", [String(userId)]);
  const user = rows?.[0];
  if (!user || user.status !== "active" || !user.password_hash) return false;
  return bcrypt.compare(String(password), String(user.password_hash));
}

function getAccessPayload(req) {
  const access = req.cookies?.access_token ? String(req.cookies.access_token) : "";
  if (!access) return null;
  try {
    return jwt.verify(access, JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

async function requireUserId(req, res) {
  const payload = getAccessPayload(req);
  const userId = payload?.sub ? String(payload.sub) : "";
  if (!userId) {
    res.status(401).json({ ok: false, error: "not_authenticated" });
    return null;
  }

  const user = await getUserById(userId);
  if (
    !user ||
    user.status !== "active" ||
    !user.email_verified_at ||
    isDuressLocked(user) ||
    Number(payload.sv || 0) !== Number(user.session_version || 1)
  ) {
    clearAuthCookies(res);
    res.status(401).json({ ok: false, error: isDuressLocked(user) ? "account_temporarily_locked" : "invalid_session" });
    return null;
  }

  req.userId = userId;
  req.sessionVersion = Number(user.session_version || 1);
  req.authUser = user;
  return userId;
}

async function requireActiveSubscription(req, res) {
  const userId = await requireUserId(req, res);
  if (!userId) return null;

  const [rows] = await pool.query(
    `SELECT EXISTS(
       SELECT 1 FROM billing_entitlements
       WHERE user_id = ? AND status = 'active'
         AND (current_period_end IS NULL OR current_period_end > UTC_TIMESTAMP(3))
     ) AS has_active`,
    [String(userId)]
  );
  const status = rows?.[0]?.has_active ? "active" : "none";

  if (status !== "active") {
    res.status(402).json({ ok: false, error: "payment_required" });
    return null;
  }

  return userId;
}

async function ensureBillingProfile(userId) {
  const uid = String(userId);

  const [rows] = await pool.execute("SELECT user_id FROM billing_profiles WHERE user_id = ? LIMIT 1", [uid]);
  if (rows.length > 0) return;

  await pool.execute(
    `INSERT INTO billing_profiles
      (user_id, status, billing_interval, amount_cents, currency, storage_limit_gb, checkin_frequency, addons_json)
     VALUES
      (?, 'pending_setup', 'monthly', 0, 'usd', 5, 'monthly', JSON_ARRAY())`,
    [uid]
  );
}

async function ensureBillingProfileConn(conn, userId) {
  const uid = String(userId);

  const [rows] = await conn.execute("SELECT user_id FROM billing_profiles WHERE user_id = ? LIMIT 1", [uid]);
  if (rows.length > 0) return;

  await conn.execute(
    `INSERT INTO billing_profiles
      (user_id, status, billing_interval, amount_cents, currency, storage_limit_gb, checkin_frequency, addons_json)
     VALUES
      (?, 'pending_setup', 'monthly', 0, 'usd', 5, 'monthly', JSON_ARRAY())`,
    [uid]
  );
}

async function createEmailVerificationCredentials(conn, userId) {
  await conn.query("DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL", [userId]);

  const expiresAt = addDays(nowUtc(), 2);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = genSixDigitCode();
    const linkToken = crypto.randomBytes(48).toString("base64url");
    try {
      await conn.query(
        "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?), (?, ?, ?)",
        [userId, sha256Hex(code), expiresAt, userId, sha256Hex(linkToken), expiresAt]
      );
      return { code, linkToken };
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) continue;
      throw error;
    }
  }
  throw new Error("Failed to generate unique verification credentials");
}

async function consumeEmailVerificationForUser(conn, userId, code) {
  const tokenHash = sha256Hex(code);

  const [rows] = await conn.query(
    "SELECT id, expires_at, used_at FROM email_verification_tokens WHERE user_id = ? AND token_hash = ? LIMIT 1 FOR UPDATE",
    [userId, tokenHash]
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid_code" };
  if (row.used_at) return { ok: false, reason: "already_used" };
  if (new Date(row.expires_at).getTime() < nowUtc().getTime()) return { ok: false, reason: "expired" };

  await conn.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [userId]);
  await conn.query("UPDATE users SET email_verified_at = NOW() WHERE id = ? AND email_verified_at IS NULL", [userId]);

  return { ok: true };
}

async function issueRefreshToken(conn, userId) {
  const raw = crypto.randomBytes(48).toString("base64url");
  const tokenHash = sha256Hex(raw);
  const expiresAt = addDays(nowUtc(), refreshTtlDays);

  await conn.query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)", [
    userId,
    tokenHash,
    expiresAt,
  ]);

  return raw;
}

async function revokeRefreshToken(conn, raw) {
  const tokenHash = sha256Hex(raw);
  await conn.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL", [tokenHash]);
}

async function rotateRefreshToken(conn, raw) {
  const tokenHash = sha256Hex(raw);
  const [rows] = await conn.query(
    "SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ? LIMIT 1 FOR UPDATE",
    [tokenHash]
  );
  const row = rows[0];

  if (!row) return { ok: false, reason: "invalid_refresh" };
  if (row.revoked_at) {
    await conn.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", [row.user_id]);
    return { ok: false, reason: "refresh_reuse_detected" };
  }
  if (new Date(row.expires_at).getTime() < nowUtc().getTime()) return { ok: false, reason: "expired_refresh" };

  await conn.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL", [row.id]);
  const newRaw = await issueRefreshToken(conn, row.user_id);
  return { ok: true, userId: row.user_id, newRefresh: newRaw };
}

function genResetToken() {
  return crypto.randomBytes(48).toString("base64url");
}

async function createPasswordResetToken(conn, userId) {
  await conn.query("DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL", [userId]);

  const expiresAt = addHours(nowUtc(), 2);

  for (let i = 0; i < 10; i++) {
    const raw = genResetToken();
    const tokenHash = sha256Hex(raw);

    try {
      await conn.query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)", [
        userId,
        tokenHash,
        expiresAt,
      ]);
      return raw;
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) continue;
      throw e;
    }
  }

  throw new Error("Failed to generate unique password reset token");
}

async function consumePasswordResetToken(conn, rawToken, newPassword) {
  const tokenHash = sha256Hex(rawToken);

  const [rows] = await conn.query(
    "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1 FOR UPDATE",
    [tokenHash]
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid_token" };
  if (row.used_at) return { ok: false, reason: "already_used" };
  if (new Date(row.expires_at).getTime() < nowUtc().getTime()) return { ok: false, reason: "expired" };

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await conn.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [row.id]);
  await conn.query(
    "UPDATE users SET password_hash = ?, session_version = session_version + 1, duress_locked_until = NULL WHERE id = ? LIMIT 1",
    [passwordHash, row.user_id]
  );
  await conn.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", [row.user_id]);

  return { ok: true, userId: row.user_id };
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const ageConfirmed = req.body?.ageConfirmed === true;

    if (!validateEmail(email) || email.length > 254) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (!ageConfirmed) return res.status(400).json({ ok: false, error: "age_confirmation_required" });
    if (password.length < 10 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ ok: false, error: "weak_password" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(201).json({ ok: true, needs_email_verification: true });
    }

    const conn = await pool.getConnection();
    let verifyCode = "";
    let verifyUrl = "";

    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        "INSERT INTO users (email, password_hash, status, created_at) VALUES (?, ?, 'active', NOW())",
        [email, passwordHash]
      );

      const userId = result.insertId;

      await ensureBillingProfileConn(conn, userId);

      const credentials = await createEmailVerificationCredentials(conn, userId);
      verifyCode = credentials.code;
      verifyUrl = `${publicApiBaseUrl}/auth/verify-email/browser?token=${encodeURIComponent(credentials.linkToken)}`;

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("register", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }

    let emailSent = false;
    try {
      const out = await sendVerificationEmail(email, verifyCode, verifyUrl);
      emailSent = !!out?.ok;
    } catch (e) {
      logError("sendVerificationEmail(register)", e);
      emailSent = false;
    }

    return res.status(201).json({
      ok: true,
      needs_email_verification: true,
    });
  })
);

router.get(
  ["/verify-email", "/verify-email/browser"],
  asyncHandler(createEmailVerificationHandler({
    pool, consumeToken: consumeEmailVerificationByTokenOnly, publicWebBaseUrl, logError
  }))
);

router.post(
  "/verify-email-code",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "");

    if (!validateEmail(email) || email.length > 254) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (!isSixDigitCode(code)) return res.status(400).json({ ok: false, error: "invalid_code" });

    const user = await getUserByEmail(email);
    if (!user) return res.status(400).json({ ok: false, error: "invalid_code" });
    if (user.status !== "active") return res.status(403).json({ ok: false, error: "account_disabled" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Verification must prove possession of an unused code, even if the
      // account was already verified in another tab or request.
      const out = await consumeEmailVerificationForUser(conn, user.id, code);
      if (!out.ok) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: out.reason });
      }

      const refresh = await issueRefreshToken(conn, user.id);
      const access = signAccessTokenForUser(user);

      await conn.commit();

      setAuthCookies(res, access, refresh);
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("verify-email-code", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!validateEmail(email) || email.length > 254) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (!password || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ ok: false, error: "invalid_credentials" });
    }

    const user = await getUserByEmail(email);
    const passwordOk = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user || !passwordOk) return res.status(401).json({ ok: false, error: "invalid_credentials" });
    if (user.status !== "active") return res.status(403).json({ ok: false, error: "account_disabled" });
    if (isDuressLocked(user)) return res.status(423).json({ ok: false, error: "account_temporarily_locked" });
    if (!user.email_verified_at) return res.status(403).json({ ok: false, error: "email_not_verified" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const refresh = await issueRefreshToken(conn, user.id);
      const access = signAccessTokenForUser(user);

      await conn.commit();

      setAuthCookies(res, access, refresh);
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("login", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.refresh_token ? String(req.cookies.refresh_token) : "";
    if (!raw) return res.status(401).json({ ok: false, error: "missing_refresh" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const rotated = await rotateRefreshToken(conn, raw);
      if (!rotated.ok) {
        await conn.rollback();
        clearAuthCookies(res);
        return res.status(401).json({ ok: false, error: rotated.reason });
      }

      const user = await getUserById(rotated.userId);
      if (!user || user.status !== "active" || !user.email_verified_at || isDuressLocked(user)) {
        await conn.rollback();
        clearAuthCookies(res);
        return res.status(401).json({ ok: false, error: isDuressLocked(user) ? "account_temporarily_locked" : "invalid_user" });
      }

      const access = signAccessTokenForUser(user);

      await conn.commit();

      setAuthCookies(res, access, rotated.newRefresh);
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("refresh", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.refresh_token ? String(req.cookies.refresh_token) : "";
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();
      if (raw) await revokeRefreshToken(conn, raw);
      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("logout-tx", e);
    } finally {
      conn.release();
    }

    clearAuthCookies(res);
    return res.json({ ok: true });
  })
);

router.post(
  "/resend-verification",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!validateEmail(email) || email.length > 254) return res.status(400).json({ ok: false, error: "invalid_email" });

    const user = await getUserByEmail(email);
    if (!user) return res.json({ ok: true });
    if (user.email_verified_at) return res.json({ ok: true });
    if (user.status !== "active") return res.json({ ok: true });

    const conn = await pool.getConnection();
    let verifyCode = "";
    let verifyUrl = "";

    try {
      await conn.beginTransaction();

      const credentials = await createEmailVerificationCredentials(conn, user.id);
      verifyCode = credentials.code;
      verifyUrl = `${publicApiBaseUrl}/auth/verify-email/browser?token=${encodeURIComponent(credentials.linkToken)}`;

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("resend-verification", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }

    let emailSent = false;
    try {
      const out = await sendVerificationEmail(email, verifyCode, verifyUrl);
      emailSent = !!out?.ok;
    } catch (e) {
      logError("sendVerificationEmail(resend)", e);
      emailSent = false;
    }

    return res.json({
      ok: true,
    });
  })
);

router.post(
  "/set-pin",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    if (!(await verifyCurrentPassword(userId, req.body?.password))) {
      return res.status(401).json({ ok: false, error: "reauthentication_failed" });
    }

    const pin = String(req.body?.pin || "");
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ ok: false, error: "invalid_pin" });

    const [otherRows] = await pool.query("SELECT panic_pin_hash FROM users WHERE id = ? LIMIT 1", [String(userId)]);
    const panicHash = otherRows?.[0]?.panic_pin_hash ? String(otherRows[0].panic_pin_hash) : "";
    if (panicHash && await bcrypt.compare(pin, panicHash)) {
      return res.status(409).json({ ok: false, error: "pin_conflicts_with_emergency_pin" });
    }

    const pinHash = await bcrypt.hash(pin, 12);
    await pool.query("UPDATE users SET pin_hash = ? WHERE id = ? LIMIT 1", [pinHash, String(userId)]);

    return res.json({ ok: true });
  })
);

router.post(
  "/set-panic-pin",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    if (!(await verifyCurrentPassword(userId, req.body?.password))) {
      return res.status(401).json({ ok: false, error: "reauthentication_failed" });
    }

    const pin = String(req.body?.pin || "");
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ ok: false, error: "invalid_pin" });

    const [otherRows] = await pool.query("SELECT pin_hash FROM users WHERE id = ? LIMIT 1", [String(userId)]);
    const normalHash = otherRows?.[0]?.pin_hash ? String(otherRows[0].pin_hash) : "";
    if (normalHash && await bcrypt.compare(pin, normalHash)) {
      return res.status(409).json({ ok: false, error: "emergency_pin_conflicts_with_pin" });
    }

    const pinHash = await bcrypt.hash(pin, 12);
    await pool.query("UPDATE users SET panic_pin_hash = ? WHERE id = ? LIMIT 1", [pinHash, String(userId)]);

    return res.json({ ok: true });
  })
);

router.post(
  "/password-reset/request",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!validateEmail(email) || email.length > 254) return res.status(400).json({ ok: false, error: "invalid_email" });

    const user = await getUserByEmail(email);

    if (!user || user.status !== "active" || !user.email_verified_at) {
      return res.json({ ok: true });
    }

    const conn = await pool.getConnection();
    let rawToken = "";
    let resetUrl = "";

    try {
      await conn.beginTransaction();

      rawToken = await createPasswordResetToken(conn, user.id);
      resetUrl = `${publicWebBaseUrl}/reset-password#token=${encodeURIComponent(rawToken)}`;

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("password-reset:request", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }

    let emailSent = false;
    try {
      const out = await sendPasswordResetEmail(email, resetUrl);
      emailSent = !!out?.ok;
    } catch (e) {
      logError("sendPasswordResetEmail(request)", e);
      emailSent = false;
    }

    return res.json({
      ok: true,
    });
  })
);

router.post(
  "/password-reset/confirm",
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || "");
    const newPassword = String(req.body?.password || "");

    if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    if (newPassword.length < 10 || Buffer.byteLength(newPassword, "utf8") > 72) {
      return res.status(400).json({ ok: false, error: "weak_password" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const out = await consumePasswordResetToken(conn, token, newPassword);
      if (!out.ok) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: out.reason });
      }

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("password-reset:confirm", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }

    clearAuthCookies(res);
    return res.json({ ok: true });
  })
);

function daysForFrequency(freq) {
  if (freq === "daily") return 1;
  if (freq === "weekly") return 7;
  return 30;
}

function isValidFrequency(freq) {
  return freq === "daily" || freq === "weekly" || freq === "monthly";
}

function isValidGraceHours(n) {
  return Number.isInteger(n) && n >= 6 && n <= 72 && n % 6 === 0;
}

function isValidReminders(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

async function getVerificationSettingsRow(userId) {
  const [rows] = await pool.query(
    "SELECT user_id, frequency, grace_period_hours, reminders, last_checkin_at, next_due_at FROM verification_settings WHERE user_id = ? LIMIT 1",
    [String(userId)]
  );
  return rows[0] || null;
}

function normalizeBillingFrequency(freq) {
  const f = String(freq || "").toLowerCase();
  if (f === "daily") return "daily";
  if (f === "weekly") return "weekly";
  if (f === "monthly") return "monthly";
  return null;
}

async function getPaidCheckinFrequency(userId) {
  const [rows] = await pool.query(
    "SELECT checkin_frequency, status FROM billing_profiles WHERE user_id = ? LIMIT 1",
    [String(userId)]
  );
  if (!rows[0]) return null;
  if (String(rows[0].status || "") !== "active") return null;
  return normalizeBillingFrequency(rows[0].checkin_frequency) || null;
}

async function syncVerificationFromBilling(userId) {
  const paid = await getPaidCheckinFrequency(userId);
  if (!paid) return;

  const existing = await getVerificationSettingsRow(userId);
  const now = nowUtc();

  const freqChanged = existing && String(existing.frequency || "") !== paid;

  let nextDue = null;

  if (existing?.last_checkin_at) {
    nextDue = addDays(new Date(existing.last_checkin_at), daysForFrequency(paid));
  } else if (!freqChanged && existing?.next_due_at && new Date(existing.next_due_at).getTime() > now.getTime()) {
    nextDue = new Date(existing.next_due_at);
  } else {
    nextDue = addDays(now, daysForFrequency(paid));
  }

  const grace = existing ? Number(existing.grace_period_hours) : 24;
  const reminders = existing ? Number(existing.reminders) : 3;
  const last = existing?.last_checkin_at ? new Date(existing.last_checkin_at) : null;

  await pool.query(
    "INSERT INTO verification_settings (user_id, frequency, grace_period_hours, reminders, last_checkin_at, next_due_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE frequency = VALUES(frequency), grace_period_hours = VALUES(grace_period_hours), reminders = VALUES(reminders), last_checkin_at = verification_settings.last_checkin_at, next_due_at = VALUES(next_due_at)",
    [String(userId), paid, grace, reminders, last, nextDue]
  );
}


function settingsDto(row) {
  return {
    frequency: row.frequency,
    gracePeriodHours: Number(row.grace_period_hours),
    reminders: Number(row.reminders),
    lastCheckinAt: row.last_checkin_at ? new Date(row.last_checkin_at).toISOString() : null,
    nextDueAt: row.next_due_at ? new Date(row.next_due_at).toISOString() : null,
  };
}

router.get(
  "/verification-settings",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    await syncVerificationFromBilling(userId);
const row = await getVerificationSettingsRow(userId);

    if (!row) {
      return res.json({
        ok: true,
        settings: { frequency: "weekly", gracePeriodHours: 24, reminders: 3, lastCheckinAt: null, nextDueAt: null },
      });
    }

    return res.json({ ok: true, settings: settingsDto(row) });
  })
);

router.put(
  "/verification-settings",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

const requestedFrequency = String(req.body?.frequency || "");
const paidFrequency = await getPaidCheckinFrequency(userId);
if (requestedFrequency && paidFrequency && requestedFrequency !== paidFrequency) {
  return res.status(409).json({ ok: false, error: "frequency_locked", frequency: paidFrequency });
}
const frequency = paidFrequency || requestedFrequency;
    const gracePeriodHours = Number(req.body?.gracePeriodHours);
    const reminders = Number(req.body?.reminders);

if (!isValidFrequency(frequency || "")) return res.status(400).json({ ok: false, error: "invalid_frequency" });
    if (!isValidGraceHours(gracePeriodHours)) return res.status(400).json({ ok: false, error: "invalid_grace_period" });
    if (!isValidReminders(reminders)) return res.status(400).json({ ok: false, error: "invalid_reminders" });

const days = daysForFrequency(frequency);
const existing = await getVerificationSettingsRow(userId);
const now = nowUtc();

const freqChanged = existing && String(existing.frequency || "") !== String(frequency || "");

let nextDue = null;
let last = null;

if (existing?.last_checkin_at) {
  last = new Date(existing.last_checkin_at);
  nextDue = addDays(last, days);
} else if (!freqChanged && existing?.next_due_at && new Date(existing.next_due_at).getTime() > now.getTime()) {
  nextDue = new Date(existing.next_due_at);
} else {
  nextDue = addDays(now, days);
}

    await pool.query(
      "INSERT INTO verification_settings (user_id, frequency, grace_period_hours, reminders, last_checkin_at, next_due_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE frequency = VALUES(frequency), grace_period_hours = VALUES(grace_period_hours), reminders = VALUES(reminders), last_checkin_at = COALESCE(verification_settings.last_checkin_at, VALUES(last_checkin_at)), next_due_at = VALUES(next_due_at)",
      [String(userId), frequency, gracePeriodHours, reminders, last, nextDue]
    );

    const saved = await getVerificationSettingsRow(userId);
    return res.json({ ok: true, settings: saved ? settingsDto(saved) : null });
  })
);

router.post(
  "/verification-check-in",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const pin = String(req.body?.pin || "");
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ ok: false, error: "invalid_pin" });

    const [urows] = await pool.query("SELECT pin_hash, panic_pin_hash FROM users WHERE id = ? LIMIT 1", [String(userId)]);
    const pinHash = urows?.[0]?.pin_hash ? String(urows[0].pin_hash) : "";
    const panicHash = urows?.[0]?.panic_pin_hash ? String(urows[0].panic_pin_hash) : "";

    if (!pinHash && !panicHash) return res.status(400).json({ ok: false, error: "pin_not_set" });

    let isPanic = false;
    let ok = false;

    if (panicHash) {
      isPanic = await bcrypt.compare(pin, panicHash);
      if (isPanic) ok = true;
    }

    if (!ok && pinHash) {
      ok = await bcrypt.compare(pin, pinHash);
    }

    if (!ok) return res.status(401).json({ ok: false, error: "invalid_pin" });
    if (isPanic && !consumeEmergencyDispatchQuota(userId, res)) return;

    const row = await getVerificationSettingsRow(userId);

    const paidFrequency = await getPaidCheckinFrequency(userId);
    const frequency = paidFrequency || row?.frequency || "weekly";
    const gracePeriodHours = row ? Number(row.grace_period_hours) : 24;
    const reminders = row ? Number(row.reminders) : 3;

    const now = nowUtc();
    const nextDue = addDays(now, daysForFrequency(frequency));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query("INSERT INTO verification_checkins (user_id, method) VALUES (?, 'manual')", [String(userId)]);

      await conn.query(
        "INSERT INTO verification_settings (user_id, frequency, grace_period_hours, reminders, last_checkin_at, next_due_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE frequency = VALUES(frequency), last_checkin_at = VALUES(last_checkin_at), next_due_at = VALUES(next_due_at)",
        [String(userId), frequency, gracePeriodHours, reminders, now, nextDue]
      );

      if (isPanic) {
        const out = await dispatchEmergencyForUser(conn, userId, req);
        if (!out?.ok) {
          await conn.rollback();
          return res.status(500).json({ ok: false, error: out?.error || "server_error" });
        }
      }

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("verification-check-in", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }

    const saved = await getVerificationSettingsRow(userId);
    return res.json({ ok: true, settings: saved ? settingsDto(saved) : null });
  })
);


router.get(
  "/verification-checkins",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    let limit = Number(req.query?.limit);
    if (!Number.isFinite(limit)) limit = 50;
    limit = Math.max(1, Math.min(200, Math.floor(limit)));

    const [rows] = await pool.query(
      "SELECT id, checked_in_at, method FROM verification_checkins WHERE user_id = ? ORDER BY checked_in_at DESC LIMIT ?",
      [String(userId), limit]
    );

    return res.json({
      ok: true,
      checkins: rows.map((r) => ({
        id: String(r.id),
        checkedInAt: new Date(r.checked_in_at).toISOString(),
        method: r.method === "email_link" ? "email_link" : "manual",
      })),
    });
  })
);

router.get(
  "/verification-status",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
	await syncVerificationFromBilling(userId);

    const row = await getVerificationSettingsRow(userId);
    if (!row || !row.next_due_at) {
      return res.json({
        ok: true,
        status: { state: "not_configured", nextDueAt: null, graceEndsAt: null },
      });
    }

    const nextDueAt = new Date(row.next_due_at);
    const graceEndsAt = new Date(nextDueAt.getTime() + Number(row.grace_period_hours) * 60 * 60 * 1000);
    const now = nowUtc();

    let state = "ok";
    if (now.getTime() > graceEndsAt.getTime()) state = "expired";
    else if (now.getTime() > nextDueAt.getTime()) state = "overdue";

    return res.json({
      ok: true,
      status: { state, nextDueAt: nextDueAt.toISOString(), graceEndsAt: graceEndsAt.toISOString() },
    });
  })
);

async function listInvoices(userId, limit) {
  const lim = Number.isFinite(limit) ? Math.max(1, Math.min(200, Number(limit))) : 50;

  const [rows] = await pool.query(
    "SELECT id, created_at, invoice_url, status, amount_cents, description FROM billing_invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [String(userId), lim]
  );

  return rows.map((r) => ({
    id: String(r.id),
    date: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    description: r.description ? String(r.description) : "Subscription",
    amount: Number(r.amount_cents || 0) / 100,
    status: String(r.status || ""),
    invoiceUrl: r.invoice_url ? String(r.invoice_url) : null,
  }));
}

router.get(
  "/billing/summary",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    await ensureBillingProfile(userId);

    const invoices = await listInvoices(userId, Number(req.query?.limit));

    const [rows] = await pool.execute(
      `SELECT
        user_id,
        status,
        billing_interval,
        amount_cents,
        currency,
        storage_limit_gb,
        checkin_frequency,
        addons_json,
        updated_at,
        (SELECT GROUP_CONCAT(DISTINCT provider ORDER BY provider)
         FROM billing_entitlements be
         WHERE be.user_id = billing_profiles.user_id AND be.status = 'active'
           AND (be.current_period_end IS NULL OR be.current_period_end > UTC_TIMESTAMP(3))) AS active_providers
      FROM billing_profiles
      WHERE user_id = ?
      LIMIT 1`,
      [String(userId)]
    );

    const r = rows[0] || null;

    const billing = r
      ? (() => {
          const activeProviders = r.active_providers ? String(r.active_providers).split(",") : [];
          return {
          userId: String(r.user_id),
          // Opening plan management must never make a valid legacy Stripe profile
          // appear cancelled while its entitlement row is being backfilled.
          status: activeProviders.length ? "active" : String(r.status),
          billingInterval: String(r.billing_interval),
          amountCents: Number(r.amount_cents),
          currency: String(r.currency),
          storageLimitGb: Number(r.storage_limit_gb),
          checkInFrequency: String(r.checkin_frequency),
          addons: Array.isArray(r.addons_json) ? r.addons_json : [],
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
          activeProviders,
        }; })()
      : {
          userId: String(userId),
          status: "pending_setup",
          billingInterval: "monthly",
          amountCents: 0,
          currency: "usd",
          storageLimitGb: 5,
          checkInFrequency: "monthly",
          addons: [],
          activeProviders: [],
        };

    return res.json({ ok: true, billing, invoices });
  })
);

async function createBillingPortalUrl(userId, returnUrl) {
  if (!stripe) throw new Error("stripe_not_configured");

  const [rows] = await pool.query(
    "SELECT stripe_customer_id FROM billing_profiles WHERE user_id = ? LIMIT 1",
    [String(userId)]
  );

  const customerId = (rows && rows[0] && rows[0].stripe_customer_id) ? String(rows[0].stripe_customer_id) : "";
  if (!customerId) throw new Error("missing_customer");

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: String(returnUrl || ""),
  });

  const url = session && session.url ? String(session.url) : "";
  if (!url) throw new Error("missing_portal_url");
  return url;
}

router.post(
  "/billing/portal",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    await ensureBillingProfile(userId);

    const returnUrl = `${publicWebBaseUrl}/app/billing`;

    try {
      const url = await createBillingPortalUrl(userId, returnUrl);
      return res.json({ ok: true, url });
    } catch (e) {
      const code = String(e && e.message ? e.message : "server_error");
      return res.status(500).json({ ok: false, error: code });
    }
  })
);


// --- Update existing plan (DB + Stripe subscription update) ---
router.post(
  "/billing/update-plan",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    if (!stripe) return res.status(503).json({ ok: false, error: "billing_unavailable" });

    await ensureBillingProfile(userId);

    const [providerRows] = await pool.query(
      `SELECT provider FROM billing_entitlements
       WHERE user_id = ? AND status = 'active'
         AND (current_period_end IS NULL OR current_period_end > UTC_TIMESTAMP(3))`,
      [String(userId)]
    );
    const activeProviders = new Set((providerRows || []).map((row) => String(row.provider)));
    if (activeProviders.has("apple") && !activeProviders.has("stripe")) {
      return res.status(409).json({ ok: false, error: "subscription_managed_by_apple" });
    }
    if (!activeProviders.has("stripe")) {
      return res.status(409).json({ ok: false, error: "no_active_subscription" });
    }

    const plan = validatePlanInput(req.body);
    if (!plan) return res.status(400).json({ ok: false, error: "invalid_plan" });
    const { storageGb, checkInFrequency, billingInterval, addons } = plan;

    const safeStorageGb = Math.max(5, Math.min(200, Math.round(storageGb / 5) * 5));
    const storagePrice = computeStoragePrice(safeStorageGb);
    const frequencyPrice = computeFrequencyPrice(checkInFrequency);

    const monthlyTotal = storagePrice + frequencyPrice;
    const amountCents = Math.round((billingInterval === "annual" ? monthlyTotal * 10 : monthlyTotal) * 100);

    const [rows] = await pool.query(
      "SELECT stripe_subscription_id FROM billing_profiles WHERE user_id = ? LIMIT 1",
      [String(userId)]
    );
    const subId = rows?.[0]?.stripe_subscription_id ? String(rows[0].stripe_subscription_id) : null;

    if (!subId) return res.status(409).json({ ok: false, error: "missing_subscription" });

    const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
    if (!sub || !["active", "trialing"].includes(String(sub.status || ""))) {
      return res.status(409).json({ ok: false, error: "subscription_not_active" });
    }
    const item = sub?.items?.data?.[0];
    const currentPrice = item?.price;
    if (!item?.id || !currentPrice?.product) {
      return res.status(409).json({ ok: false, error: "stripe_subscription_item_missing" });
    }

    const interval = billingInterval === "annual" ? "year" : "month";
    const currency = String(currentPrice.currency || "usd");
    const dynamicProductId = String(process.env.STRIPE_DYNAMIC_PRODUCT_ID || "");

    // Stripe blocks creating new Prices on inactive Products.
    // If the product was archived/inactivated, reactivate it so we can create the new Price.
    const productId =
      typeof currentPrice.product === "string"
        ? currentPrice.product
        : String(currentPrice.product?.id || "");

    if (!productId) {
      return res.status(500).json({ ok: false, error: "stripe_missing_product" });
    }

    try {
      const prod = await stripe.products.retrieve(productId);
      if (prod && prod.active === false) {
        await stripe.products.update(productId, { active: true });
      }
    } catch (e) {
      // fall through; Stripe will throw a clearer error if this is still invalid
    }

    const newPrice = await stripe.prices.create({
      currency,
      unit_amount: Number(amountCents),
      recurring: { interval },
      product: dynamicProductId || productId,
    });

    await stripe.subscriptions.update(subId, {
      items: [{ id: item.id, price: newPrice.id }],
      proration_behavior: "create_prorations",
      metadata: {
        ...(sub.metadata || {}),
        user_id: String(userId),
        storage_gb: String(safeStorageGb),
        checkin_frequency: String(checkInFrequency),
        billing_interval: String(billingInterval),
      },
    });

    await pool.query(
      `UPDATE billing_profiles
       SET billing_interval = ?, amount_cents = ?, currency = 'usd',
           storage_limit_gb = ?, checkin_frequency = ?, addons_json = ?,
           updated_at = UTC_TIMESTAMP()
       WHERE user_id = ?`,
      [
        String(billingInterval),
        Number(amountCents),
        Number(safeStorageGb),
        String(checkInFrequency),
        JSON.stringify(addons),
        String(userId),
      ]
    );
    await pool.query(
      `UPDATE billing_entitlements
       SET storage_limit_gb = ?, checkin_frequency = ?, billing_interval = ?
       WHERE provider = 'stripe' AND external_subscription_id = ?`,
      [Number(safeStorageGb), String(checkInFrequency), String(billingInterval), subId]
    );
    await refreshAggregateBillingStatus(pool, userId);
    await syncVerificationFromBilling(userId);

    return res.json({ ok: true });
  })
);

router.post(
  "/billing/choose-plan",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    await ensureBillingProfile(userId);

    const invoices = await listInvoices(userId, Number(req.query?.limit));
    const [rows] = await pool.execute(
      `SELECT
        user_id,
        status,
        billing_interval,
        amount_cents,
        currency,
        storage_limit_gb,
        checkin_frequency,
        addons_json,
        updated_at
      FROM billing_profiles
      WHERE user_id = ?
      LIMIT 1`,
      [String(userId)]
    );

    const r = rows[0] || null;
    const billing = r
      ? {
          userId: String(r.user_id),
          status: String(r.status),
          billingInterval: String(r.billing_interval),
          amountCents: Number(r.amount_cents),
          currency: String(r.currency),
          storageLimitGb: Number(r.storage_limit_gb),
          checkInFrequency: String(r.checkin_frequency),
          addons: Array.isArray(r.addons_json) ? r.addons_json : [],
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
        }
      : {
          userId: String(userId),
          status: "pending_setup",
          billingInterval: "monthly",
          amountCents: 0,
          currency: "usd",
          storageLimitGb: 5,
          checkInFrequency: "monthly",
          addons: [],
        };

    return res.status(400).json({ ok: false, error: "billing_changes_manual_for_now", billing, invoices });
  })
);

router.get(
  "/billing/invoices",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const invoices = await listInvoices(userId, Number(req.query?.limit));
    return res.json({ ok: true, invoices });
  })
);

function cents(n) {
  return Math.round(Number(n) * 100);
}

function computeStoragePrice(gb) {
  const tiers = [
    { gb: 5, price: 4.99 },
    { gb: 10, price: 7.99 },
    { gb: 25, price: 12.99 },
    { gb: 50, price: 17.99 },
    { gb: 100, price: 22.99 },
    { gb: 200, price: 29.99 },
  ];

  const x = Number(gb);
  if (!Number.isFinite(x)) return tiers[0].price;
  if (x <= tiers[0].gb) return tiers[0].price;
  if (x >= tiers[tiers.length - 1].gb) return tiers[tiers.length - 1].price;

  for (let i = tiers.length - 2; i >= 0; i--) {
    if (x >= tiers[i].gb) {
      const a = tiers[i];
      const b = tiers[i + 1];
      const ratio = (x - a.gb) / (b.gb - a.gb);
      return a.price + ratio * (b.price - a.price);
    }
  }

  return tiers[0].price;
}

function computeFrequencyPrice(freq) {
  if (freq === "daily") return 2.99;
  if (freq === "weekly") return 1.99;
  return 0.0;
}

function normalizeFrequency(freq) {
  if (freq === "daily" || freq === "weekly" || freq === "monthly") return freq;
  return "monthly";
}

function normalizeInterval(interval) {
  if (interval === "annual" || interval === "monthly") return interval;
  return "monthly";
}

function validatePlanInput(body) {
  const storageGb = Number(body?.storageGb);
  const checkInFrequency = String(body?.checkInFrequency || "");
  const billingInterval = String(body?.billingInterval || "");
  const addons = body?.addons === undefined ? [] : body.addons;
  if (!Number.isInteger(storageGb) || storageGb < 5 || storageGb > 200 || storageGb % 5 !== 0) return null;
  if (!isValidFrequency(checkInFrequency)) return null;
  if (billingInterval !== "monthly" && billingInterval !== "annual") return null;
  if (!Array.isArray(addons) || addons.length !== 0) return null;
  return { storageGb, checkInFrequency, billingInterval, addons: [] };
}

router.post(
  "/billing/quote",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const plan = validatePlanInput(req.body);
    if (!plan) return res.status(400).json({ ok: false, error: "invalid_plan" });
    const { storageGb, checkInFrequency, billingInterval } = plan;

    const safeStorageGb = Math.max(5, Math.min(200, Math.round(storageGb / 5) * 5));
    const storagePrice = computeStoragePrice(safeStorageGb);
    const frequencyPrice = computeFrequencyPrice(checkInFrequency);

    const monthlyTotal = storagePrice + frequencyPrice;
    const amount = billingInterval === "annual" ? monthlyTotal * 10 : monthlyTotal;

    return res.json({
      ok: true,
      storageGb: safeStorageGb,
      checkInFrequency,
      billingInterval,
      monthlyTotal,
      amount,
      amountCents: cents(amount),
    });
  })
);

router.post(
  "/billing/create-checkout-session",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

    await ensureBillingProfile(userId);

    const plan = validatePlanInput(req.body);
    if (!plan) return res.status(400).json({ ok: false, error: "invalid_plan" });
    const { storageGb, checkInFrequency, billingInterval, addons } = plan;

    const [activeRows] = await pool.query(
      `SELECT 1 FROM billing_entitlements WHERE user_id = ? AND status = 'active'
       AND (current_period_end IS NULL OR current_period_end > UTC_TIMESTAMP(3)) LIMIT 1`,
      [String(userId)]
    );
    if (activeRows.length) return res.status(409).json({ ok: false, error: "subscription_already_active" });

    const safeStorageGb = Math.max(5, Math.min(200, Math.round(storageGb / 5) * 5));
    const storagePrice = computeStoragePrice(safeStorageGb);
    const frequencyPrice = computeFrequencyPrice(checkInFrequency);

    const monthlyTotal = storagePrice + frequencyPrice;
    const amount = billingInterval === "annual" ? monthlyTotal * 10 : monthlyTotal;
    const unitAmount = Math.max(50, cents(amount));

    const [urows] = await pool.query("SELECT email FROM users WHERE id = ? LIMIT 1", [String(userId)]);
    const email = urows?.[0]?.email ? String(urows[0].email) : null;

    const [brows] = await pool.query("SELECT stripe_customer_id FROM billing_profiles WHERE user_id = ? LIMIT 1", [
      String(userId),
    ]);
    let customerId = brows?.[0]?.stripe_customer_id ? String(brows[0].stripe_customer_id) : "";

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { user_id: String(userId) },
      });
      customerId = customer.id;

      await pool.query("UPDATE billing_profiles SET stripe_customer_id = ? WHERE user_id = ?", [
        customerId,
        String(userId),
      ]);
    }

    const successUrl = `${publicWebBaseUrl}/app/billing?checkout=success`;
    const cancelUrl = `${publicWebBaseUrl}/app/billing?checkout=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: String(userId),
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `anycircumstances Plan (${safeStorageGb} GB)` },
            unit_amount: unitAmount,
            recurring: { interval: billingInterval === "annual" ? "year" : "month" },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          user_id: String(userId),
          storage_gb: String(safeStorageGb),
          checkin_frequency: checkInFrequency,
          billing_interval: billingInterval,
          addons_json: JSON.stringify(addons),
        },
      },
      metadata: { user_id: String(userId) },
    });

    await pool.query(
      `UPDATE billing_profiles
       SET status = CASE WHEN status = 'active' THEN 'active' ELSE 'pending_setup' END,
           billing_interval = ?,
           amount_cents = ?,
           storage_limit_gb = ?,
           checkin_frequency = ?,
           addons_json = ?,
           stripe_price_snapshot_json = ?
       WHERE user_id = ?`,
      [
        billingInterval,
        unitAmount,
        safeStorageGb,
        checkInFrequency,
        JSON.stringify(addons),
        JSON.stringify({ unitAmount, billingInterval }),
        String(userId),
      ]
    );

    return res.json({ ok: true, url: session.url });
  })
);

router.post(
  "/billing/create-portal-session",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

    const [rows] = await pool.query("SELECT stripe_customer_id FROM billing_profiles WHERE user_id = ? LIMIT 1", [
      String(userId),
    ]);
    const customerId = rows?.[0]?.stripe_customer_id ? String(rows[0].stripe_customer_id) : "";
    if (!customerId) return res.status(400).json({ ok: false, error: "no_customer" });

    const returnUrl = `${publicWebBaseUrl}/app/billing`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return res.json({ ok: true, url: portal.url });
  })
);

router.get(
  "/billing/status",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const [rows] = await pool.query(
      `SELECT bp.status, bp.current_period_end, bp.stripe_subscription_id,
        (SELECT GROUP_CONCAT(DISTINCT provider ORDER BY provider)
         FROM billing_entitlements be
         WHERE be.user_id = bp.user_id AND be.status = 'active'
           AND (be.current_period_end IS NULL OR be.current_period_end > UTC_TIMESTAMP(3))) AS active_providers
       FROM billing_profiles bp WHERE bp.user_id = ? LIMIT 1`,
      [String(userId)]
    );

    const row = rows?.[0] || null;
    return res.json({
      ok: true,
      status: row?.active_providers ? "active" : (row?.status || "none"),
      currentPeriodEnd: row?.current_period_end || null,
      stripeSubscriptionId: row?.stripe_subscription_id || null,
      activeProviders: row?.active_providers ? String(row.active_providers).split(",") : [],
    });
  })
);

router.get(
  "/billing/apple/account-token",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    await ensureBillingProfile(userId);
    const appAccountToken = await ensureAppleAccountToken(pool, userId);
    return res.json({ ok: true, appAccountToken });
  })
);

router.post(
  "/billing/apple/sync",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const signedTransactionInfo = String(req.body?.signedTransactionInfo || "");
    if (!signedTransactionInfo) return res.status(400).json({ ok: false, error: "missing_signed_transaction" });
    const expectedToken = await ensureAppleAccountToken(pool, userId);
    const transaction = await verifyTransaction(signedTransactionInfo, req.body?.environment);
    const transactionToken = String(transaction.appAccountToken || "").toLowerCase();
    const originalTransactionId = String(transaction.originalTransactionId || "");
    const alreadyOwnedElsewhere = await transactionBelongsToAnotherUser(pool, userId, originalTransactionId);
    if (alreadyOwnedElsewhere || !transactionToken || transactionToken !== expectedToken.toLowerCase()) {
      return res.status(403).json({ ok: false, error: "apple_account_mismatch" });
    }
    const entitlement = await upsertAppleEntitlement(
      pool,
      userId,
      transaction,
      "SUBSCRIBED",
      transaction.environment || req.body?.environment
    );
    return res.json({ ok: true, entitlement });
  })
);

router.post(
  "/unlock-vault",
  asyncHandler(async (req, res) => {
    const userId = await requireActiveSubscription(req, res);
    if (!userId) return;

    const pin = String(req.body?.pin || "").trim();
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ ok: false, error: "invalid_pin" });

    const [urows] = await pool.query("SELECT pin_hash, panic_pin_hash, session_version FROM users WHERE id = ? LIMIT 1", [String(userId)]);
    const pinHash = urows?.[0]?.pin_hash ? String(urows[0].pin_hash) : "";
    const panicHash = urows?.[0]?.panic_pin_hash ? String(urows[0].panic_pin_hash) : "";
    if (!pinHash) return res.status(400).json({ ok: false, error: "no_pin_set" });

    if (panicHash && await bcrypt.compare(pin, panicHash)) {
      return res.status(401).json({ ok: false, error: "invalid_pin" });
    }

    const ok = await bcrypt.compare(pin, pinHash);
    if (!ok) return res.status(401).json({ ok: false, error: "invalid_pin" });

    setVaultAuthorizationCookie(res, userId, urows?.[0]?.session_version || req.sessionVersion || 1);
    return res.json({ ok: true, expiresInSeconds: 600 });
  })
);

async function dispatchEmergencyForUser(conn, userId, req) {
  const transporter = getMailer();
  const from = emailSender();
  if (!transporter) {
    return { ok: false, error: "mailer_not_configured", emailedContacts: 0, linksCreated: 0 };
  }

  const publicBase = String(process.env.PUBLIC_APP_BASE_URL || "https://anycircumstances.com").replace(/\/+$/, "");

  let emailedContacts = 0;
  let linksCreated = 0;

  await conn.query("INSERT INTO verification_panic_dispatches (user_id, ip, user_agent) VALUES (?, ?, ?)", [
    String(userId),
    String(req.ip || "").slice(0, 64),
    String(req.headers["user-agent"] || "").slice(0, 255),
  ]);

  const [urows] = await conn.query("SELECT email FROM users WHERE id = ? LIMIT 1", [String(userId)]);
  const ownerEmail = urows?.[0]?.email ? String(urows[0].email) : "";

  const [contacts] = await conn.query(
    "SELECT id, email, name, verified_at, public_key FROM emergency_contacts WHERE user_id = ? AND verified_at IS NOT NULL",
    [String(userId)]
  );

  if (!contacts.length) {
    return { ok: true, emailedContacts: 0, linksCreated: 0, note: "no_contacts" };
  }

  const [assignments] = await conn.query(
    `
      SELECT a.contact_id, a.file_id
      FROM emergency_contact_file_assignments a
      JOIN emergency_contacts c ON c.id = a.contact_id
      JOIN files f ON f.id = a.file_id
      WHERE c.user_id = ? AND f.user_id = c.user_id
    `,
    [String(userId)]
  );

  const filesByContact = new Map();
  for (const a of assignments) {
    const cid = Number(a.contact_id);
    const arr = filesByContact.get(cid) || [];
    arr.push(String(a.file_id));
    filesByContact.set(cid, arr);
  }

  for (const c of contacts) {
    const contactId = Number(c.id);
    const email = String(c.email);
    const name = String(c.name || "");
    const list = filesByContact.get(contactId) || [];
    if (!list.length) continue;

    const missingSetup = !c.public_key;

    const links = [];
    for (const fileId of list) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = sha256Hex(token);

      await conn.query(
        "INSERT INTO contact_file_share_tokens (contact_id, file_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
        [contactId, fileId, tokenHash, shareExpiresAt()]
      );
links.push(publicBase + "/share#token=" + encodeURIComponent(token));
      linksCreated += 1;
    }

    const subject = "AnyCircumstances: Emergency access link (manual trigger)";
    const rendered = renderEmergencyEmail({ name, ownerEmail, links, missingSetup });

await transporter.sendMail({
  from,
  to: email,
  subject,
  text: rendered.text,
  html: rendered.html,
});
    emailedContacts += 1;
  }

  return { ok: true, emailedContacts, linksCreated };
}


router.post(
  "/trigger-emergency",
  asyncHandler(async (req, res) => {
    const userId = await requireActiveSubscription(req, res);
    if (!userId) return;

    const pin = String(req.body?.pin || "");
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ ok: false, error: "invalid_pin" });

    const [urows] = await pool.query("SELECT email, panic_pin_hash FROM users WHERE id = ? LIMIT 1", [String(userId)]);
    const panicHash = urows?.[0]?.panic_pin_hash ? String(urows[0].panic_pin_hash) : "";
    const ownerEmail = urows?.[0]?.email ? String(urows[0].email) : "";

    if (!panicHash) return res.status(400).json({ ok: false, error: "panic_pin_not_set" });

    const ok = await bcrypt.compare(pin, panicHash);
    if (!ok) return res.status(401).json({ ok: false, error: "invalid_pin" });
    if (!consumeEmergencyDispatchQuota(userId, res)) return;

    const transporter = getMailer();
    const from = emailSender();
    if (!transporter) return res.status(500).json({ ok: false, error: "mailer_not_configured" });

    const publicBase = String(process.env.PUBLIC_APP_BASE_URL || "https://anycircumstances.com").replace(/\/+$/, "");

    const conn = await pool.getConnection();
    let emailedContacts = 0;
    let linksCreated = 0;

    try {
      await conn.beginTransaction();

      await conn.query("INSERT INTO verification_panic_dispatches (user_id, ip, user_agent) VALUES (?, ?, ?)", [
        String(userId),
        String(req.ip || "").slice(0, 64),
        String(req.headers["user-agent"] || "").slice(0, 255),
      ]);

      const [contacts] = await conn.query(
        "SELECT id, email, name, verified_at, public_key FROM emergency_contacts WHERE user_id = ? AND verified_at IS NOT NULL",
        [String(userId)]
      );

      if (!contacts.length) {
        await conn.commit();
        return res.json({ ok: true, emailedContacts: 0, linksCreated: 0, note: "no_contacts" });
      }

      const [assignments] = await conn.query(
        `
        SELECT a.contact_id, a.file_id
        FROM emergency_contact_file_assignments a
        JOIN emergency_contacts c ON c.id = a.contact_id
        JOIN files f ON f.id = a.file_id
        WHERE c.user_id = ? AND f.user_id = c.user_id
        `,
        [String(userId)]
      );

      const filesByContact = new Map();
      for (const a of assignments) {
        const cid = Number(a.contact_id);
        const arr = filesByContact.get(cid) || [];
        arr.push(String(a.file_id));
        filesByContact.set(cid, arr);
      }

      for (const c of contacts) {
        const contactId = Number(c.id);
        const email = String(c.email);
        const name = String(c.name || "");
        const list = filesByContact.get(contactId) || [];
        if (!list.length) continue;

        const missingSetup = !c.public_key;

        const links = [];
        for (const fileId of list) {
          const token = crypto.randomBytes(32).toString("hex");
          const tokenHash = sha256Hex(token);

          await conn.query(
        "INSERT INTO contact_file_share_tokens (contact_id, file_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
        [contactId, fileId, tokenHash, shareExpiresAt()]
      );
links.push(publicBase + "/share#token=" + encodeURIComponent(token));
          linksCreated += 1;
        }

        const subject = "AnyCircumstances: Emergency access link (manual trigger)";
    const rendered = renderEmergencyEmail({ name, ownerEmail, links, missingSetup });

await transporter.sendMail({
  from,
  to: email,
  subject,
  text: rendered.text,
  html: rendered.html,
});
        emailedContacts += 1;
      }

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("trigger-emergency", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }

    return res.json({ ok: true, emailedContacts, linksCreated });
  })
);

async function createEmergencyContactVerificationCode(conn, contactId) {
  await conn.query("DELETE FROM emergency_contact_verification_tokens WHERE contact_id = ? AND used_at IS NULL", [contactId]);

  const expiresAt = addDays(nowUtc(), 2);

  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(48).toString("base64url");
    const tokenHash = sha256Hex(code);
    try {
      await conn.query(
        "INSERT INTO emergency_contact_verification_tokens (contact_id, token_hash, expires_at) VALUES (?, ?, ?)",
        [contactId, tokenHash, expiresAt]
      );
      return code;
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) continue;
      throw e;
    }
  }

  throw new Error("Failed to generate unique emergency contact verification code");
}

async function getEmergencyContactContext(contactId) {
  if (!contactId) return null;
  const [rows] = await pool.query(
    "SELECT ec.name AS contact_name, u.email AS owner_email FROM emergency_contacts ec JOIN users u ON u.id = ec.user_id WHERE ec.id = ? LIMIT 1",
    [contactId]
  );
  return rows[0] || null;
}

function renderEmergencyContactVerifyHtml(opts) {
  const ok = !!opts?.ok;
  const reason = String(opts?.reason || "");
  const ownerEmail = String(opts?.ownerEmail || "");
  const contactName = String(opts?.contactName || "");

  let finalTitle = "Confirmed";
  let finalText = "You’re verified as an emergency contact.";
  let finalSub = ownerEmail ? `For ${ownerEmail}` : "";

  if (!ok) {
    finalTitle = "Could not confirm";
    finalSub = "";
    if (reason === "expired") finalText = "This confirmation link expired. Ask the account owner to resend the invite.";
    else if (reason === "already_used") finalText = "This link was already used. You’re probably already confirmed.";
    else finalText = "This confirmation link is invalid. Ask the account owner to resend the invite.";
  }

  const safeFinalTitle = escapeHtml(finalTitle);
  const safeFinalText = escapeHtml(finalText);
  const safeFinalSub = escapeHtml(finalSub);
  const safeContact = contactName ? escapeHtml(contactName) : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>anycircumstances</title>
  <style>
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#0b0b0f;color:#fff}
    .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:100%;max-width:520px;background:#12121a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:22px}
    .brand{display:flex;align-items:center;gap:10px;margin-bottom:16px;color:rgba(255,255,255,.9)}
    .dot{width:10px;height:10px;border-radius:999px;background:#7c3aed}
    .title{font-size:20px;font-weight:700;margin:0 0 6px 0}
    .sub{margin:0 0 16px 0;color:rgba(255,255,255,.72)}
    .row{display:flex;align-items:center;gap:12px;margin-top:18px}
    .check{width:22px;height:22px;border-radius:999px;background:rgba(34,197,94,.18);display:flex;align-items:center;justify-content:center}
    .check svg{width:14px;height:14px}
    .btn{display:inline-block;margin-top:16px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.08);color:#fff;text-decoration:none}
    .muted{color:rgba(255,255,255,.6);font-size:13px;margin-top:12px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="brand"><span class="dot"></span><span>anycircumstances</span></div>
      <p class="title">${safeFinalTitle}</p>
      <p class="sub">${safeContact ? `For ${safeContact}` : safeFinalSub}</p>
      <div>
        <div class="row">
          ${
            ok
              ? `<div class="check"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
              : `<div class="check" style="background:rgba(239,68,68,.18)"><svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/></svg></div>`
          }
          <div>
            <div style="font-weight:700">${safeFinalTitle}</div>
            <div style="color:rgba(255,255,255,.72);font-size:13px">${safeFinalSub}</div>
          </div>
        </div>
        <p class="muted">${safeFinalText}</p>
        <a class="btn" href="${escapeHtml(publicWebBaseUrl)}">Go to site</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function consumeEmergencyContactVerificationByToken(conn, code) {
  const tokenHash = sha256Hex(code);

  const [rows] = await conn.query(
    "SELECT id, contact_id, expires_at, used_at FROM emergency_contact_verification_tokens WHERE token_hash = ? LIMIT 1 FOR UPDATE",
    [tokenHash]
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid_code", contactId: null };

  const contactId = row.contact_id;

  if (row.used_at) return { ok: false, reason: "already_used", contactId };
  if (new Date(row.expires_at).getTime() < nowUtc().getTime()) return { ok: false, reason: "expired", contactId };

  await conn.query("UPDATE emergency_contact_verification_tokens SET used_at = NOW() WHERE id = ?", [row.id]);
  await conn.query("UPDATE emergency_contacts SET verified_at = NOW() WHERE id = ? AND verified_at IS NULL", [contactId]);

  return { ok: true, contactId };
}

async function sendEmergencyContactInviteEmail(toEmail, contactName, ownerEmail, verifyUrl) {
  const transporter = getMailer();
  const from = emailSender();

  if (!transporter) {
    console.error("[MAILER] Missing SMTP env vars; skipping emergency contact invite email.");
    return { ok: false, skipped: true };
  }

  const safeOwner = String(ownerEmail || "").trim() || "someone you know";
  const safeName = String(contactName || "").trim();

  const subject = `AnyCircumstances: Confirm you’re an emergency contact for ${safeOwner}`;

  const introLine = safeName ? `Hi ${safeName},` : "Hi,";
  const rendered = renderAnyCircumstancesEmail({
    title: "Confirm emergency contact",
    preview: "Someone you know has invited you to be an emergency contact.",
    bodyHtml:
      `<p style="margin:0 0 12px 0">${escapeHtml(introLine)}</p>` +
      `<p style="margin:0 0 12px 0"><b>${escapeHtml(safeOwner)}</b> added you as an emergency contact in <b>AnyCircumstances</b>.</p>` +
      `<h2 style="margin:16px 0 8px;font-size:18px;color:#d6e6df">What this means</h2>` +
      `<ul style="margin:0 0 16px 18px;padding:0">` +
      `<li>You are not taking on any responsibility for them.</li>` +
      `<li>If they miss scheduled check-ins and the grace period expires, you may receive a secure email with links to files they assigned to you.</li>` +
      `<li>You do not need an account.</li>` +
      `</ul>` +
      `<p style="margin:0">Confirm using the button below.</p>`,
    ctaText: "Confirm emergency contact",
    ctaUrl: verifyUrl,
    footerNote: "If you weren’t expecting this, you can ignore this email."
  });
  const text = rendered.text;
  const html = rendered.html;
  await transporter.sendMail({ from, to: toEmail, subject, text, html });
  return { ok: true };
}

function toContactDto(row, assignedFiles) {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    relationship: row.relationship || "",
    verified: !!row.verified_at,
    assignedFiles: assignedFiles || [],
    addedAt: new Date(row.created_at).toISOString(),
  };
}

function normalizeAssignedFileIds(input) {
  if (!Array.isArray(input) || input.length > 100) return null;
  const ids = Array.from(new Set(input.map((value) => String(value || "").trim())));
  if (ids.some((id) => !id || id.length > 512)) return null;
  return ids;
}

async function filesBelongToUser(conn, userId, fileIds) {
  if (!fileIds.length) return true;
  const placeholders = fileIds.map(() => "?").join(",");
  const [rows] = await conn.query(
    `SELECT id FROM files WHERE user_id = ? AND id IN (${placeholders})`,
    [String(userId), ...fileIds]
  );
  return rows.length === fileIds.length;
}

router.get(
  "/emergency-contacts",
  asyncHandler(async (req, res) => {
    const userId = await requireActiveSubscription(req, res);
    if (!userId) return;

    const [contacts] = await pool.query(
      "SELECT id, name, email, relationship, verified_at, created_at FROM emergency_contacts WHERE user_id = ? ORDER BY created_at DESC",
      [String(userId)]
    );

	const ids = contacts.map((c) => Number(c.id)).filter((n) => Number.isFinite(n) && n > 0);	
    const map = new Map();
    for (const c of contacts) map.set(String(c.id), []);

if (ids.length > 0) {
  const placeholders = ids.map(() => "?").join(",");
  const [assignments] = await pool.query(
    `SELECT a.contact_id, a.file_id
     FROM emergency_contact_file_assignments a
     JOIN emergency_contacts c ON c.id = a.contact_id
     JOIN files f ON f.id = a.file_id AND f.user_id = c.user_id
     WHERE a.contact_id IN (${placeholders})`,
    ids
  );      for (const a of assignments) {
        const key = String(a.contact_id);
        const arr = map.get(key) || [];
        arr.push(String(a.file_id));
        map.set(key, arr);
      }
    }

    return res.json({ ok: true, contacts: contacts.map((c) => toContactDto(c, map.get(String(c.id)) || [])) });
  })
);

router.post(
  "/emergency-contacts",
  asyncHandler(async (req, res) => {
    const userId = await requireActiveSubscription(req, res);
    if (!userId) return;
    if (!(await verifyCurrentPassword(userId, req.body?.password))) {
      return res.status(401).json({ ok: false, error: "reauthentication_failed" });
    }

    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const relationship = String(req.body?.relationship || "").trim();
    const fileIds = normalizeAssignedFileIds(req.body?.assignedFiles || []);

    const notifyContact = req.body?.notifyContact !== false;

    if (!name || name.length > 120) return res.status(400).json({ ok: false, error: "invalid_name" });
    if (!validateEmail(email) || email.length > 254) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (relationship.length > 120) return res.status(400).json({ ok: false, error: "invalid_relationship" });
    if (!fileIds) return res.status(400).json({ ok: false, error: "invalid_file_ids" });

    const conn = await pool.getConnection();
    let contactId = 0;
    let verifyCode = "";
    let verifyUrl = "";
    let ownerEmail = "";

    try {
      await conn.beginTransaction();

      if (!(await filesBelongToUser(conn, userId, fileIds))) {
        await conn.rollback();
        return res.status(403).json({ ok: false, error: "file_not_owned" });
      }

      const [urows] = await conn.query("SELECT email FROM users WHERE id = ? LIMIT 1", [String(userId)]);
      ownerEmail = urows?.[0]?.email ? String(urows[0].email) : "your account";

      const [result] = await conn.query("INSERT INTO emergency_contacts (user_id, name, email, relationship) VALUES (?, ?, ?, ?)", [
        String(userId),
        name,
        email,
        relationship || null,
      ]);

      contactId = result.insertId;

      await conn.query("DELETE FROM emergency_contact_file_assignments WHERE contact_id = ?", [contactId]);
      if (fileIds.length > 0) {
        const values = fileIds.map((fid) => [contactId, String(fid)]);
        await conn.query("INSERT INTO emergency_contact_file_assignments (contact_id, file_id) VALUES ?", [values]);
      }

      verifyCode = await createEmergencyContactVerificationCode(conn, contactId);
      verifyUrl = `${publicApiBaseUrl}/auth/emergency-contacts/verify?token=${encodeURIComponent(verifyCode)}`;

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
        return res.status(409).json({ ok: false, error: "contact_exists" });
      }
      logError("emergency-contacts:create", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }

    let emailSent = false;
    if (notifyContact) {
      try {
        const out = await sendEmergencyContactInviteEmail(email, name, ownerEmail, verifyUrl);
        emailSent = !!out?.ok;
      } catch (e) {
        logError("emergency-contacts:send-invite", e);
        emailSent = false;
      }
    }

    return res.status(201).json({
      ok: true,
      contact: {
        id: String(contactId),
        name,
        email,
        relationship: relationship || "",
        verified: false,
        assignedFiles: fileIds.map((x) => String(x)),
        addedAt: new Date().toISOString(),
      },
      email_sent: emailSent,
    });
  })
);

router.patch(
  "/emergency-contacts/:id",
  asyncHandler(async (req, res) => {
    const userId = await requireActiveSubscription(req, res);
    if (!userId) return;
    if (!(await verifyCurrentPassword(userId, req.body?.password))) {
      return res.status(401).json({ ok: false, error: "reauthentication_failed" });
    }

    const contactId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(contactId)) return res.status(400).json({ ok: false, error: "invalid_contact_id" });

    const name = String(req.body?.name || "").trim();
    const emailRaw = req.body?.email;
    const relationship = String(req.body?.relationship || "").trim();

    if (!name || name.length > 120) return res.status(400).json({ ok: false, error: "invalid_name" });
    const email = emailRaw !== undefined ? normalizeEmail(emailRaw) : null;
    if (email !== null && (!validateEmail(email) || email.length > 254)) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (relationship.length > 120) return res.status(400).json({ ok: false, error: "invalid_relationship" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        "SELECT id, email FROM emergency_contacts WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE",
        [contactId, String(userId)]
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ ok: false, error: "not_found" });
      }

      const emailChanged = email !== null && email !== normalizeEmail(rows[0].email);
      if (emailChanged) {
        await conn.query(
          `UPDATE emergency_contacts
           SET name = ?, email = ?, relationship = ?, verified_at = NULL, public_key = NULL
           WHERE id = ? AND user_id = ? LIMIT 1`,
          [name, email, relationship || null, contactId, String(userId)]
        );
        await conn.query("DELETE FROM emergency_contact_verification_tokens WHERE contact_id = ?", [contactId]);
        await conn.query("DELETE FROM contact_file_share_tokens WHERE contact_id = ?", [contactId]);
        await conn.query(
          "DELETE FROM file_key_envelopes WHERE recipient_type = 'contact' AND recipient_id = ?",
          [contactId]
        );
      } else {
        await conn.query(
          `UPDATE emergency_contacts SET name = ?, email = COALESCE(?, email), relationship = ?
           WHERE id = ? AND user_id = ? LIMIT 1`,
          [name, email, relationship || null, contactId, String(userId)]
        );
      }
      await conn.commit();
      return res.json({ ok: true });
    } catch (e) {
      try { await conn.rollback(); } catch {}
      if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
        return res.status(409).json({ ok: false, error: "contact_exists" });
      }
      logError("emergency-contacts:edit", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }
  })
);

router.delete(
  "/emergency-contacts/:id",
  asyncHandler(async (req, res) => {
    const userId = await requireActiveSubscription(req, res);
    if (!userId) return;
    if (!(await verifyCurrentPassword(userId, req.body?.password))) {
      return res.status(401).json({ ok: false, error: "reauthentication_failed" });
    }

    const contactId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(contactId)) return res.status(400).json({ ok: false, error: "invalid_contact_id" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query("SELECT id FROM emergency_contacts WHERE id = ? AND user_id = ? LIMIT 1", [
        contactId,
        String(userId),
      ]);
      if (!rows[0]) {
        await conn.rollback();
        return res.status(404).json({ ok: false, error: "not_found" });
      }

      await conn.query("DELETE FROM contact_file_share_tokens WHERE contact_id = ?", [contactId]);
      await conn.query(
        "DELETE FROM file_key_envelopes WHERE recipient_type = 'contact' AND recipient_id = ?",
        [contactId]
      );
      await conn.query("DELETE FROM emergency_contact_file_assignments WHERE contact_id = ?", [contactId]);
      await conn.query("DELETE FROM emergency_contact_verification_tokens WHERE contact_id = ?", [contactId]);
      await conn.query("DELETE FROM emergency_contacts WHERE id = ? AND user_id = ? LIMIT 1", [contactId, String(userId)]);

      await conn.commit();
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("emergency-contacts:delete", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }
  })
);

router.put(
  "/emergency-contacts/:id/files",
  asyncHandler(async (req, res) => {
    const userId = await requireActiveSubscription(req, res);
    if (!userId) return;
    if (!(await verifyCurrentPassword(userId, req.body?.password))) {
      return res.status(401).json({ ok: false, error: "reauthentication_failed" });
    }

    const contactId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(contactId)) return res.status(400).json({ ok: false, error: "invalid_contact_id" });

    const fileIds = normalizeAssignedFileIds(req.body?.fileIds || []);
    if (!fileIds) return res.status(400).json({ ok: false, error: "invalid_file_ids" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query("SELECT id FROM emergency_contacts WHERE id = ? AND user_id = ? LIMIT 1", [
        contactId,
        String(userId),
      ]);
      if (!rows[0]) {
        await conn.rollback();
        return res.status(404).json({ ok: false, error: "not_found" });
      }

      if (!(await filesBelongToUser(conn, userId, fileIds))) {
        await conn.rollback();
        return res.status(403).json({ ok: false, error: "file_not_owned" });
      }

      // Assignment changes revoke every outstanding bearer link. New links are
      // issued only by a later, authorized dispatch/share action.
      await conn.query("DELETE FROM contact_file_share_tokens WHERE contact_id = ?", [contactId]);
      await conn.query("DELETE FROM emergency_contact_file_assignments WHERE contact_id = ?", [contactId]);

      if (fileIds.length > 0) {
        const values = fileIds.map((fid) => [contactId, String(fid)]);
        await conn.query("INSERT INTO emergency_contact_file_assignments (contact_id, file_id) VALUES ?", [values]);
      }

      await conn.commit();
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("emergency-contacts:files", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }
  })
);

router.post(
  "/emergency-contacts/:id/resend",
  asyncHandler(async (req, res) => {
    const userId = await requireActiveSubscription(req, res);
    if (!userId) return;

    const contactId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(contactId)) return res.status(400).json({ ok: false, error: "invalid_contact_id" });

    const conn = await pool.getConnection();
    let contactEmail = "";
    let ownerEmail = "";
    let verifyCode = "";
    let verifyUrl = "";

    try {
      await conn.beginTransaction();

      const [rows] = await conn.query("SELECT email, verified_at FROM emergency_contacts WHERE id = ? AND user_id = ? LIMIT 1", [
        contactId,
        String(userId),
      ]);
      if (!rows[0]) {
        await conn.rollback();
        return res.status(404).json({ ok: false, error: "not_found" });
      }

      if (rows[0].verified_at) {
        await conn.commit();
        return res.json({ ok: true, email_sent: true });
      }

      contactEmail = String(rows[0].email);

      const [urows] = await conn.query("SELECT email FROM users WHERE id = ? LIMIT 1", [String(userId)]);
      ownerEmail = urows?.[0]?.email ? String(urows[0].email) : "your account";

      verifyCode = await createEmergencyContactVerificationCode(conn, contactId);
      verifyUrl = `${publicApiBaseUrl}/auth/emergency-contacts/verify?token=${encodeURIComponent(verifyCode)}`;

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("emergency-contacts:resend", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }

    let emailSent = false;
    try {
      const out = await sendEmergencyContactInviteEmail(contactEmail, "", ownerEmail, verifyUrl);
      emailSent = !!out?.ok;
    } catch (e) {
      logError("emergency-contacts:resend-email", e);
      emailSent = false;
    }

    return res.json({ ok: true, email_sent: emailSent });
  })
);

router.get(
  "/emergency-contacts/verify",
  asyncHandler(async (req, res) => {
    const token = String(req.query?.token || "");
    const accept = String(req.headers?.accept || "");
    const wantsHtml = accept.includes("text/html");

    if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
      if (wantsHtml) {
        const html = renderEmergencyContactVerifyHtml({ ok: false, reason: "invalid_code" });
        return res.status(400).set("Content-Type", "text/html; charset=utf-8").send(html);
      }
      return res.status(400).json({ ok: false, error: "invalid_code" });
    }

    const conn = await pool.getConnection();
    let out = null;

    try {
      await conn.beginTransaction();

      out = await consumeEmergencyContactVerificationByToken(conn, token);
      if (!out.ok) {
        await conn.rollback();
      } else {
        await conn.commit();
      }
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("emergency-contacts:verify", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    } finally {
      conn.release();
    }

    if (!out.ok) {
      if (wantsHtml) {
        const ctx = await getEmergencyContactContext(out.contactId);
        const html = renderEmergencyContactVerifyHtml({
          ok: false,
          reason: out.reason,
          ownerEmail: ctx?.owner_email || "",
          contactName: ctx?.contact_name || "",
        });
        return res.status(400).set("Content-Type", "text/html; charset=utf-8").send(html);
      }
      return res.status(400).json({ ok: false, error: out.reason });
    }

    if (wantsHtml) {
      const ctx = await getEmergencyContactContext(out.contactId);
      const html = renderEmergencyContactVerifyHtml({
        ok: true,
        ownerEmail: ctx?.owner_email || "",
        contactName: ctx?.contact_name || "",
      });
      return res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    }

    return res.json({ ok: true });
  })
);
router.post(
  "/device-token",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const token = String(req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ ok: false, error: "missing_token" });
    }

    if (!/^[0-9a-fA-F]{64,255}$/.test(token)) {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    const apnsEnv = currentApnsEnv();

    const [existingRows] = await pool.query(
      "SELECT user_id FROM user_device_tokens WHERE token = ? LIMIT 1",
      [token.toLowerCase()]
    );
    if (existingRows?.[0]?.user_id && String(existingRows[0].user_id) !== String(userId)) {
      return res.status(409).json({ ok: false, error: "device_token_already_registered" });
    }
    const [countRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM user_device_tokens WHERE user_id = ? AND invalidated_at IS NULL",
      [String(userId)]
    );
    if (!existingRows.length && Number(countRows?.[0]?.total || 0) >= 10) {
      return res.status(429).json({ ok: false, error: "device_limit_reached" });
    }

    await pool.query(
      `
      INSERT INTO user_device_tokens (user_id, token, platform, apns_env, invalidated_at)
      VALUES (?, ?, 'ios', ?, NULL)
      ON DUPLICATE KEY UPDATE
        apns_env = VALUES(apns_env),
        invalidated_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      `,
      [String(userId), token.toLowerCase(), apnsEnv]
    );

    const [ownerRows] = await pool.query("SELECT user_id FROM user_device_tokens WHERE token = ? LIMIT 1", [
      token.toLowerCase(),
    ]);
    if (!ownerRows?.[0]?.user_id || String(ownerRows[0].user_id) !== String(userId)) {
      return res.status(409).json({ ok: false, error: "device_token_already_registered" });
    }

    return res.json({ ok: true });
  })
);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const user = req.authUser || await getUserById(userId);
    return res.json({ ok: true, role: "user", userId, user: { id: String(user.id), email: user.email } });
  })
);

router.post(
  "/account/cancel-subscription",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    if (String(req.body?.confirmation || "") !== "DELETE MY FILES") {
      return res.status(400).json({ ok: false, error: "confirmation_required" });
    }
    if (!(await verifyCurrentPassword(userId, req.body?.password))) {
      return res.status(401).json({ ok: false, error: "reauthentication_failed" });
    }
    const [rows] = await pool.query(
      `SELECT bp.stripe_subscription_id,
        EXISTS(SELECT 1 FROM billing_entitlements be WHERE be.user_id = bp.user_id AND be.provider = 'apple' AND be.status = 'active') AS has_apple
       FROM billing_profiles bp WHERE bp.user_id = ? LIMIT 1`,
      [String(userId)]
    );
    const profile = rows?.[0] || {};
    const stripeSubscriptionId = String(profile.stripe_subscription_id || "");
    if (stripeSubscriptionId && stripe) {
      await stripe.subscriptions.cancel(stripeSubscriptionId);
      await pool.query("UPDATE billing_entitlements SET status = 'inactive' WHERE provider = 'stripe' AND external_subscription_id = ?", [stripeSubscriptionId]);
    }
    const purge = await purgeVaultFiles(pool, userId);
    await refreshAggregateBillingStatus(pool, userId);
    return res.json({
      ok: true,
      ...purge,
      requiresAppleAction: Boolean(profile.has_apple),
      appleManageUrl: profile.has_apple ? "https://apps.apple.com/account/subscriptions" : null,
    });
  })
);

router.delete(
  "/account",
  asyncHandler(async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    if (String(req.body?.confirmation || "") !== "DELETE MY ACCOUNT") {
      return res.status(400).json({ ok: false, error: "confirmation_required" });
    }
    if (!(await verifyCurrentPassword(userId, req.body?.password))) {
      return res.status(401).json({ ok: false, error: "reauthentication_failed" });
    }
    const [rows] = await pool.query("SELECT stripe_subscription_id FROM billing_profiles WHERE user_id = ? LIMIT 1", [String(userId)]);
    const stripeSubscriptionId = String(rows?.[0]?.stripe_subscription_id || "");
    if (stripeSubscriptionId && stripe) await stripe.subscriptions.cancel(stripeSubscriptionId);
    const purge = await purgeVaultFiles(pool, userId);
    await deleteUserRecords(pool, userId);
    clearAuthCookies(res);
    return res.json({ ok: true, ...purge });
  })
);

async function stripeWebhookHandler(req, res) {
  let recordedEventId = "";
  try {
    if (!stripe) return res.status(500).send("stripe_not_configured");

    const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
    if (!secret) return res.status(500).send("missing_webhook_secret");

    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch {
      return res.status(400).send("bad_signature");
    }

    const eventId = String(event.id || "");
    if (eventId) {
      try {
        await pool.query("INSERT INTO stripe_events (event_id) VALUES (?)", [eventId]);
        recordedEventId = eventId;
      } catch (error) {
        if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) {
          return res.status(200).json({ ok: true, duplicate: true });
        }
        throw error;
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const subscriptionId = session?.subscription ? String(session.subscription) : "";
      let userId = session?.client_reference_id ? String(session.client_reference_id) : "";

      if (!userId && subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        userId = sub?.metadata?.user_id ? String(sub.metadata.user_id) : "";
      }

      if (userId && subscriptionId) {
        await pool.query("UPDATE billing_profiles SET stripe_subscription_id = ?, status = 'active' WHERE user_id = ?", [
          subscriptionId,
          String(userId),
        ]);
        await pool.query(
          `INSERT INTO billing_entitlements
             (user_id, provider, external_subscription_id, status, storage_limit_gb,
              checkin_frequency, billing_interval)
           SELECT user_id, 'stripe', ?, 'active', storage_limit_gb, checkin_frequency, billing_interval
           FROM billing_profiles WHERE user_id = ?
           ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), status = 'active',
             storage_limit_gb = VALUES(storage_limit_gb),
             checkin_frequency = VALUES(checkin_frequency),
             billing_interval = VALUES(billing_interval)`,
          [subscriptionId, String(userId)]
        );
        await refreshAggregateBillingStatus(pool, userId);
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      let userId = sub?.metadata?.user_id ? String(sub.metadata.user_id) : "";
      if (!userId && sub?.id) {
        const [ownerRows] = await pool.query(
          "SELECT user_id FROM billing_profiles WHERE stripe_subscription_id = ? LIMIT 1",
          [String(sub.id)]
        );
        userId = ownerRows?.[0]?.user_id ? String(ownerRows[0].user_id) : "";
      }
      const status = String(sub.status || "");

      let mapped = "past_due";
      if (status === "active" || status === "trialing") mapped = "active";
      if (status === "past_due" || status === "unpaid") mapped = "past_due";
      if (status === "canceled") mapped = "paused";

      const periodEnd = sub?.current_period_end ? new Date(Number(sub.current_period_end) * 1000) : null;

      if (userId) {
        await pool.query("UPDATE billing_profiles SET status = ?, current_period_end = ? WHERE user_id = ?", [
          mapped,
          periodEnd,
          String(userId),
        ]);
        await pool.query(
          `INSERT INTO billing_entitlements
             (user_id, provider, external_subscription_id, status, current_period_end)
           VALUES (?, 'stripe', ?, ?, ?)
           ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), status = VALUES(status),
             current_period_end = VALUES(current_period_end)`,
          [String(userId), String(sub.id), mapped === "active" ? "active" : "inactive", periodEnd]
        );
        await refreshAggregateBillingStatus(pool, userId);
      }
    }

    if (event.type === "invoice.paid") {
      const inv = event.data.object;
      const subId = inv?.subscription ? String(inv.subscription) : "";
      if (subId) {
        const [rows] = await pool.query(
          "SELECT user_id FROM billing_profiles WHERE stripe_subscription_id = ? LIMIT 1",
          [subId]
        );
        const userId = rows?.[0]?.user_id ? String(rows[0].user_id) : "";
        if (userId) {
          const amountPaid = Number(inv.amount_paid || 0);
          const hostedUrl = inv.hosted_invoice_url ? String(inv.hosted_invoice_url) : null;
          const desc = "Subscription";
          await pool.query(
            "INSERT INTO billing_invoices (user_id, description, amount_cents, status, invoice_url, stripe_invoice_id) VALUES (?, ?, ?, 'paid', ?, ?)",
            [Number(userId), desc, amountPaid, hostedUrl, String(inv.id)]
          );
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    if (recordedEventId) {
      await pool.query("DELETE FROM stripe_events WHERE event_id = ?", [recordedEventId]).catch(() => null);
    }
    logError("stripeWebhookHandler", e);
    return res.status(500).send("server_error");
  }
}

module.exports = { authRouter: router, authPool: pool, stripeWebhookHandler };
