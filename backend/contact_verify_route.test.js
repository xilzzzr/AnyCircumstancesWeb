const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");
const { escapeHtml } = require("./emails");

const source = fs.readFileSync(require.resolve("./auth.js"), "utf8").replace(/\r\n/g, "\n");
function slice(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `could not find ${JSON.stringify(startMarker)} in auth.js`);
  return source.slice(start, end);
}

const code = "c".repeat(64);
const sha256Hex = (value) => crypto.createHash("sha256").update(String(value), "utf8").digest("hex");

// Loads the real GET and POST /emergency-contacts/verify routes with an in-memory token.
function loadRoutes() {
  const token = { id: 1, contact_id: 9, token_hash: sha256Hex(code), expires_at: new Date(Date.now() + 3600_000), used_at: null };
  const contact = { verified_at: null };
  const writes = [];
  const handlers = {};
  const query = async (sql, params = []) => {
    if (sql.startsWith("SELECT")) return [[token].filter((row) => row.token_hash === params[0])];
    writes.push(sql);
    if (sql.startsWith("UPDATE emergency_contact_verification_tokens")) token.used_at = new Date();
    if (sql.startsWith("UPDATE emergency_contacts")) contact.verified_at = new Date();
    return [{}];
  };
  const code_ = [
    slice("function renderEmergencyContactVerifyHtml(", "\nasync function consumeEmergencyContactVerificationByToken("),
    slice("async function consumeEmergencyContactVerificationByToken(", "\nasync function sendEmergencyContactInviteEmail("),
    slice("function sendContactVerifyHtml(", '\nrouter.post(\n  "/device-token"'),
  ].join("\n");
  vm.runInNewContext(code_, {
    String, Number, Boolean, Date, encodeURIComponent,
    escapeHtml, sha256Hex, nowUtc: () => new Date(), publicWebBaseUrl: "https://example.test",
    asyncHandler: (fn) => fn, logError: () => {},
    router: {
      get: (path, fn) => { handlers[`GET ${path}`] = fn; },
      post: (path, fn) => { handlers[`POST ${path}`] = fn; },
    },
    pool: { query, getConnection: async () => ({ query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} }) },
    getEmergencyContactContext: async () => ({ owner_email: "owner@example.test", contact_name: "Sam" }),
  });
  return { handlers, writes, contact };
}

function response() {
  return {
    statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = String(body); return this; },
    json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; },
  };
}

test("opening a contact confirmation link shows a Confirm button and changes nothing", async () => {
  const { handlers, writes, contact } = loadRoutes();
  for (const accept of ["text/html", "*/*", "application/json"]) {
    const res = response();
    await handlers["GET /emergency-contacts/verify"]({ query: { token: code }, headers: { accept } }, res);
    assert.equal(res.statusCode, 200);
    if (accept === "text/html") {
      assert.match(res.body, new RegExp(`<form method="post" action="/auth/emergency-contacts/verify\\?token=${code}">`));
      assert.match(res.body, /owner@example\.test added you as an emergency contact/);
      assert.equal(res.headers["cache-control"], "no-store");
    }
  }
  assert.deepEqual(writes, []);
  assert.equal(contact.verified_at, null);
});

test("pressing Confirm verifies the contact once", async () => {
  const { handlers, contact } = loadRoutes();
  const res = response();
  await handlers["POST /emergency-contacts/verify"]({ query: { token: code }, headers: { accept: "text/html" } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /You’re verified as an emergency contact/);
  assert.ok(contact.verified_at);

  const again = response();
  await handlers["POST /emergency-contacts/verify"]({ query: { token: code }, headers: { accept: "text/html" } }, again);
  assert.equal(again.statusCode, 400);
  assert.match(again.body, /already used/);
});

test("an unknown token shows the error page without a Confirm button", async () => {
  const { handlers } = loadRoutes();
  const res = response();
  await handlers["GET /emergency-contacts/verify"]({ query: { token: "d".repeat(64) }, headers: { accept: "text/html" } }, res);
  assert.equal(res.statusCode, 400);
  assert.doesNotMatch(res.body, /<form/);
});
