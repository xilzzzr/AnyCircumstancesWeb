import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function loadModule(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const vault = await loadModule('src/lib/vaultCrypto.ts');
const { decryptUacBytes } = await loadModule('src/lib/uacChunk.ts');
const { decryptVaultFile } = await loadModule('src/lib/vaultDownload.ts');
const { loadAuthSession } = await loadModule('src/lib/authSession.ts');
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};

test('encrypted files round-trip byte-for-byte, including empty and multi-chunk files', async () => {
  for (const size of [0, 321, 4 * 1024 * 1024 + 123]) {
    const original = Uint8Array.from({ length: size }, (_, i) => i % 251);
    const encrypted = await vault.encryptFileToAesGcm(new File([original], 'original.bin'));
    const key = await crypto.subtle.importKey('raw', encrypted.rawAes, 'AES-GCM', false, ['decrypt']);
    const bytes = new Uint8Array(await encrypted.blob.arrayBuffer());
    assert.deepEqual(await decryptUacBytes(key, bytes, {}), original);
    if (size > 0) {
      await assert.rejects(decryptUacBytes(key, bytes.slice(0, -1), {}));
      const corrupt = bytes.slice();
      corrupt[corrupt.length - 1] ^= 1;
      await assert.rejects(decryptUacBytes(key, corrupt, {}));
    }
    const extra = new Uint8Array(bytes.length + 1);
    extra.set(bytes);
    await assert.rejects(decryptUacBytes(key, extra, {}));
  }
});

test('legacy AES-GCM files still decrypt', async () => {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = vault.randomBytes(12);
  const original = new TextEncoder().encode('legacy content');
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, original));
  assert.deepEqual(await decryptUacBytes(key, encrypted, { iv_b64: vault.b64FromBytes(iv) }), original);
});

test('download unwraps the saved key and preserves original name, type and contents', async (t) => {
  storage.clear();
  const bundle = await vault.createVaultKeyBundle('correct passphrase');
  const keys = await vault.unlockVaultKeyBundle(bundle, 'correct passphrase');
  const file = new File(['Hello, decrypted world!'], 'hello.txt', { type: 'text/plain' });
  const encrypted = await vault.encryptFileToAesGcm(file);
  const envelope = {
    ok: true,
    enc_key_b64: await vault.wrapAesKeyForUser(keys.pubKey, encrypted.rawAes),
    meta_json: { original_name: file.name, original_content_type: file.type },
  };
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url === '/files/vault-keys') return Response.json({ ok: true, user_id: '1', keys: [bundle], public_key: bundle.public_key, has_files: true });
    if (url === '/files/get-user-envelope') return Response.json(envelope);
    if (url === '/files/presign-download') return Response.json({ ok: true, url: 'https://storage.example/file' });
    if (url === 'https://storage.example/file') return new Response(encrypted.blob);
    assert.fail(`Unexpected request ${url}`);
  });
  const downloaded = await decryptVaultFile({ key: 'file', name: 'fallback', content_type: '' }, 'correct passphrase');
  assert.equal(downloaded.name, file.name);
  assert.equal(downloaded.blob.type, file.type);
  assert.equal(await downloaded.blob.text(), await file.text());
  await assert.rejects(decryptVaultFile({ key: 'file' }, 'wrong passphrase'), /bad_passphrase/);
});

for (const expiredStatus of [200, 401]) test(`concurrent expired-session checks (${expiredStatus}) rotate the refresh token only once`, async (t) => {
  const calls = [];
  let refreshed = false;
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    if (url === '/auth/refresh') { refreshed = true; return Response.json({ ok: true }); }
    return refreshed ? Response.json({ ok: true, role: 'user', user: { id: '1' } }) : Response.json({ ok: false }, { status: expiredStatus });
  });
  const sessions = await Promise.all([loadAuthSession(), loadAuthSession()]);
  assert.deepEqual(calls, ['/auth/me', '/auth/refresh', '/auth/me']);
  assert.equal(sessions[0].user.id, '1');
  assert.deepEqual(sessions[0], sessions[1]);
});

