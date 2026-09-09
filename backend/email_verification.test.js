const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createEmailVerificationHandler } = require('./email_verification_route');
const { consumeEmailVerificationByTokenOnly } = require('./email_verification');

async function fixture(t, row, { unavailable = false, queryError = false } = {}) {
  const calls = [];
  const conn = {
    async beginTransaction() { calls.push('begin'); },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
    async query(sql, params) {
      calls.push(sql);
      if (queryError) throw Error('private database failure');
      if (sql.startsWith('SELECT')) return [row ? [row] : []];
      if (sql.startsWith('UPDATE email_verification_tokens')) row.used_at = new Date();
      assert.ok(params.length);
      return [{}];
    }
  };
  const app = express();
  app.get(['/verify-email', '/verify-email/browser'], createEmailVerificationHandler({
    pool: { async getConnection() { if (unavailable) throw Error('private connection failure'); return conn; } },
    consumeToken: consumeEmailVerificationByTokenOnly, publicWebBaseUrl: 'https://example.com', logError() {}
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { calls, request: (path = '/verify-email/browser', accept = '*/*', token = 'a'.repeat(64)) => fetch(`http://127.0.0.1:${server.address().port}${path}?token=${token}`, { redirect: 'manual', headers: { accept } }) };
}
const freshRow = () => ({ id: 1, user_id: 2, expires_at: new Date(Date.now() + 60000), used_at: null });
test('browser consumes once, redirects without token, and repeat is already verified', async t => {
  const { request, calls } = await fixture(t, freshRow());
  const response = await request();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://example.com/email-verified?status=success');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await request()).headers.get('location'), 'https://example.com/email-verified?status=already_verified');
  assert.equal(calls.filter(x => x.startsWith('UPDATE users')).length, 1);
});
for (const [status, row, options] of [
  ['expired', { ...freshRow(), expires_at: new Date(0) }, {}],
  ['invalid', null, {}], ['error', freshRow(), { unavailable: true }], ['error', freshRow(), { queryError: true }]
]) test(`browser ${status} (${JSON.stringify(options)})`, async t => {
  const { request, calls } = await fixture(t, row, options);
  const response = await request();
  assert.equal(response.headers.get('location'), `https://example.com/email-verified?status=${status}`);
  assert.ok(!calls.some(x => x.startsWith('UPDATE')));
  assert.ok(!(await response.text()).includes('private'));
});
test('malformed token never opens a transaction', async t => {
  const { request, calls } = await fixture(t, freshRow());
  assert.equal((await request('/verify-email/browser', '*/*', 'bad')).headers.get('location'), 'https://example.com/email-verified?status=invalid');
  assert.deepEqual(calls, []);
});
test('legacy browser links redirect; JSON clients retain status and payload', async t => {
  const { request } = await fixture(t, freshRow());
  assert.deepEqual(await (await request('/verify-email', 'application/json')).json(), { ok: true });
  const used = await request('/verify-email', '*/*');
  assert.equal(used.status, 400);
  assert.deepEqual(await used.json(), { ok: false, error: 'already_used' });
  assert.equal((await request('/verify-email', 'text/html')).status, 303);
});
test('upstream rate limits and failures redirect browsers but preserve API errors', async t => {
  const { verificationBrowserErrors } = require('./email_verification_route');
  const app = express();
  app.use(verificationBrowserErrors('https://example.com'));
  app.get('/auth/verify-email/browser', (req, res) => res.status(429).send('Too many requests'));
  app.get('/auth/verify-email', (req, res) => res.status(504).json({ ok: false, error: 'timeout' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/auth/verify-email`;
  for (const path of ['', '/browser']) {
    const response = await fetch(base + path, { redirect: 'manual', headers: { accept: 'text/html' } });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://example.com/email-verified?status=error');
  }
  const api = await fetch(base, { headers: { accept: 'application/json' } });
  assert.equal(api.status, 504);
  assert.deepEqual(await api.json(), { ok: false, error: 'timeout' });
});
