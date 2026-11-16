const assert = require("node:assert/strict");
const test = require("node:test");
const { MAX_ATTEMPTS, retryDueSql, retryGapMinutes, retryWindowMinutes } = require("./emergency_retry");

test("retries back off and keep going for about three days", () => {
  assert.equal(retryGapMinutes(1), 2);
  assert.equal(retryGapMinutes(4), 16);
  assert.equal(retryGapMinutes(9), 360);
  assert.equal(retryGapMinutes(19), 360);
  const days = retryWindowMinutes() / 60 / 24;
  assert.ok(days > 2.5 && days < 4, `retry window is ${days.toFixed(2)} days`);
  assert.ok(MAX_ATTEMPTS >= 20);
});

test("the SQL condition uses the same limits as the JS policy", () => {
  const sql = retryDueSql("d.");
  assert.match(sql, new RegExp(`d\\.attempts < ${MAX_ATTEMPTS}`));
  assert.match(sql, /d\.status = 'pending'/);
  assert.match(sql, /LEAST\(POW\(2, GREATEST\(d\.attempts, 1\)\), 360\) MINUTE/);
  assert.match(sql, /d\.status = 'processing' AND d\.updated_at < DATE_SUB\(UTC_TIMESTAMP\(3\), INTERVAL 10 MINUTE\)/);
  assert.doesNotMatch(retryDueSql(""), /\bd\./);
});
