const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("./auth.js"), "utf8").replace(/\r\n/g, "\n");

function slice(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `could not find ${JSON.stringify(startMarker)} in auth.js`);
  return source.slice(start, end);
}

const isDuressLockedSource = slice("function isDuressLocked(", "\n}\n") + "\n}\n";

// Loads one route from auth.js with the given dependencies and returns its handler.
function loadRoute(routeSource, deps) {
  let handler;
  const register = (path, fn) => { handler = fn; };
  vm.runInNewContext(`${isDuressLockedSource}\n${routeSource}`, {
    String, Number, Boolean, Date, Buffer, JSON, encodeURIComponent,
    asyncHandler: (fn) => fn,
    router: { post: register, delete: register },
    logError: () => {},
    clearAuthCookies: () => {},
    ...deps,
  });
  return handler;
}

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = JSON.parse(JSON.stringify(body)); this.sentAt = this.clock?.(); return this; },
    setHeader() {},
  };
}

function connection(log) {
  return {
    beginTransaction: async () => log.push("begin"),
    commit: async () => log.push("commit"),
    rollback: async () => log.push("rollback"),
    release: () => log.push("release"),
    query: async () => [{}],
  };
}

test("reusing an already rotated refresh token keeps the revocation of every session", async () => {
  const log = [];
  const handler = loadRoute(slice('router.post(\n  "/refresh"', "\nrouter.post("), {
    pool: { getConnection: async () => connection(log) },
    rotateRefreshToken: async () => ({ ok: false, reason: "refresh_reuse_detected" }),
  });
  const res = response();
  await handler({ cookies: { refresh_token: "stolen" } }, res);
  assert.equal(res.statusCode, 401);
  assert.ok(log.includes("commit"), "revocation committed");
  assert.equal(log.includes("rollback"), false);
});

test("an expired refresh token still rolls back", async () => {
  const log = [];
  const handler = loadRoute(slice('router.post(\n  "/refresh"', "\nrouter.post("), {
    pool: { getConnection: async () => connection(log) },
    rotateRefreshToken: async () => ({ ok: false, reason: "expired_refresh" }),
  });
  await handler({ cookies: { refresh_token: "old" } }, response());
  assert.ok(log.includes("rollback"));
  assert.equal(log.includes("commit"), false);
});

const lockedUser = {
  id: "7", email: "owner@example.com", password_hash: "hash", email_verified_at: new Date(),
  status: "active", session_version: 2, duress_locked_until: new Date(Date.now() + 3600_000),
};

test("signing in to a duress-locked account looks exactly like a deleted account", async () => {
  const login = (user) => loadRoute(slice('router.post(\n  "/login"', "\nrouter.post("), {
    normalizeEmail: (email) => String(email || "").trim().toLowerCase(),
    validateEmail: () => true,
    getUserByEmail: async () => user,
    bcrypt: { compare: async () => true },
    DUMMY_PASSWORD_HASH: "dummy",
    pool: { getConnection: async () => connection([]) },
  });
  const locked = response();
  await login(lockedUser)({ body: { email: "owner@example.com", password: "right-password" } }, locked);
  const deleted = response();
  await login(null)({ body: { email: "owner@example.com", password: "right-password" } }, deleted);
  assert.equal(locked.statusCode, 401);
  assert.equal(locked.statusCode, deleted.statusCode);
  assert.deepEqual(locked.body, deleted.body);
});

test("a duress-locked account gets no password-reset email", async () => {
  let sent = 0;
  const handler = loadRoute(slice('router.post(\n  "/password-reset/request"', "\nrouter.post("), {
    normalizeEmail: (email) => String(email || "").trim().toLowerCase(),
    validateEmail: () => true,
    getUserByEmail: async () => lockedUser,
    sendPasswordResetEmail: async () => { sent += 1; return { ok: true }; },
    createPasswordResetToken: async () => "token",
    pool: { getConnection: async () => connection([]) },
    publicWebBaseUrl: "https://example.test",
  });
  const res = response();
  await handler({ body: { email: "owner@example.com" } }, res);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(sent, 0);
});

// Cancel and delete: the password is required before the PIN, and the
// emergency PIN gets exactly the reply the real action gets.
for (const [label, startMarker, endMarker, confirmation] of [
  ["cancelling the plan", 'router.post(\n  "/account/cancel-subscription"', "\nrouter.delete(", "DELETE MY FILES"],
  ["deleting the account", 'router.delete(\n  "/account",', "\nasync function stripeWebhookHandler(", "DELETE MY ACCOUNT"],
]) {
  function destructiveRoute(events) {
    return loadRoute(slice(startMarker, endMarker), {
      requireUserId: async () => "7",
      verifyCurrentPassword: async (userId, password) => password === "right-password",
      classifySafetyPin: async (userId, pin) => {
        events.push("pin-checked");
        return pin === "9999" ? "panic" : pin === "1234" ? "normal" : "invalid";
      },
      pool: { query: async () => [[{ stripe_subscription_id: "sub_1", has_apple: 0 }]] },
      activateDuressLockout: async () => { events.push("duress-locked"); return 55; },
      deliverDuressTrigger: async () => events.push("duress-delivered"),
      queueAccountLifecycleJob: async () => events.push("queued"),
      attemptAccountLifecycleJob: async () => ({ ok: true }),
      stripe: null,
    });
  }

  test(`${label} needs the current password before the PIN is even checked`, async () => {
    const events = [];
    const res = response();
    await destructiveRoute(events)({ body: { confirmation, password: "wrong", pin: "1234" } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "reauthentication_failed");
    assert.deepEqual(events, []);
  });

  test(`${label} with the emergency PIN replies exactly like the real action, then delivers`, async () => {
    const normalEvents = [];
    const normal = response();
    await destructiveRoute(normalEvents)({ body: { confirmation, password: "right-password", pin: "1234" } }, normal);
    assert.ok(normalEvents.includes("queued"));

    const panicEvents = [];
    const panic = response();
    panic.clock = () => panicEvents.length;
    await destructiveRoute(panicEvents)({ body: { confirmation, password: "right-password", pin: "9999" } }, panic);
    assert.equal(panic.statusCode, normal.statusCode);
    assert.deepEqual(panic.body, normal.body);
    assert.equal(panicEvents.includes("queued"), false);
    assert.ok(panic.sentAt < panicEvents.indexOf("duress-delivered") + 1, "reply sent before delivery");
  });
}
