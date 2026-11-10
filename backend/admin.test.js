const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const { createAdminRouter } = require("./admin");

let router;
const base = "http://test.local";
let account;
let queried;
beforeEach(async () => {
  process.env.ADMIN_USER_IDS = "42";
  process.env.JWT_ACCESS_SECRET = "test-only-admin-session-secret-that-is-long";
  account = { id: "42", sv: 3 };
  queried = [];
  const pool = { query: async (sql, args) => {
    queried.push({ sql, args });
    if (sql.includes("SUM(size_bytes) AS used_bytes FROM files GROUP")) return [[{
      id: "9007199254740993", email: "customer@example.com", account_status: "active", used_bytes: "1073741824", storage_limit_gb: 5,
      amount_cents: 499, currency: "usd", billing_interval: "monthly", addons_json: '["extra"]', password_hash: "must-not-leak",
    }]];
    if (sql.includes("FROM billing_entitlements")) return [[]];
    if (sql.includes("file_count")) return [[{ used_bytes: "1073741824", file_count: 1 }]];
    return [[{ total: 1 }]];
  } };
  router = createAdminRouter({ pool, stripe: null,
    requireUserId: async (req, res) => {
      if (!account) { res.status(401).json({ error: "not_authenticated" }); return null; }
      req.userId = account.id; req.sessionVersion = account.sv; return account.id;
    }, verifyCurrentPassword: async (_, password) => password === "valid-password" });
});
// Run the real Express router in-process, so permission tests need no socket.
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const headers = new Map();
    const req = { method: options.method || "GET", url: parsed.pathname + parsed.search,
      originalUrl: parsed.pathname, headers: options.headers || {}, ip: "127.0.0.1",
      query: Object.fromEntries(parsed.searchParams), body: options.body ? JSON.parse(options.body) : {},
      cookies: Object.fromEntries((options.headers?.cookie || "").split(";").filter(Boolean).map(c => c.trim().split("="))) };
    const res = Object.create(express.response);
    res.req = req;
    res.statusCode = 200;
    res.setHeader = (key, value) => headers.set(key.toLowerCase(), value);
    res.getHeader = key => headers.get(key.toLowerCase());
    res.json = body => { resolve({ status: res.statusCode, headers: { get: key => headers.get(key.toLowerCase()) }, json: async () => body }); return res; };
    router.handle(req, res, error => reject(error || new Error("Unexpected route fallthrough")));
  });
}
async function login() {
  const response = await fetch(`${base}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "valid-password" }) });
  assert.equal(response.status, 200);
  const header = response.headers.get("set-cookie");
  assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/); assert.match(header, /Path=\/auth\/admin/);
  return header.split(";")[0];
}

test("anonymous, non-admin, and ordinary customer sessions cannot query admin data", async () => {
  account = null; assert.equal((await fetch(`${base}/customers`)).status, 401);
  account = { id: "7", sv: 1 }; assert.equal((await fetch(`${base}/customers`)).status, 403);
  assert.equal((await fetch(`${base}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"password":"valid-password","role":"admin"}' })).status, 403);
  account = { id: "42", sv: 3 }; assert.equal((await fetch(`${base}/customers`)).status, 401);
  assert.equal(queried.length, 0);
});
test("an admin with an authenticator secret needs a current, unused code", async () => {
  const { base32Encode, codeAt, base32Decode } = require("./totp");
  const secret = base32Encode(Buffer.from("admin-totp-test-secret-20b"));
  process.env.ADMIN_TOTP_SECRETS = `7:OTHERSECRETOTHERSECRET,42:${secret}`;
  try {
    const post = (body) => fetch(`${base}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const current = codeAt(base32Decode(secret), Math.floor(Date.now() / 30000));

    let response = await post({ password: "valid-password" });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "totp_required");

    response = await post({ password: "valid-password", code: current === "000000" ? "111111" : "000000" });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "invalid_totp");

    response = await post({ password: "valid-password", code: current });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /uac_admin=/);

    response = await post({ password: "valid-password", code: current });
    assert.equal(response.status, 401, "the same code can't be used twice");
  } finally {
    delete process.env.ADMIN_TOTP_SECRETS;
  }
});
test("empty allowlist denies access, including forged client roles", async () => {
  process.env.ADMIN_USER_IDS = "";
  assert.equal((await fetch(`${base}/session`, { headers: { "x-admin": "true" } })).status, 403);
});
test("password check, session binding, expiry, and allowlist revocation are enforced", async () => {
  assert.equal((await fetch(`${base}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"password":"wrong"}' })).status, 401);
  const cookie = await login();
  assert.equal((await fetch(`${base}/session`, { headers: { cookie } })).status, 200);
  account.sv = 4;
  assert.equal((await fetch(`${base}/session`, { headers: { cookie } })).status, 401);
  account.sv = 3;
  const expired = jwt.sign({ sv: 3 }, process.env.JWT_ACCESS_SECRET, { subject: "42", audience: "uac-admin", issuer: "uac", expiresIn: -1 });
  assert.equal((await fetch(`${base}/customers`, { headers: { cookie: `uac_admin=${expired}` } })).status, 401);
  process.env.ADMIN_USER_IDS = "7";
  assert.equal((await fetch(`${base}/session`, { headers: { cookie } })).status, 403);
});
test("authorized reporting is paginated, parameterized, uncached, and exposes only intended fields", async () => {
  const cookie = await login();
  const response = await fetch(`${base}/customers?search=%25_%27&page=2`, { headers: { cookie } });
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.customers[0].id, "9007199254740993");
  assert.equal(body.customers[0].usedBytes, 1073741824);
  assert.deepEqual(body.customers[0].addons, ["extra"]);
  assert.equal(JSON.stringify(body).includes("must-not-leak"), false);
  const select = queried.find(q => q.sql.includes("OFFSET ?"));
  assert.equal(select.args.at(-1), 50);
  assert.equal(select.sql.includes("%'"), false);
  assert.equal(select.args[0], "%!%!_'%");
  assert.equal((await fetch(`${base}/report?month=2026-99`, { headers: { cookie } })).status, 400);
  const report = await (await fetch(`${base}/report?month=2026-10`, { headers: { cookie } })).json();
  assert.equal(report.state, "unavailable");
  const logout = await fetch(`${base}/logout`, { method: "POST", headers: { cookie } });
  assert.match(logout.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
});
