const crypto = require("crypto");
const jwt = require("jsonwebtoken");

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 32);
}

// Signed-in requests are limited per user. Requests without a valid token are
// limited per IP, not in one shared "anonymous" bucket that anyone could fill
// to make everyone whose session expired see "too many requests".
function authenticatedUserKey(req) {
  const anonymous = req?.ip ? `ip:${String(req.ip)}` : "anonymous";
  const token = req.cookies?.access_token ? String(req.cookies.access_token) : "";
  const secret = String(process.env.JWT_ACCESS_SECRET || "");
  if (!token || !secret) return anonymous;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    return payload?.sub ? `user:${String(payload.sub)}` : anonymous;
  } catch {
    return anonymous;
  }
}

function createFixedWindowGate({ name, windowMs, limit, maxKeys = 20000 }) {
  const buckets = new Map();
  const safeWindowMs = positiveInt(windowMs, 60_000);
  const safeLimit = positiveInt(limit, 100);

  return function consume(rawKey) {
    const now = Date.now();
    const bucketKey = `${name}:${String(rawKey || "unknown").slice(0, 256)}`;
    let bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + safeWindowMs, logged: false };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    if (buckets.size > maxKeys) {
      for (const [candidateKey, candidate] of buckets) {
        if (candidate.resetAt <= now || buckets.size > maxKeys) buckets.delete(candidateKey);
        if (buckets.size <= maxKeys) break;
      }
    }

    if (bucket.count > safeLimit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      if (!bucket.logged) {
        bucket.logged = true;
        console.warn("[SECURITY_RATE_LIMIT]", name, stableHash(bucketKey));
      }
      return { allowed: false, retryAfter };
    }

    return { allowed: true, retryAfter: 0 };
  };
}

function createFixedWindowLimiter({ key, ...options }) {
  const consume = createFixedWindowGate(options);
  return function fixedWindowLimiter(req, res, next) {
    const result = consume(key(req));
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfter));
      res.setHeader("Cache-Control", "no-store");
      return res.status(429).json({ ok: false, error: "rate_limited" });
    }
    next();
  };
}

function rejectCrossSiteMutation(allowedOrigins, { exemptPaths = [] } = {}) {
  const allowed = new Set(allowedOrigins);
  const exempt = new Set(exemptPaths);
  return function csrfOriginGuard(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    // Only for routes authorized solely by a token in the URL, never by cookies.
    if (exempt.has(req.path)) return next();

    const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
    if (fetchSite === "cross-site") {
      return res.status(403).json({ ok: false, error: "cross_site_request_blocked" });
    }

    const origin = String(req.headers.origin || "").trim();
    if (origin && !allowed.has(origin)) {
      return res.status(403).json({ ok: false, error: "origin_not_allowed" });
    }

    next();
  };
}

module.exports = {
  authenticatedUserKey,
  createFixedWindowGate,
  createFixedWindowLimiter,
  positiveInt,
  rejectCrossSiteMutation,
  stableHash,
};
