const express = require("express");
const jwt = require("jsonwebtoken");
const { createFixedWindowLimiter } = require("./security");
const { createReportingCache } = require("./admin_reporting");

const COOKIE = "uac_admin";
const COOKIE_PATH = "/auth/admin";
const SESSION_SECONDS = 15 * 60;

function isAdmin(userId) {
  // IDs are configured on the server. Email changes and client-supplied roles
  // cannot grant access; an empty allowlist denies everyone.
  return String(process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean).includes(String(userId));
}

function createAdminRouter({ pool, stripe, requireUserId, verifyCurrentPassword }) {
  const router = express.Router();
  const reports = createReportingCache({ pool, stripe });
  const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true", sameSite: "strict", path: COOKIE_PATH });
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  router.use(createFixedWindowLimiter({ name: "admin_requests", windowMs: 60_000, limit: 90, key: req => req.ip }));
  router.use(wrap(async (req, res, next) => {
    const id = await requireUserId(req, res);
    if (!id) return;
    if (!isAdmin(id)) return res.status(403).json({ ok: false, error: "admin_required" });
    next();
  }));

  router.post("/login", createFixedWindowLimiter({ name: "admin_login", windowMs: 15 * 60_000, limit: 5, key: req => req.userId }), wrap(async (req, res) => {
    if (!await verifyCurrentPassword(req.userId, String(req.body?.password || ""))) {
      return res.status(401).json({ ok: false, error: "invalid_credentials" });
    }
    const token = jwt.sign({ sv: req.sessionVersion }, process.env.JWT_ACCESS_SECRET, {
      algorithm: "HS256", subject: req.userId, audience: "uac-admin", issuer: "uac", expiresIn: SESSION_SECONDS,
    });
    res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: SESSION_SECONDS * 1000 });
    res.json({ ok: true });
  }));
  router.post("/logout", (req, res) => {
    res.clearCookie(COOKIE, cookieOptions());
    res.json({ ok: true });
  });
  router.use((req, res, next) => {
    try {
      const payload = jwt.verify(req.cookies?.[COOKIE] || "", process.env.JWT_ACCESS_SECRET, {
        algorithms: ["HS256"], audience: "uac-admin", issuer: "uac",
      });
      if (payload.sub !== req.userId || payload.sv !== req.sessionVersion) throw new Error("session_mismatch");
      next();
    } catch {
      res.clearCookie(COOKIE, cookieOptions());
      return res.status(401).json({ ok: false, error: "admin_login_required" });
    }
  });
  router.get("/session", (req, res) => res.json({ ok: true }));

  router.get("/customers", wrap(async (req, res) => {
    const page = Math.max(1, Math.min(1000000, Number.parseInt(String(req.query.page), 10) || 1));
    const search = String(req.query.search || "").trim().slice(0, 254);
    const pattern = `%${search.replace(/[!%_]/g, "!$&")}%`;
    const where = search ? "WHERE (u.email LIKE ? ESCAPE '!' OR CAST(u.id AS CHAR) LIKE ? ESCAPE '!')" : "";
    const params = search ? [pattern, pattern] : [];
    const [counts] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${where}`, params);
    const [rows] = await pool.query(`SELECT CAST(u.id AS CHAR) AS id, u.email, u.status AS account_status,
      bp.status AS billing_status, bp.billing_interval, bp.amount_cents, bp.currency,
      bp.storage_limit_gb, bp.checkin_frequency, bp.addons_json, bp.stripe_subscription_id,
      COALESCE(f.used_bytes, 0) AS used_bytes
      FROM users u LEFT JOIN billing_profiles bp ON bp.user_id = u.id
      LEFT JOIN (SELECT user_id, SUM(size_bytes) AS used_bytes FROM files GROUP BY user_id) f ON f.user_id = u.id
      ${where} ORDER BY u.id DESC LIMIT 50 OFFSET ?`, [...params, (page - 1) * 50]);
    const ids = rows.map(r => String(r.id));
    const [entitlements] = ids.length ? await pool.query(`SELECT CAST(user_id AS CHAR) AS user_id, provider, status, product_id, billing_interval,
      storage_limit_gb, checkin_frequency, current_period_end FROM billing_entitlements
      WHERE user_id IN (?) ORDER BY id DESC`, [ids]) : [[]];
    const [totals] = await pool.query("SELECT COUNT(*) AS file_count, COALESCE(SUM(size_bytes), 0) AS used_bytes FROM files");
    const [customers] = await pool.query("SELECT COUNT(*) AS total FROM users");
    res.json({ ok: true, page, pageSize: 50, total: Number(counts[0].total), customerCount: Number(customers[0].total),
      totalUsedBytes: Number(totals[0].used_bytes), fileCount: Number(totals[0].file_count),
      customers: rows.map(r => ({ id: String(r.id), email: r.email, accountStatus: r.account_status,
        billingStatus: r.billing_status || "none", billingInterval: r.billing_interval || null,
        configuredAmountCents: r.amount_cents == null ? null : Number(r.amount_cents), currency: r.currency || null,
        storageLimitGb: r.storage_limit_gb == null ? null : Number(r.storage_limit_gb),
        usedBytes: Number(r.used_bytes), checkInFrequency: r.checkin_frequency || null,
        addons: parseAddons(r.addons_json), stripeSubscriptionId: r.stripe_subscription_id || null,
        entitlements: entitlements.filter(e => String(e.user_id) === String(r.id)).map(e => ({ provider: e.provider,
          status: e.status, productId: e.product_id, billingInterval: e.billing_interval,
          storageLimitGb: e.storage_limit_gb, checkInFrequency: e.checkin_frequency, currentPeriodEnd: e.current_period_end })),
      })),
    });
  }));
  router.get("/report", wrap(async (req, res) => {
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ ok: false, error: "invalid_month" });
    res.json({ ok: true, ...reports.get(month) });
  }));
  return router;
}

function parseAddons(value) {
  try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed.filter(v => typeof v === "string") : []; }
  catch { return []; }
}

module.exports = { createAdminRouter, isAdmin };
