// Standalone development harness. Never imported by the app or production backend.
import { createServer } from 'vite';
import { constants, generateKeyPairSync, privateDecrypt, publicEncrypt, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.UAC_DEMO_PORT || 8080);
const origin = `http://localhost:${port}`;
const email = 'demo@example.test';
const password = 'VaultDemo2026!';
const pin = '123456';
const session = randomUUID();
const shareToken = randomUUID();
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const files = new Map();
const released = new Map();
let keys = [];
let unlocked = false;
const contacts = [{ id: 'demo-recipient', name: 'Demo Recipient', email: 'recipient@example.test', relationship: 'Family', verified: true, assignedFiles: [], addedAt: new Date().toISOString() }];
const user = { id: 'local-demo', email, name: 'Demo User', email_verified_at: new Date().toISOString(), has_pin: true, has_panic_pin: true };
const settings = { frequency: 'monthly', gracePeriodHours: 48, reminders: 2, lastCheckinAt: new Date().toISOString(), nextDueAt: new Date(Date.now() + 30 * 86400000).toISOString() };
const view = f => ({ key: f.id, id: f.id, name: f.meta?.original_name || f.name, content_type: f.content_type, size_bytes: f.bytes?.length || 0, created_at: f.created_at, include_in_emergency: true, document_template: f.meta?.document_template, has_recipient_note: Boolean(f.meta?.recipient_note) });
const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const fail = (res, error, status = 400) => json(res, { ok: false, error }, status);
const html = (res, body) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Local vault demo</title><style>body{font:18px system-ui;max-width:700px;margin:60px auto;padding:24px;background:#101817;color:#edf6f3}a{color:#a3e4cb}button{font:inherit;padding:12px;border-radius:8px}li{margin:12px 0}</style>${body}`); };
async function body(req) {
  const parts = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024 * 1024) throw new Error('Demo upload limit is 32 MiB');
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}

