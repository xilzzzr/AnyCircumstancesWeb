const assert = require("node:assert/strict");
const test = require("node:test");
const { createEmergencyDispatchQuota } = require("./emergency_quota");

test("one account repeating its panic PIN cannot use up the platform-wide allowance", () => {
  const take = createEmergencyDispatchQuota({ userLimitPerHour: 2, globalLimitPerHour: 5 });

  assert.equal(take("attacker").status, "ok");
  assert.equal(take("attacker").status, "ok");
  for (let i = 0; i < 100; i += 1) assert.equal(take("attacker").status, "user_limited");

  // Only the attacker's two allowed triggers counted globally.
  assert.equal(take("victim-1").status, "ok");
  assert.equal(take("victim-2").status, "ok");
  assert.equal(take("victim-3").status, "ok");
});

test("when the platform-wide allowance is used up, triggers are deferred, not refused", () => {
  const take = createEmergencyDispatchQuota({ userLimitPerHour: 2, globalLimitPerHour: 2 });
  assert.equal(take("a").status, "ok");
  assert.equal(take("b").status, "ok");
  const third = take("c");
  assert.equal(third.status, "global_limited");
  assert.ok(third.retryAfter > 0);
});
