const rateLimit = require("express-rate-limit");
const { positiveInt, stableHash } = require("./security");

function createAuthLimiters(env = process.env) {
  const common = {
    windowMs: 15 * 60 * 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "rate_limited" },
  };
  return {
    authLimiter: rateLimit({
      ...common,
      limit: positiveInt(env.AUTH_IP_LIMIT_PER_15_MINUTES, 600),
      // Session checks and logout must not consume the authentication budget.
      skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
        ["/me", "/refresh", "/logout"].includes(req.path),
    }),
    loginLimiter: rateLimit({
      ...common,
      limit: positiveInt(env.LOGIN_IP_LIMIT_PER_15_MINUTES, 100),
      skipSuccessfulRequests: true,
    }),
    loginAccountLimiter: rateLimit({
      ...common,
      limit: positiveInt(env.LOGIN_ACCOUNT_LIMIT_PER_15_MINUTES, 30),
      skipSuccessfulRequests: true,
      keyGenerator: (req) => stableHash(String(req.body?.email || "").trim().toLowerCase()),
    }),
  };
}

module.exports = { createAuthLimiters };
