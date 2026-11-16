const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Execute the actual route body without booting MySQL, SMTP or Stripe.
// Normalize line endings so the route slicing below also works on Windows checkouts.
const source = fs.readFileSync(require.resolve('./auth.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('router.post(\n  "/verify-email-code"');
const route = source.slice(start, source.indexOf('\nrouter.post(', start + 1));
for (const verified of [false, true]) {
  for (const validCode of [false, true]) {
    test(`verification session requires a consumed code (verified=${verified}, valid=${validCode})`, async () => {
      let handler;
      let checked = false;
      let cookies = false;
      const conn = { async beginTransaction() {}, async rollback() {}, async commit() {}, release() {} };
      vm.runInNewContext(route, {
        router: { post(path, fn) { handler = fn; } }, asyncHandler: fn => fn,
        normalizeEmail: value => value, validateEmail: () => true, isSixDigitCode: () => true,
        getUserByEmail: async () => ({ id: 1, email: 'test@example.test', status: 'active', email_verified_at: verified }),
        pool: { getConnection: async () => conn },
        consumeEmailVerificationForUser: async () => { checked = true; return { ok: validCode, reason: 'invalid_code' }; },
        issueRefreshToken: async () => { assert.equal(checked && validCode, true); return 'refresh'; },
        signAccessTokenForUser: () => 'access', setAuthCookies: () => { cookies = true; }, logError: () => assert.fail('Unexpected error'),
      });
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await handler({ body: { email: 'test@example.test', code: '123456' } }, res);
      assert.equal(checked, true);
      assert.equal(cookies, validCode);
      assert.equal(res.statusCode, validCode ? 200 : 400);
      assert.equal(res.body.ok, validCode);
    });
  }
}
