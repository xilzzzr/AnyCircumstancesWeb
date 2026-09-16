const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');

// Load the real router without connecting to the application's database.
let queryImpl;
const authPath = require.resolve('./auth');
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: {
  authPool: { query: (...args) => queryImpl(...args) },
} };
const { filesRouter } = require('./files');
const pair = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const escrow = pair();
const a = pair();
const b = pair();
const publicB64 = (key) => key.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const token = 'ab'.repeat(32);
const rawAes = crypto.randomBytes(32);
const wrapped = crypto.publicEncrypt({ key: escrow.publicKey, oaepHash: 'sha256' }, rawAes).toString('base64');
const meta = { original_name: 'Emergency instructions.pdf', original_content_type: 'application/pdf', chunked: true };
const unwrap = (key, envelope) => crypto.privateDecrypt({ key: key.privateKey, oaepHash: 'sha256' }, Buffer.from(envelope.enc_key_b64, 'base64'));

test('emergency envelope HTTP routes', async (t) => {
  const originalEnv = process.env.ESCROW_PRIVATE_KEY_PEM;
  const privatePem = escrow.privateKey.export({ type: 'pkcs8', format: 'pem' });
  process.env.ESCROW_PRIVATE_KEY_PEM = privatePem;
  const app = express();
  app.use(express.json());
  app.use('/files', filesRouter);
  app.use((err, req, res, next) => res.status(500).json({ ok: false, error: 'unexpected_test_error' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => {
    server.close();
    if (originalEnv === undefined) delete process.env.ESCROW_PRIVATE_KEY_PEM;
    else process.env.ESCROW_PRIVATE_KEY_PEM = originalEnv;
  });
  let fixture;
  let queries;
  const reset = (patch = {}) => {
    fixture = { share: true, expires: new Date(Date.now() + 60000), escrow: wrapped, owner: true, meta: JSON.stringify(meta), ...patch };
    queries = [];
    process.env.ESCROW_PRIVATE_KEY_PEM = privatePem;
  };
  queryImpl = async (sql, params) => {
    queries.push({ sql, params });
    // Fail every write, including attempts to persist temporary keys/envelopes.
    assert.match(sql, /^SELECT\b/);
    if (sql.includes('FROM contact_file_share_tokens')) {
      assert.match(sql, /f.user_id = c.user_id/);
      assert.deepEqual(params, [crypto.createHash('sha256').update(token).digest('hex')]);
      return [fixture.share ? [{ contact_id: 7, file_id: 'users/1/file', expires_at: fixture.expires, content_type: 'application/pdf', used_at: null }] : []];
    }
    if (sql.includes('FROM file_key_escrows')) return [fixture.escrow === null ? [] : [{ alg: 'rsa-oaep-sha256', enc_key_b64: fixture.escrow }]];
    if (sql.includes('SELECT user_id FROM files')) return [fixture.owner ? [{ user_id: 1 }] : []];
    if (sql.includes('FROM file_key_envelopes')) {
      assert.match(sql, /recipient_type = 'user'/);
      assert.deepEqual(params, ['users/1/file', '1']);
      return [fixture.meta === undefined ? [] : [{ meta_json: fixture.meta }]];
    }
    assert.fail('Unexpected query');
  };
  const request = async (body = { token, public_key: publicB64(a) }, path = 'share-get-contact-envelope') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/files/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  await t.test('same bearer token re-wraps independently for two temporary keys without writes', async () => {
    reset();
    const first = await request();
    const second = await request({ token, public_key: publicB64(b) });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    assert.equal(first.body.ok, true);
    assert.deepEqual(first.body.meta_json, meta);
    assert.deepEqual(unwrap(a, first.body), rawAes);
    assert.deepEqual(unwrap(b, second.body), rawAes);
    assert.throws(() => unwrap(b, first.body));
    assert.throws(() => unwrap(a, second.body));
    assert.equal(queries.length, 8);
    assert.ok(queries.every(({ sql }) => !sql.includes("'contact'") && !/INSERT|UPDATE|DELETE/.test(sql)));
    assert.deepEqual(Object.keys(first.body).sort(), ['ok', 'contact_id', 'file_id', 'alg', 'enc_key_b64', 'meta_json'].sort());
  });
  for (const [name, patch, body, status, error] of [
    ['malformed token', {}, { token: 'bad', public_key: publicB64(a) }, 400, 'invalid_token'],
    ['unknown token', { share: false }, undefined, 404, 'invalid_token'],
    ['expired token', { expires: new Date(Date.now() - 1000) }, undefined, 410, 'token_expired'],
    ['missing public key', {}, { token }, 400, 'missing_public_key'],
    ['invalid public key', {}, { token, public_key: 'invalid' }, 400, 'invalid_public_key'],
    ['non-RSA public key', {}, { token, public_key: publicB64(crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })) }, 400, 'invalid_public_key'],
    ['oversized public key', {}, { token, public_key: 'a'.repeat(20001) }, 400, 'public_key_too_large'],
    ['missing escrow', { escrow: null }, undefined, 500, 'missing_file_escrow'],
    ['empty escrow', { escrow: '' }, undefined, 500, 'missing_file_escrow'],
    ['missing owner', { owner: false }, undefined, 500, 'missing_envelope_meta'],
    ['missing metadata row', { meta: undefined }, undefined, 500, 'missing_envelope_meta'],
    ['null metadata', { meta: null }, undefined, 500, 'missing_envelope_meta'],
    ['invalid JSON metadata', { meta: '{broken' }, undefined, 500, 'invalid_envelope_meta'],
    ['invalid metadata shape', { meta: 'null' }, undefined, 500, 'invalid_envelope_meta'],
    ['corrupt escrow', { escrow: 'broken' }, undefined, 500, 'envelope_create_failed'],
  ]) await t.test(name, async () => {
    reset(patch);
    const out = await request(body);
    assert.equal(out.status, status);
    assert.deepEqual(out.body, { ok: false, error });
  });
  await t.test('missing escrow private key', async () => {
    reset();
    delete process.env.ESCROW_PRIVATE_KEY_PEM;
    const out = await request();
    assert.equal(out.status, 500);
    assert.equal(out.body.error, 'escrow_private_key_missing');
  });
  await t.test('driver-decoded owner metadata is preserved', async () => {
    reset({ meta });
    assert.deepEqual((await request()).body.meta_json, meta);
  });
  await t.test('lookup needs no contact public key', async () => {
    reset();
    const out = await request({ token }, 'share-lookup');
    assert.equal(out.status, 200);
    assert.equal('contact' in out.body, false);
    assert.ok(!queries[0].sql.includes('public_key'));
  });
});