async function handle(req, res, next) {
  const url = new URL(req.url, origin);
  const p = url.pathname;
  if (!p.startsWith('/auth/') && !p.startsWith('/files/') && !p.startsWith('/__demo')) return next();
  // No external host, cross-origin writes, or production service fallback.
  if (![ `localhost:${port}`, `127.0.0.1:${port}` ].includes(req.headers.host)) return fail(res, 'local_only', 403);
  if (req.headers.origin && ![origin, `http://127.0.0.1:${port}`].includes(req.headers.origin)) return fail(res, 'local_only', 403);
  const signedIn = (req.headers.cookie || '').split(';').some(c => c.trim() === `uac_demo=${session}`);
  const isShare = p.startsWith('/files/share-');
  const publicRoute = ['/__demo', '/auth/login', '/auth/me', '/auth/refresh'].includes(p);
  if (!signedIn && !publicRoute && !isShare) return fail(res, 'not_authenticated', 401);
  if (p === '/__demo' && req.method === 'GET') return html(res, `
    <h1>Local vault demo</h1><p>Simulated account, storage, and delivery. No email, payments, AWS, or production database. Everything resets when this process stops. Use made-up information only.</p>
    <p>Email: <b>${email}</b><br>Password: <b>${password}</b><br>Vault PIN: <b>${pin}</b></p>
    <p>Choose a vault passphrase of at least 8 characters on your first save. For this test, use <b>DemoVault2026!</b> and use the same passphrase to edit or download.</p>
    <ol><li><a href="/login?next=/app/upload">Sign in and create a document</a>, add a recipient note, and save.</li><li><a href="/app/vault">Open the vault</a>, unlock with the PIN, and edit your document.</li><li><a href="/app/emergency-contacts">Assign files to Demo Recipient</a> using the existing controls. Enter the demo account password when asked.</li><li>Use the button below to simulate release of only that recipient's assigned files, then test notes, PDF export, and the ZIP with Start here.pdf.</li></ol>
    <form method="POST" action="/__demo/release"><button>Preview recipient package</button></form>
    <p>Check-ins, billing changes, account changes, and real emails are outside this demo. Press Control+C in Terminal to stop.</p>`);
  if (p === '/__demo/release' && req.method === 'POST') {
    released.clear();
    for (const id of contacts[0].assignedFiles) {
      const f = files.get(id);
      if (f?.bytes && f?.escrow && f?.meta) released.set(id, structuredClone(f));
    }
    if (!released.size) return html(res, '<h1>No assigned files</h1><p>Save a file and assign it to Demo Recipient in <a href="/app/emergency-contacts">Emergency Contacts</a>, then return here.</p><a href="/__demo">Back to demo</a>');
    res.writeHead(303, { Location: `/share#token=${shareToken}` }); return res.end();
  }
  const raw = req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : await body(req);
  const data = req.headers['content-type']?.includes('application/json') && raw.length ? JSON.parse(raw.toString()) : {};
  if (p === '/auth/login') {
    if (data.email !== email || data.password !== password) return fail(res, 'invalid_credentials', 401);
    res.setHeader('Set-Cookie', `uac_demo=${session}; HttpOnly; SameSite=Strict; Path=/`);
    return json(res, { ok: true, user, role: 'user' });
  }
  if (p === '/auth/logout') { res.setHeader('Set-Cookie', 'uac_demo=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); unlocked = false; return json(res, { ok: true }); }
  if (p === '/auth/me' || p === '/auth/refresh') return signedIn ? json(res, { ok: true, user, role: 'user' }) : fail(res, 'not_authenticated', 401);
  if (p === '/auth/unlock-vault') { if (data.pin !== pin) return fail(res, 'incorrect_pin', 403); unlocked = true; return json(res, { ok: true }); }
  if (p === '/auth/billing/status') return json(res, { ok: true, status: 'active', currentPeriodEnd: settings.nextDueAt, stripeSubscriptionId: null });
  if (p === '/auth/billing/summary') return json(res, { ok: true, billing: { storageLimitGb: 5 }, profile: { storageLimitGb: 5 } });
  if (p === '/auth/verification-settings' && req.method === 'GET') return json(res, { ok: true, settings });
  if (p === '/auth/verification-status') return json(res, { ok: true, status: { state: 'ok', nextDueAt: settings.nextDueAt, graceEndsAt: null } });
  if (p === '/auth/verification-checkins') return json(res, { ok: true, checkins: [] });
  if (p === '/auth/emergency-contacts' && req.method === 'GET') return json(res, { ok: true, contacts });
  if (p === '/auth/emergency-contacts/demo-recipient/files' && req.method === 'PUT') {
    if (data.password !== password) return fail(res, 'invalid_credentials', 403);
    contacts[0].assignedFiles = (data.fileIds || []).filter(id => files.has(id));
    return json(res, { ok: true });
  }
  if (isShare) {
    if (p === '/files/share-lookup') {
      const existingShareSession = (req.headers.cookie || '').split(';').some(c => c.trim() === `uac_demo_share=${shareToken}`);
      if (!released.size || (data.token ? data.token !== shareToken : !existingShareSession)) return fail(res, 'invalid_token', 403);
      res.setHeader('Set-Cookie', `uac_demo_share=${shareToken}; HttpOnly; SameSite=Strict; Path=/`);
      return json(res, { ok: true });
    }
    if (!(req.headers.cookie || '').split(';').some(c => c.trim() === `uac_demo_share=${shareToken}`)) return fail(res, 'share_session_required', 401);
    if (p === '/files/share-package') return json(res, { ok: true, files: [...released.values()].map(view) });
    const f = released.get(data.file_id || url.searchParams.get('id'));
    if (!f) return fail(res, 'file_not_found', 404);
    if (p === '/files/share-get-contact-envelope') {
      const key = privateDecrypt({ key: pair.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(f.escrow, 'base64'));
      const enc = publicEncrypt({ key: `-----BEGIN PUBLIC KEY-----\n${data.public_key}\n-----END PUBLIC KEY-----`, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key);
      return json(res, { ok: true, enc_key_b64: enc.toString('base64'), meta_json: f.meta });
    }
    if (p === '/files/share-presign-download') return json(res, { ok: true, url: `/files/share-blob?id=${encodeURIComponent(f.id)}` });
    if (p === '/files/share-blob') { res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' }); return res.end(f.bytes); }
  }
  if (p === '/files/list') return json(res, { ok: true, files: [...files.values()].filter(f => f.meta).map(view) });
  if (p === '/files/vault-keys') {
    if (!unlocked) return fail(res, 'vault_locked', 403);
    if (req.method === 'POST') {
      if (data.initialize && keys.length) return fail(res, 'vault_key_already_exists', 409);
      if (!keys.some(k => k.public_key === data.bundle?.public_key)) keys.push(data.bundle);
    }
    return json(res, { ok: true, keys, public_key: keys[0]?.public_key || null, has_files: [...files.values()].some(f => f.meta) });
  }
  if (p === '/files/escrow-public-key') return json(res, { ok: true, public_key_pem: pair.publicKey.export({ type: 'spki', format: 'pem' }), key_ref: 'local-demo-key' });
  if (!unlocked) return fail(res, 'vault_locked', 403);
  if (p === '/files/presign-upload') {
    const id = randomUUID();
    files.set(id, { id, name: data.filename, content_type: data.contentType, created_at: new Date().toISOString() });
    return json(res, { ok: true, key: id, method: 'POST', url: `/files/demo-upload?id=${id}`, fields: {} });
  }
  const id = data.file_id || data.key || url.searchParams.get('id');
  const f = files.get(id);
  if (!f) return fail(res, 'file_not_found', 404);
  if (p === '/files/demo-upload') {
    const form = await new Request(origin, { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] }, body: raw }).formData();
    f.bytes = Buffer.from(await form.get('file').arrayBuffer()); return json(res, { ok: true });
  }
  if (p === '/files/confirm-upload') return f.bytes ? json(res, { ok: true }) : fail(res, 'missing_upload');
  if (p === '/files/save-file-escrow') { f.escrow = data.enc_key_b64; return json(res, { ok: true }); }
  if (p === '/files/save-user-envelope') { f.envelope = data.enc_key_b64; f.meta = data.meta_json; return json(res, { ok: true }); }
  if (p === '/files/get-user-envelope') return json(res, { ok: true, enc_key_b64: f.envelope, meta_json: f.meta, revision: f.meta.content_revision });
  if (p === '/files/presign-download') return json(res, { ok: true, url: `/files/demo-blob?id=${encodeURIComponent(id)}` });
  if (p === '/files/demo-blob') { res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' }); return res.end(f.bytes); }
  if (p === '/files/update-content') {
    if (data.expected_revision !== f.meta.content_revision) return fail(res, 'stale_revision', 409);
    f.meta.recipient_note = data.recipient_note;
    if (data.ciphertext_b64) { f.bytes = Buffer.from(data.ciphertext_b64, 'base64'); f.meta.original_name = data.original_name; }
    f.meta.content_revision = randomUUID();
    return json(res, { ok: true, meta_json: f.meta, revision: f.meta.content_revision });
  }
  if (p === '/files/delete') { files.delete(id); contacts[0].assignedFiles = contacts[0].assignedFiles.filter(key => key !== id); return json(res, { ok: true }); }
  return fail(res, 'not_supported_in_local_demo', 501);
}

const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  mode: 'local-demo',
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port, strictPort: true, open: '/__demo' },
  plugins: [{
    name: 'isolated-local-vault-demo',
    configureServer(vite) {
      // Runs before Vite's normal proxy middleware. All API calls stop here.
      vite.middlewares.use((req, res, next) => { handle(req, res, next).catch(() => fail(res, 'local_demo_request_failed', 400)); });
    },
    transformIndexHtml() { return [{ tag: 'div', attrs: { style: 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#fde68a;color:#17221f;padding:5px;text-align:center;font:13px system-ui' }, children: 'LOCAL DEMO · Resets on restart · No email or payments · ', injectTo: 'body' }, { tag: 'a', attrs: { href: '/__demo', style: 'position:fixed;bottom:24px;right:8px;z-index:99999;background:#fde68a;color:#17221f;padding:8px;border-radius:8px;font:14px system-ui' }, children: 'Demo instructions & recipient preview', injectTo: 'body' }]; },
  }],
});
await server.listen();
console.log(`\nLocal demo: ${origin}/__demo\nEmail: ${email}\nPassword: ${password}\nPIN: ${pin}\nSuggested vault passphrase: DemoVault2026!\nMemory only. Control+C stops and erases the demo.\n`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
