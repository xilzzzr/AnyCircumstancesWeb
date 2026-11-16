const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const scheduleFunctions = require("./checkin_schedule");

const source = fs.readFileSync(require.resolve("./auth.js"), "utf8").replace(/\r\n/g, "\n");

// Runs the /verification-check-in route with the panic PIN (or the normal PIN)
// and a chosen emergency-quota outcome, recording what it did.
function checkIn({ quota = "ok", panic = true } = {}) {
  let handler;
  const calls = { checkins: 0, triggerJobs: 0, processed: 0, delivered: 0, processedBeforeReply: null };
  const start = source.indexOf('router.post(\n  "/verification-check-in"');
  const end = source.indexOf("\nrouter.get(", start);
  assert.ok(start > 0 && end > start, "check-in route not found in auth.js");

  const settings = { frequency: "weekly", grace_period_hours: 24, reminders: 3 };
  const conn = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
    query: async (sql) => {
      if (sql.startsWith("SELECT")) return [[settings]];
      if (sql.includes("INSERT INTO verification_checkins")) calls.checkins += 1;
      return [{}];
    },
  };

  vm.runInNewContext(source.slice(start, end), {
    Date, String, Number, ...scheduleFunctions,
    router: { post: (path, fn) => { handler = fn; } },
    asyncHandler: (fn) => fn,
    requireUserId: async () => "1",
    pool: { query: async () => [[{ pin_hash: "normal-hash", panic_pin_hash: "panic-hash" }]], getConnection: async () => conn },
    bcrypt: { compare: async (pin, hash) => hash === (panic ? "panic-hash" : "normal-hash") },
    takeEmergencyDispatchQuota: () => ({ status: quota, retryAfter: 60 }),
    insertEmergencyTriggerJob: async () => { calls.triggerJobs += 1; return 41; },
    processEmergencyTriggerJobs: async () => { calls.processed += 1; },
    deliverPendingEmergencyDispatches: async () => { calls.delivered += 1; },
    getPaidCheckinFrequency: async () => null,
    getVerificationSettingsRow: async () => settings,
    nowUtc: () => new Date("2026-11-10T12:00:00Z"),
    daysForFrequency: () => 7,
    addDays: (date, days) => new Date(+date + days * 86400000),
    settingsDto: (row) => row,
    logError: () => assert.fail("check-in failed"),
  });

  return {
    calls,
    async run() {
      const res = {
        statusCode: 200,
        headers: {},
        status(code) { this.statusCode = code; return this; },
        setHeader(name, value) { this.headers[name] = value; },
        json(body) { this.body = body; calls.processedBeforeReply = calls.processed; return this; },
      };
      await handler({ body: { pin: "123456" }, ip: "203.0.113.9", headers: {} }, res);
      return res;
    },
  };
}

test("a panic check-in is recorded, triggers delivery, and replies before delivering", async () => {
  const fixture = checkIn({ quota: "ok" });
  const res = await fixture.run();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(fixture.calls.checkins, 1);
  assert.equal(fixture.calls.triggerJobs, 1);
  assert.equal(fixture.calls.processedBeforeReply, 0);
  assert.equal(fixture.calls.processed, 1);
  assert.equal(fixture.calls.delivered, 1);
});

test("when the platform-wide limit is reached, the panic trigger is still recorded for the dispatcher", async () => {
  const fixture = checkIn({ quota: "global_limited" });
  const res = await fixture.run();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(fixture.calls.checkins, 1);
  assert.equal(fixture.calls.triggerJobs, 1);
  assert.equal(fixture.calls.processed, 0);
});

test("over the per-user limit the check-in is recorded and the reply is unchanged", async () => {
  const fixture = checkIn({ quota: "user_limited" });
  const res = await fixture.run();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(fixture.calls.checkins, 1);
  assert.equal(fixture.calls.triggerJobs, 0);
});

test("the panic PIN reply matches a normal check-in reply in every quota state", async () => {
  const normal = await checkIn({ panic: false }).run();
  for (const quota of ["ok", "global_limited", "user_limited"]) {
    const panicReply = await checkIn({ quota }).run();
    // Compare what goes over the wire (the route runs in a separate VM realm).
    assert.equal(panicReply.statusCode, normal.statusCode);
    assert.equal(JSON.stringify(panicReply.body), JSON.stringify(normal.body));
    assert.equal(JSON.stringify(panicReply.headers), JSON.stringify(normal.headers));
  }
});