test('non-auth session errors do not trigger refresh-token rotation', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => { calls.push(url); return new Response('', { status: 429 }); });
  assert.deepEqual(await loadAuthSession(), { ok: false });
  assert.deepEqual(calls, ['/auth/me']);
});

function mockKeyServer(t, state) {
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    assert.equal(url, '/files/vault-keys');
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal('passphrase' in body, false);
      if (body.initialize && state.keys.length) return Response.json({ error: 'vault_key_already_exists' }, { status: 409 });
      if (!state.keys.some((key) => key.public_key === body.bundle.public_key)) state.keys.push(body.bundle);
      state.public_key ||= body.bundle.public_key;
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true, user_id: '1', ...state });
  });
}

function storeLegacy(bundle) {
  storage.set('uac_user_pub_spki_b64', bundle.public_key);
  storage.set('uac_user_priv_pkcs8_enc_b64', bundle.encrypted_private_key);
  storage.set('uac_user_priv_salt_b64', bundle.salt);
  storage.set('uac_user_priv_iv_b64', bundle.iv);
}

test('fresh devices and clearing all local storage retain access to the same key', async (t) => {
  storage.clear();
  const state = { keys: [], public_key: null, has_files: false };
  mockKeyServer(t, state);
  const [first, second] = await Promise.all([vault.ensureUserKeypair('shared passphrase'), vault.ensureUserKeypair('shared passphrase')]);
  assert.equal(state.keys.length, 1);
  assert.equal(first.pubSpkiB64, second.pubSpkiB64);
  storage.clear();
  const restored = await vault.ensureUserKeypair('shared passphrase', false);
  assert.equal(first.pubSpkiB64, restored.pubSpkiB64);
  await assert.rejects(vault.ensureUserKeypair('wrong passphrase', false), /bad_passphrase/);
  assert.equal(state.keys.length, 1);
});

test('an existing browser key is backed up without changing its identity', async (t) => {
  const bundle = await vault.createVaultKeyBundle('legacy passphrase');
  storeLegacy(bundle);
  const state = { keys: [], public_key: bundle.public_key, has_files: true };
  mockKeyServer(t, state);
  const migrated = await vault.ensureUserKeypair('legacy passphrase', false);
  assert.equal(migrated.pubSpkiB64, bundle.public_key);
  assert.deepEqual(state.keys, [bundle]);
  storage.clear();
  assert.equal((await vault.ensureUserKeypair('legacy passphrase', false)).pubSpkiB64, bundle.public_key);
});

test('missing legacy keys never silently create replacement keys', async (t) => {
  storage.clear();
  const state = { keys: [], public_key: 'legacy-key', has_files: true };
  mockKeyServer(t, state);
  await assert.rejects(vault.ensureUserKeypair('new passphrase'), /missing_vault_key/);
  assert.equal(state.keys.length, 0);
});

test('legacy storage from a different account is not migrated into a new account', async (t) => {
  const other = await vault.createVaultKeyBundle('shared passphrase');
  storeLegacy(other);
  const state = { keys: [], public_key: null, has_files: false };
  mockKeyServer(t, state);
  const own = await vault.ensureUserKeypair('shared passphrase');
  assert.notEqual(own.pubSpkiB64, other.public_key);
  assert.equal(state.keys.length, 1);
  storage.clear();
});

test('multiple historical keys select the key that opens the requested file', async (t) => {
  storage.clear();
  const one = await vault.createVaultKeyBundle('shared passphrase');
  const two = await vault.createVaultKeyBundle('shared passphrase');
  const keys = await vault.unlockVaultKeyBundle(two, 'shared passphrase');
  const wrapped = await vault.wrapAesKeyForUser(keys.pubKey, vault.randomBytes(32));
  mockKeyServer(t, { keys: [one, two], public_key: one.public_key, has_files: true });
  assert.equal((await vault.ensureUserKeypair('shared passphrase', false, wrapped)).pubSpkiB64, two.public_key);
});
