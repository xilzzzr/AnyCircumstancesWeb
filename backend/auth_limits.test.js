const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createAuthLimiters } = require("./auth_limits");

test("login limits count failures, allow repeated successes and isolate accounts", async (t) => {
  const app = express();
  const { authLimiter, loginLimiter, loginAccountLimiter } = createAuthLimiters({
    AUTH_IP_LIMIT_PER_15_MINUTES: 100,
    LOGIN_IP_LIMIT_PER_15_MINUTES: 20,
    LOGIN_ACCOUNT_LIMIT_PER_15_MINUTES: 2,
  });
  app.use(express.json());
  app.post("/auth/login", loginLimiter, loginAccountLimiter);
  app.use("/auth", authLimiter);
  app.post("/auth/login", (req, res) => res.status(req.body.password === "correct" ? 200 : 401).json({ ok: req.body.password === "correct" }));
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const login = (email, password) => fetch(`http://127.0.0.1:${server.address().port}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  for (let i = 0; i < 12; i++) assert.equal((await login("a@example.com", "correct")).status, 200);
  for (let i = 0; i < 2; i++) assert.equal((await login("a@example.com", "wrong")).status, 401);
  const blocked = await login(" A@EXAMPLE.COM ", "wrong");
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
  assert.equal((await blocked.json()).error, "rate_limited");
  assert.equal((await login("b@example.com", "correct")).status, 200);
});

test("session reads, refreshes and logout do not exhaust the auth limiter", async (t) => {
  const app = express();
  app.use("/auth", createAuthLimiters({ AUTH_IP_LIMIT_PER_15_MINUTES: 1 }).authLimiter);
  app.use((req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  for (let i = 0; i < 5; i++) {
    for (const [path, method] of [["me", "GET"], ["refresh", "POST"], ["logout", "POST"]]) {
      assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/auth/${path}`, { method })).status, 200);
    }
  }
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/auth/login`, { method: "POST" })).status, 200);
});
