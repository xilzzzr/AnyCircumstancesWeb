const crypto = require('crypto');

function validateBundle(input) {
  if (!input || input.version !== 1 || input.kdf !== 'PBKDF2-SHA256' || input.iterations !== 200000 || input.private_key_format !== 'pkcs8') {
    throw new Error('invalid_vault_key');
  }
  const bytes = (name, min, max) => {
    const value = input[name];
    if (typeof value !== 'string' || value.length > max * 2 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('invalid_vault_key');
    const data = Buffer.from(value, 'base64');
    if (data.length < min || data.length > max || data.toString('base64') !== value) throw new Error('invalid_vault_key');
    return data;
  };
  const publicKey = bytes('public_key', 256, 1024);
  const key = crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength !== 2048) throw new Error('invalid_vault_key');
  bytes('encrypted_private_key', 1000, 4096);
  bytes('salt', 16, 16);
  bytes('iv', 12, 12);
  return {
    version: 1, kdf: 'PBKDF2-SHA256', iterations: 200000, private_key_format: 'pkcs8',
    public_key: publicKey.toString('base64'), encrypted_private_key: input.encrypted_private_key,
    salt: input.salt, iv: input.iv,
  };
}

function registerVaultKeyRoutes(router, requireUser, getPool, asyncHandler) {
  router.get('/vault-keys', requireUser, asyncHandler(async (req, res) => {
    const pool = getPool();
    const [users] = await pool.query('SELECT public_key FROM users WHERE id = ? AND status = \'active\' LIMIT 1', [req.userId]);
    if (!users.length) return res.status(401).json({ ok: false, error: 'not_authenticated' });
    const [rows] = await pool.query('SELECT bundle_json FROM user_vault_keys WHERE user_id = ? ORDER BY created_at, key_id', [req.userId]);
    const [files] = await pool.query('SELECT id FROM files WHERE user_id = ? LIMIT 1', [req.userId]);
    res.json({ ok: true, user_id: String(req.userId), public_key: users[0].public_key || null, has_files: files.length > 0,
      keys: rows.map((row) => typeof row.bundle_json === 'string' ? JSON.parse(row.bundle_json) : row.bundle_json) });
  }));

  router.post('/vault-keys', requireUser, asyncHandler(async (req, res) => {
    let bundle;
    try { bundle = validateBundle(req.body?.bundle); }
    catch { return res.status(400).json({ ok: false, error: 'invalid_vault_key' }); }
    const keyId = crypto.createHash('sha256').update(Buffer.from(bundle.public_key, 'base64')).digest('hex');
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      const [users] = await conn.query('SELECT id FROM users WHERE id = ? AND status = \'active\' FOR UPDATE', [req.userId]);
      if (!users.length) { await conn.rollback(); return res.status(401).json({ ok: false, error: 'not_authenticated' }); }
      const [rows] = await conn.query('SELECT key_id FROM user_vault_keys WHERE user_id = ?', [req.userId]);
      // Never replace a backed-up key. Concurrent first-time setup uses the winning key.
      if (!rows.some((row) => row.key_id === keyId)) {
        if (req.body?.initialize === true && rows.length) {
          await conn.rollback();
          return res.status(409).json({ ok: false, error: 'vault_key_already_exists' });
        }
        if (rows.length >= 20) { await conn.rollback(); return res.status(409).json({ ok: false, error: 'vault_key_limit' }); }
        await conn.query('INSERT INTO user_vault_keys (user_id, key_id, bundle_json) VALUES (?, ?, ?)', [req.userId, keyId, JSON.stringify(bundle)]);
        const publicPem = crypto.createPublicKey({ key: Buffer.from(bundle.public_key, 'base64'), type: 'spki', format: 'der' }).export({ type: 'spki', format: 'pem' });
        await conn.query('UPDATE users SET public_key = COALESCE(public_key, ?) WHERE id = ?', [publicPem, req.userId]);
      }
      await conn.commit();
      res.json({ ok: true });
    } catch (error) { await conn.rollback(); throw error; }
    finally { conn.release(); }
  }));
}
module.exports = { validateBundle, registerVaultKeyRoutes };
