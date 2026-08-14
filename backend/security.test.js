const test = require("node:test");
const assert = require("node:assert/strict");
const { createFixedWindowLimiter, rejectCrossSiteMutation } = require("./security");

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("fixed-window limiter enforces a global ceiling and Retry-After", () => {
  const limiter = createFixedWindowLimiter({ name: "test", windowMs: 60_000, limit: 2, key: () => "global" });
  const req = {};
  for (let i = 0; i < 2; i += 1) {
    const res = responseRecorder();
    let continued = false;
    limiter(req, res, () => { continued = true; });
    assert.equal(continued, true);
  }
  const blocked = responseRecorder();
  limiter(req, blocked, () => assert.fail("request should have been blocked"));
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.error, "rate_limited");
  assert.ok(Number(blocked.headers["Retry-After"]) > 0);
});

test("origin guard rejects cross-site state changes", () => {
  const guard = rejectCrossSiteMutation(["https://anycircumstances.com"]);
  const res = responseRecorder();
  guard({ method: "POST", headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" } }, res, () => {
    assert.fail("cross-site request should have been blocked");
  });
  assert.equal(res.statusCode, 403);
});

test("origin guard permits same-origin and native-client mutations", () => {
  const guard = rejectCrossSiteMutation(["https://anycircumstances.com"]);
  for (const headers of [{ origin: "https://anycircumstances.com", "sec-fetch-site": "same-origin" }, {}]) {
    let continued = false;
    guard({ method: "POST", headers }, responseRecorder(), () => { continued = true; });
    assert.equal(continued, true);
  }
});
