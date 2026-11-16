const assert = require("node:assert/strict");
const test = require("node:test");
const { base32Decode, base32Encode, codeAt, verifyTotp } = require("./totp");

// RFC 6238 appendix B test secret ("12345678901234567890"), SHA-1, last 6 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

test("codes match the RFC 6238 test vectors", () => {
  assert.equal(RFC_SECRET, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.deepEqual(base32Decode(RFC_SECRET), Buffer.from("12345678901234567890"));
  const secret = base32Decode(RFC_SECRET);
  assert.equal(codeAt(secret, Math.floor(59 / 30)), "287082");
  assert.equal(codeAt(secret, Math.floor(1111111109 / 30)), "081804");
  assert.equal(codeAt(secret, Math.floor(2000000000 / 30)), "279037");
});

test("a current code verifies, with one step of clock drift either way", () => {
  const now = 1111111109 * 1000;
  assert.equal(verifyTotp(RFC_SECRET, "081804", { now }), Math.floor(1111111109 / 30));
  assert.notEqual(verifyTotp(RFC_SECRET, "081804", { now: now + 30_000 }), null);
  assert.equal(verifyTotp(RFC_SECRET, "081804", { now: now + 120_000 }), null);
});

test("wrong, malformed and secretless codes are rejected", () => {
  const now = 1111111109 * 1000;
  assert.equal(verifyTotp(RFC_SECRET, "000000", { now }), null);
  assert.equal(verifyTotp(RFC_SECRET, "81804", { now }), null);
  assert.equal(verifyTotp(RFC_SECRET, "abcdef", { now }), null);
  assert.equal(verifyTotp("", "081804", { now }), null);
  assert.equal(verifyTotp("not base32!", "081804", { now }), null);
});
