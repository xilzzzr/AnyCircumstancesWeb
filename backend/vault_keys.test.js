const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { validateBundle, registerVaultKeyRoutes } = require('./vault_keys');
const publicKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const bundle = { version: 1, kdf: 'PBKDF2-SHA256', iterations: 200000, private_key_format: 'pkcs8', public_key: publicKey,
  encrypted_private_key: crypto.randomBytes(1234).toString('base64'), salt: crypto.randomBytes(16).toString('base64'), iv: crypto.randomBytes(12).toString('base64') };

test('key backup accepts only the versioned encrypted format with bounded parameters', () => {
  assert.deepEqual(validateBundle(bundle), bundle);
  // New vault keys use 600,000 iterations; earlier ones keep 200,000.
  assert.equal(validateBundle({ ...bundle, iterations: 600000 }).iterations, 600000);
  for (const patch of [{ iterations: 1 }, { iterations: 300000 }, { iterations: '600000' }, { version: 2 }, { private_key_format: 'raw' }, { iv: '' }, { salt: 'YQ==' }, { encrypted_private_key: 'plaintext' }, { public_key: 'a'.repeat(50000) }]) {
    assert.throws(() => validateBundle({ ...bundle, ...patch }));
  }
  assert.equal('passphrase' in validateBundle({ ...bundle, passphrase: 'never-store-this' }), false);
});

test('key backup routes isolate accounts, prevent replacement, and resolve setup conflicts', async (t) => {
  const saved = new Map();
  const publicKeys = new Map();
  const query = async (sql, params) => {
    const uid = String(params[0]);
    if (sql.startsWith('SELECT public_key')) return [[{ public_key: publicKeys.get(uid) || null }]];
    if (sql.startsWith('SELECT id FROM users')) return [[{ id: uid }]];
    if (sql.startsWith('SELECT id FROM files')) return [[]];
    if (sql.startsWith('SELECT bundle_json') || sql.startsWith('SELECT key_id')) return [[...(saved.get(uid) || [])]];
    if (sql.startsWith('INSERT INTO user_vault_keys')) {
      saved.set(uid, [...(saved.get(uid) || []), { key_id: params[1], bundle_json: params[2] }]); return [{}];
    }
    if (sql.startsWith('UPDATE users')) { publicKeys.set(String(params[1]), params[0]); return [{}]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const pool = { query, getConnection: async () => ({ query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} }) };
  const app = express();
  app.use(express.json());
  registerVaultKeyRoutes(app, (req, res, next) => {
    req.userId = req.headers['x-test-user'];
    if (!req.userId) return res.status(401).json({ ok: false });
    next();
  }, (req, res, next) => {
    if (req.headers['x-vault-unlocked'] !== 'yes') return res.status(423).json({ ok: false, error: 'vault_locked' });
    next();
  }, () => pool, (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const request = (user, body, unlocked = true) => fetch(`http://127.0.0.1:${server.address().port}/vault-keys`, {
    headers: { ...(user ? { 'x-test-user': user } : {}), ...(unlocked ? { 'x-vault-unlocked': 'yes' } : {}), 'Content-Type': 'application/json' },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  assert.equal((await request(null)).status, 401);
  assert.equal((await request('a', undefined, false)).status, 423);
  assert.equal((await request('a', { bundle, initialize: true, user_id: 'b' })).status, 200);
  assert.deepEqual((await (await request('b')).json()).keys, []);
  const first = (await (await request('a')).json()).keys[0];
  assert.deepEqual(first, bundle);
  const changed = { ...bundle, encrypted_private_key: crypto.randomBytes(1234).toString('base64') };
  assert.equal((await request('a', { bundle: changed })).status, 200);
  assert.deepEqual((await (await request('a')).json()).keys, [bundle]);
  const anotherPublic = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const second = { ...bundle, public_key: anotherPublic };
  assert.equal((await request('a', { bundle: second, initialize: true })).status, 409);
  assert.equal((await request('a', { bundle: second, initialize: false })).status, 200);
  assert.equal((await (await request('a')).json()).keys.length, 2);
});
