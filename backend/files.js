// files.js
const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { rateLimit } = require("express-rate-limit");

const router = express.Router();

function rateKey(req) {
  return `u:${String(req.userId || "")}`;
}

const presignUploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateKey,
  handler: (req, res) => res.status(429).json({ ok: false, error: "rate_limited" }),
});

const confirmUploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateKey,
  handler: (req, res) => res.status(429).json({ ok: false, error: "rate_limited" }),
});

const presignDownloadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateKey,
  handler: (req, res) => res.status(429).json({ ok: false, error: "rate_limited" }),
});

const deleteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateKey,
  handler: (req, res) => res.status(429).json({ ok: false, error: "rate_limited" }),
});

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function getPool() {
  const a = require("./auth");
  return a.authPool;
}

function getS3() {
  const region = String(process.env.AWS_REGION || "").trim();
  if (!region) throw new Error("AWS_REGION missing");
  return new S3Client({ region });
}

function safeFilename(name) {
  const s = String(name || "").trim() || "upload.bin";
  const base = s.split("/").pop().split("\\").pop();
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned || "upload.bin";
}

function requireUser(req, res, next) {
  const access = req.cookies?.access_token ? String(req.cookies.access_token) : "";
  if (!access) return res.status(401).json({ ok: false, error: "not_authenticated" });

  const secret = process.env.JWT_ACCESS_SECRET || "";
  if (!secret) return res.status(500).json({ ok: false, error: "server_misconfig" });

  try {
    const payload = jwt.verify(access, secret);
    const userId = payload?.sub ? String(payload.sub) : "";
    if (!userId) return res.status(401).json({ ok: false, error: "invalid_session" });
    req.userId = userId;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_session" });
  }
}

async function requireActiveSubscription(req, res) {
  const userId = String(req.userId || "");
  if (!userId) {
    res.status(401).json({ ok: false, error: "not_authenticated" });
    return null;
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT EXISTS(
       SELECT 1 FROM billing_entitlements
       WHERE user_id = ? AND status = 'active'
         AND (current_period_end IS NULL OR current_period_end > UTC_TIMESTAMP(3))
     ) AS has_active`,
    [userId]
  );
  if (!rows?.[0]?.has_active) {
    res.status(402).json({ ok: false, error: "payment_required" });
    return null;
  }

  return userId;
}

function requirePaid(req, res, next) {
  Promise.resolve(requireActiveSubscription(req, res))
    .then((userId) => {
      if (!userId) return;
      next();
    })
    .catch((e) => {
      console.error("[requirePaid]", e && (e.stack || e));
      res.status(500).json({ ok: false, error: "server_error" });
    });
}
function getEscrowPrivateKeyPem() {
  return String(process.env.ESCROW_PRIVATE_KEY_PEM || "").replace(/\\n/g, "\n").trim();
}

function normalizePublicKeyPem(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  // If it's already PEM, normalize newlines and validate.
  if (raw.includes("BEGIN PUBLIC KEY")) {
    try {
      const pem = raw.replace(/\\n/g, "\n").trim();
      return crypto.createPublicKey(pem).export({ type: "spki", format: "pem" }).toString();
    } catch {
      return null;
    }
  }

  // Otherwise assume it's base64 DER (what your DB currently has).
  const b64 = raw.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return null;

  const wrapped = (b64.match(/.{1,64}/g) || []).join("\n");
  const pem = `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----\n`;

  try {
    return crypto.createPublicKey(pem).export({ type: "spki", format: "pem" }).toString();
  } catch {
    return null;
  }
}


function getEscrowPublicKeyPem() {
  const privPem = getEscrowPrivateKeyPem();
  if (!privPem) return null;

  const privKeyObj = crypto.createPrivateKey(privPem);
  const pubKeyObj = crypto.createPublicKey(privKeyObj);

  return pubKeyObj.export({ type: "spki", format: "pem" }).toString();
}

router.get(
  "/escrow-public-key",
  asyncHandler(async (req, res) => {
    const pub = getEscrowPublicKeyPem();
    if (!pub) return res.status(500).json({ ok: false, error: "escrow_private_key_missing" });
    return res.json({ ok: true, public_key_pem: pub });
  })
);

router.post(
  "/save-file-escrow",
  requireUser,
  requirePaid,
  asyncHandler(async (req, res) => {
    const fileId = String(req.body?.file_id || "");
    const alg = String(req.body?.alg || "").trim();
    const encKeyB64 = String(req.body?.enc_key_b64 || "").trim();

    if (!fileId) return res.status(400).json({ ok: false, error: "missing_file_id" });

    const prefix = "users/" + req.userId + "/";
    if (!fileId.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

    if (!alg || alg.length > 32) return res.status(400).json({ ok: false, error: "invalid_alg" });
    if (!encKeyB64 || encKeyB64.length > 20000) return res.status(400).json({ ok: false, error: "invalid_enc_key" });

    const pool = getPool();

    const [frows] = await pool.query("SELECT id FROM files WHERE id = ? AND user_id = ? LIMIT 1", [fileId, req.userId]);
    if (!frows || !frows.length) return res.status(404).json({ ok: false, error: "file_not_found" });

    await pool.query(
      "INSERT INTO file_key_escrows (file_id, alg, enc_key_b64) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE alg=VALUES(alg), enc_key_b64=VALUES(enc_key_b64)",
      [fileId, alg, encKeyB64]
    );

    return res.json({ ok: true });
  })
);


/**
 * Decrypt escrowed per-file key using ESCROW_PRIVATE_KEY_PEM and re-encrypt for a contact public key.
 * Returns { alg, enc_key_b64 } or throws.
 */
function buildContactEnvelopeFromEscrow({ escrowAlg, escrowEncKeyB64, contactPublicKeyPem, escrowPrivateKeyPem }) {
  const encEscrowBuf = Buffer.from(String(escrowEncKeyB64), "base64");

  const plainKeyBuf = crypto.privateDecrypt(
    { key: escrowPrivateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    encEscrowBuf
  );

  let pubInput = String(contactPublicKeyPem || "").trim();
  if (!pubInput) throw new Error("contact_public_key_missing");

  if (!pubInput.includes("BEGIN")) {
    pubInput = "-----BEGIN PUBLIC KEY-----\n" + pubInput.match(/.{1,64}/g).join("\n") + "\n-----END PUBLIC KEY-----\n";
  }

  const pubKeyObj = crypto.createPublicKey(pubInput);

  const normalizedContactPem = normalizePublicKeyPem(contactPublicKeyPem);
  if (!normalizedContactPem) throw new Error("invalid_contact_public_key");

const contactKeyStr = String(contactPublicKeyPem || "").trim();

const contactKeyObj = contactKeyStr.includes("BEGIN PUBLIC KEY")
  ? crypto.createPublicKey(contactKeyStr.replace(/\\n/g, "\n"))
  : crypto.createPublicKey({ key: Buffer.from(contactKeyStr, "base64"), format: "der", type: "spki" });

const encForContactBuf = crypto.publicEncrypt(
  { key: contactKeyObj, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
  plainKeyBuf
);

  return { alg: String(escrowAlg || "rsa-oaep-sha256"), enc_key_b64: encForContactBuf.toString("base64") };
}

/**
 * Loads ESCROW_PRIVATE_KEY_PEM from env. Supports multiline pasted PEM via \n.
 */
function getEscrowPrivateKeyPemOrNull() {
  const raw = String(process.env.ESCROW_PRIVATE_KEY_PEM || "").trim();
  if (!raw) return null;
  return raw.replace(/\\n/g, "\n").trim();
}

router.get(
  "/health",
  asyncHandler(async (req, res) => {
    return res.json({ ok: true });
  })
);

router.post(
  "/set-user-public-key",
  requireUser,
  requirePaid,
  asyncHandler(async (req, res) => {
	const publicKey = String(req.body?.public_key || "").replace(/\\n/g, "\n").trim();
    if (!publicKey) return res.status(400).json({ ok: false, error: "missing_public_key" });
    if (publicKey.length > 20000) return res.status(400).json({ ok: false, error: "public_key_too_large" });

    const pool = getPool();
    await pool.query("UPDATE users SET public_key = ? WHERE id = ? LIMIT 1", [publicKey, req.userId]);

    return res.json({ ok: true });
  })
);

router.get(
  "/me-public-key",
  requireUser,
  requirePaid,
  asyncHandler(async (req, res) => {
    const pool = getPool();
    const [rows] = await pool.query("SELECT public_key FROM users WHERE id = ? LIMIT 1", [req.userId]);
    const publicKey = rows?.[0]?.public_key ? String(rows[0].public_key) : null;
    return res.json({ ok: true, public_key: publicKey });
  })
);

router.post(
  "/presign-upload",
  requireUser,
  requirePaid,
  presignUploadLimiter,

  asyncHandler(async (req, res) => {
    const bucket = String(process.env.S3_BUCKET || "").trim();
    if (!bucket) return res.status(500).json({ ok: false, error: "S3_BUCKET missing" });

    const region = String(process.env.AWS_REGION || "").trim();
    if (!region) return res.status(500).json({ ok: false, error: "AWS_REGION missing" });

    const filename = safeFilename(req.body?.filename);
    const originalContentType = String(req.body?.contentType || "application/octet-stream").slice(0, 255);

    const key = "users/" + req.userId + "/uploads/" + crypto.randomUUID();
    const uploadContentType = "application/octet-stream";

    const s3 = new S3Client({ region });

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: uploadContentType,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 600 });

    const pool = getPool();
    await pool.query("INSERT INTO files (id, user_id, bucket, content_type, size_bytes) VALUES (?, ?, ?, ?, NULL)", [
      key,
      req.userId,
      bucket,
      originalContentType,
    ]);

    return res.json({
      ok: true,
      method: "PUT",
      url,
      key,
      filename,
      headers: { "Content-Type": uploadContentType },
    });
  })
);

router.post(
  "/delete",
  requireUser,
  requirePaid,
  deleteLimiter,

  asyncHandler(async (req, res) => {
    const region = String(process.env.AWS_REGION || "").trim();
    if (!region) return res.status(500).json({ ok: false, error: "AWS_REGION missing" });

    const key = String(req.body?.key || "");
    const prefix = "users/" + req.userId + "/";
    if (!key.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

    const pool = getPool();

    const [rows] = await pool.query("SELECT bucket FROM files WHERE id = ? AND user_id = ? LIMIT 1", [
      key,
      req.userId,
    ]);
    if (!rows || !rows.length) return res.status(404).json({ ok: false, error: "file_not_found" });

    const bucket = String(rows[0].bucket || "").trim();
    if (!bucket) return res.status(500).json({ ok: false, error: "missing_bucket" });

    const s3 = new S3Client({ region });
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

    await pool.query("DELETE FROM contact_file_share_tokens WHERE file_id = ?", [key]);
    await pool.query("DELETE FROM emergency_contact_file_assignments WHERE file_id = ?", [key]);
    await pool.query("DELETE FROM file_key_envelopes WHERE file_id = ?", [key]);
    await pool.query("DELETE FROM file_key_escrows WHERE file_id = ?", [key]);
    await pool.query("DELETE FROM files WHERE id = ? AND user_id = ? LIMIT 1", [key, req.userId]);

    return res.json({ ok: true });
  })
);


router.post(
  "/confirm-upload",
  requireUser,
  requirePaid,
  confirmUploadLimiter,

  asyncHandler(async (req, res) => {
    const key = String(req.body?.key || "");
    const sizeBytes = Number(req.body?.size_bytes);
	const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 209715200);

    const prefix = "users/" + req.userId + "/";
    if (!key.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
  return res.status(400).json({ ok: false, error: "invalid_size" });
}
if (!Number.isFinite(maxUploadBytes) || maxUploadBytes <= 0) {
  return res.status(500).json({ ok: false, error: "server_misconfig" });
}
if (sizeBytes > maxUploadBytes) {
  return res.status(413).json({ ok: false, error: "file_too_large" });
}

    const pool = getPool();
    const [r] = await pool.query("UPDATE files SET size_bytes = ? WHERE id = ? AND user_id = ? LIMIT 1", [
      sizeBytes,
      key,
      req.userId,
    ]);

    const changed = r && typeof r.affectedRows === "number" ? r.affectedRows : 0;
    if (!changed) return res.status(404).json({ ok: false, error: "file_not_found" });

    return res.json({ ok: true });
  })
);

router.post(
  "/presign-download",
  requireUser,
  requirePaid,
  presignDownloadLimiter,

  asyncHandler(async (req, res) => {
    const bucket = String(process.env.S3_BUCKET || "").trim();
    if (!bucket) return res.status(500).json({ ok: false, error: "S3_BUCKET missing" });

    const region = String(process.env.AWS_REGION || "").trim();
    if (!region) return res.status(500).json({ ok: false, error: "AWS_REGION missing" });

    const key = String(req.body?.key || "");
    const prefix = "users/" + req.userId + "/";
    if (!key.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

    const s3 = new S3Client({ region });

    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 600 });

    return res.json({ ok: true, url });
  })
);

router.post(
  "/save-user-envelope",
  requireUser,
  requirePaid,
  asyncHandler(async (req, res) => {
    const fileId = String(req.body?.file_id || "");
    const alg = String(req.body?.alg || "");
    const encKeyB64 = String(req.body?.enc_key_b64 || "");
    const metaJson = req.body?.meta_json ? JSON.stringify(req.body.meta_json) : null;

    if (!fileId) return res.status(400).json({ ok: false, error: "missing_file_id" });

    const prefix = "users/" + req.userId + "/";
    if (!fileId.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

    if (!alg || alg.length > 32) return res.status(400).json({ ok: false, error: "invalid_alg" });
    if (!encKeyB64 || encKeyB64.length > 20000) return res.status(400).json({ ok: false, error: "invalid_enc_key" });

    const pool = getPool();
    await pool.query(
      "INSERT INTO file_key_envelopes (file_id, recipient_type, recipient_id, alg, enc_key_b64, meta_json) VALUES (?, 'user', ?, ?, ?, ?) ON DUPLICATE KEY UPDATE alg=VALUES(alg), enc_key_b64=VALUES(enc_key_b64), meta_json=VALUES(meta_json)",
      [fileId, req.userId, alg, encKeyB64, metaJson]
    );

    return res.json({ ok: true });
  })
);

router.post(
  "/get-user-envelope",
  requireUser,
  requirePaid,
  asyncHandler(async (req, res) => {
    const fileId = String(req.body?.file_id || "");
    if (!fileId) return res.status(400).json({ ok: false, error: "missing_file_id" });

    const prefix = "users/" + req.userId + "/";
    if (!fileId.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT alg, enc_key_b64, meta_json FROM file_key_envelopes WHERE file_id = ? AND recipient_type = 'user' AND recipient_id = ? LIMIT 1",
      [fileId, req.userId]
    );

    if (!rows || !rows.length) return res.status(404).json({ ok: false, error: "no_envelope" });

    let meta = null;
    try {
      meta = rows[0].meta_json ? JSON.parse(String(rows[0].meta_json)) : null;
    } catch {
      meta = null;
    }

    return res.json({
      ok: true,
      alg: String(rows[0].alg),
      enc_key_b64: String(rows[0].enc_key_b64),
      meta_json: meta,
    });
  })
);

router.post(
  "/create-contact-share-link",
  requireUser,
  requirePaid,
  asyncHandler(async (req, res) => {
    const contactId = Number(req.body?.contact_id || 0);
    const fileId = String(req.body?.file_id || "");

    if (!contactId) return res.status(400).json({ ok: false, error: "missing_contact_id" });
    if (!fileId) return res.status(400).json({ ok: false, error: "missing_file_id" });

    const prefix = "users/" + req.userId + "/";
    if (!fileId.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

    const pool = getPool();

    const [crows] = await pool.query("SELECT id, user_id, email, verified_at FROM emergency_contacts WHERE id = ? LIMIT 1", [
      contactId,
    ]);
    if (!crows || !crows.length) return res.status(404).json({ ok: false, error: "contact_not_found" });
    if (String(crows[0].user_id) !== String(req.userId)) return res.status(403).json({ ok: false, error: "forbidden" });

    const [arows] = await pool.query(
      "SELECT 1 FROM emergency_contact_file_assignments WHERE contact_id = ? AND file_id = ? LIMIT 1",
      [contactId, fileId]
    );
    if (!arows || !arows.length) return res.status(400).json({ ok: false, error: "file_not_assigned_to_contact" });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date("9999-12-31T23:59:59Z");

    await pool.query("INSERT INTO contact_file_share_tokens (contact_id, file_id, token_hash, expires_at) VALUES (?, ?, ?, ?)", [
      contactId,
      fileId,
      tokenHash,
      new Date(Date.now() + 1000*60*60*24*365*10)
    ]);

    const publicBase = String(process.env.PUBLIC_APP_BASE_URL || "https://anycircumstances.com").replace(/\/+$/, "");
    const link = publicBase + "/share/" + token;

    return res.json({
      ok: true,
      link,
      contact: { id: crows[0].id, email: crows[0].email, verified_at: crows[0].verified_at },
    });
  })
);

router.post(
  "/share-lookup",
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || "");
    if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

    const tokenHash = sha256Hex(token);
    const pool = getPool();

    const [rows] = await pool.query(
      "SELECT t.contact_id, t.file_id, t.expires_at, t.used_at, c.email, c.verified_at, c.public_key AS contact_public_key, f.user_id AS owner_user_id, f.content_type, f.created_at AS file_created_at FROM contact_file_share_tokens t JOIN emergency_contacts c ON c.id = t.contact_id JOIN files f ON f.id = t.file_id WHERE t.token_hash = ? LIMIT 1",
      [tokenHash]
    );

    if (!rows || !rows.length) return res.status(404).json({ ok: false, error: "invalid_token" });

    const r = rows[0];
    if (new Date(r.expires_at).getTime() < Date.now()) return res.status(410).json({ ok: false, error: "token_expired" });

    return res.json({
      ok: true,
      contact: {
        id: Number(r.contact_id),
        email: String(r.email),
        verified_at: r.verified_at,
        has_public_key: Boolean(r.contact_public_key),
      },
      file: {
        id: String(r.file_id),
        owner_user_id: Number(r.owner_user_id),
        content_type: String(r.content_type),
        created_at: r.file_created_at,
      },
      token: {
        expires_at: r.expires_at,
        used_at: r.used_at,
      },
    });
  })
);

router.post(
  "/share-set-contact-public-key",
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || "");
    const publicKey = String(req.body?.public_key || "").trim();

    if (!token) return res.status(400).json({ ok: false, error: "missing_token" });
    if (!publicKey) return res.status(400).json({ ok: false, error: "missing_public_key" });
    if (publicKey.length > 20000) return res.status(400).json({ ok: false, error: "public_key_too_large" });

    const tokenHash = sha256Hex(token);
    const pool = getPool();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [trows] = await conn.query(
        "SELECT id, contact_id, file_id, expires_at, used_at FROM contact_file_share_tokens WHERE token_hash = ? LIMIT 1 FOR UPDATE",
        [tokenHash]
      );

      if (!trows || !trows.length) {
        await conn.rollback();
        return res.status(404).json({ ok: false, error: "invalid_token" });
      }

      const t = trows[0];
      if (new Date(t.expires_at).getTime() < Date.now()) {
        await conn.rollback();
        return res.status(410).json({ ok: false, error: "token_expired" });
      }

      await conn.query(
        "UPDATE emergency_contacts SET public_key = ?, verified_at = COALESCE(verified_at, NOW()) WHERE id = ? LIMIT 1",
        [publicKey, t.contact_id]
      );

      const [erows] = await conn.query("SELECT alg, enc_key_b64 FROM file_key_escrows WHERE file_id = ? LIMIT 1", [t.file_id]);
      if (!erows || !erows.length || !erows[0].enc_key_b64) {
        await conn.rollback();
        return res.status(500).json({ ok: false, error: "missing_file_escrow" });
      }

      const privPem = getEscrowPrivateKeyPemOrNull();
      if (!privPem) {
        await conn.rollback();
        return res.status(500).json({ ok: false, error: "escrow_private_key_missing" });
      }

      const envelope = buildContactEnvelopeFromEscrow({
        escrowAlg: String(erows[0].alg || "rsa-oaep-sha256"),
        escrowEncKeyB64: String(erows[0].enc_key_b64),
        contactPublicKeyPem: publicKey,
        escrowPrivateKeyPem: privPem,
      });

const [ownerRows] = await conn.query("SELECT user_id FROM files WHERE id = ? LIMIT 1", [t.file_id]);
const ownerUserId = ownerRows && ownerRows.length ? String(ownerRows[0].user_id) : "";
if (!ownerUserId) {
  await conn.rollback();
  return res.status(500).json({ ok: false, error: "missing_file_owner" });
}

const [metaRows] = await conn.query(
  "SELECT meta_json FROM file_key_envelopes WHERE file_id = ? AND recipient_type = 'user' AND recipient_id = ? LIMIT 1",
  [t.file_id, ownerUserId]
);

const metaJson = metaRows && metaRows.length && metaRows[0].meta_json ? String(metaRows[0].meta_json) : null;
if (!metaJson) {
  await conn.rollback();
  return res.status(500).json({ ok: false, error: "missing_envelope_meta" });
}

await conn.query(
  "INSERT INTO file_key_envelopes (file_id, recipient_type, recipient_id, alg, enc_key_b64, meta_json) VALUES (?, 'contact', ?, ?, ?, ?) ON DUPLICATE KEY UPDATE alg=VALUES(alg), enc_key_b64=VALUES(enc_key_b64), meta_json=VALUES(meta_json)",
  [t.file_id, t.contact_id, envelope.alg, envelope.enc_key_b64, metaJson]
);

      await conn.query("UPDATE contact_file_share_tokens SET used_at = COALESCE(used_at, NOW()) WHERE id = ? LIMIT 1", [t.id]);

      await conn.commit();
      return res.json({ ok: true, contact_id: Number(t.contact_id), file_id: String(t.file_id) });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }
  })
);

router.get(
  "/contact-public-key",
  requireUser,
  requirePaid,
  asyncHandler(async (req, res) => {
    const contactId = Number(req.query?.contact_id || 0);
    if (!contactId) return res.status(400).json({ ok: false, error: "missing_contact_id" });

    const pool = getPool();
    const [rows] = await pool.query("SELECT id, user_id, email, verified_at, public_key FROM emergency_contacts WHERE id = ? LIMIT 1", [
      contactId,
    ]);

    if (!rows || !rows.length) return res.status(404).json({ ok: false, error: "contact_not_found" });
    if (String(rows[0].user_id) !== String(req.userId)) return res.status(403).json({ ok: false, error: "forbidden" });

    return res.json({
      ok: true,
      contact: {
        id: Number(rows[0].id),
        email: String(rows[0].email),
        verified_at: rows[0].verified_at,
        public_key: rows[0].public_key ? String(rows[0].public_key) : null,
      },
    });
  })
);

router.post(
  "/save-contact-envelope",
  requireUser,
  requirePaid,
  asyncHandler(async (req, res) => {
    const contactId = Number(req.body?.contact_id || 0);
    const fileId = String(req.body?.file_id || "");
    const alg = String(req.body?.alg || "");
    const encKeyB64 = String(req.body?.enc_key_b64 || "");
    const metaJson = req.body?.meta_json ? JSON.stringify(req.body.meta_json) : null;

    if (!contactId) return res.status(400).json({ ok: false, error: "missing_contact_id" });
    if (!fileId) return res.status(400).json({ ok: false, error: "missing_file_id" });

    const prefix = "users/" + req.userId + "/";
    if (!fileId.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

    if (!alg || alg.length > 32) return res.status(400).json({ ok: false, error: "invalid_alg" });
    if (!encKeyB64 || encKeyB64.length > 20000) return res.status(400).json({ ok: false, error: "invalid_enc_key" });

    const pool = getPool();

    const [crows] = await pool.query("SELECT id, user_id FROM emergency_contacts WHERE id = ? LIMIT 1", [contactId]);
    if (!crows || !crows.length) return res.status(404).json({ ok: false, error: "contact_not_found" });
    if (String(crows[0].user_id) !== String(req.userId)) return res.status(403).json({ ok: false, error: "forbidden" });

    const [arows] = await pool.query(
      "SELECT 1 FROM emergency_contact_file_assignments WHERE contact_id = ? AND file_id = ? LIMIT 1",
      [contactId, fileId]
    );
    if (!arows || !arows.length) return res.status(400).json({ ok: false, error: "file_not_assigned_to_contact" });

    await pool.query(
      "INSERT INTO file_key_envelopes (file_id, recipient_type, recipient_id, alg, enc_key_b64, meta_json) VALUES (?, 'contact', ?, ?, ?, ?) ON DUPLICATE KEY UPDATE alg=VALUES(alg), enc_key_b64=VALUES(enc_key_b64), meta_json=VALUES(meta_json)",
      [fileId, contactId, alg, encKeyB64, metaJson]
    );

    return res.json({ ok: true });
  })
);

router.post(
  "/share-get-contact-envelope",
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || "");
    if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

    const tokenHash = sha256Hex(token);
    const pool = getPool();

    const [rows] = await pool.query(
      "SELECT t.contact_id, t.file_id, t.expires_at FROM contact_file_share_tokens t WHERE t.token_hash = ? LIMIT 1",
      [tokenHash]
    );
    if (!rows || !rows.length) return res.status(404).json({ ok: false, error: "invalid_token" });

    const t = rows[0];
    if (new Date(t.expires_at).getTime() < Date.now()) return res.status(410).json({ ok: false, error: "token_expired" });

    let [envRows] = await pool.query(
      "SELECT alg, enc_key_b64, meta_json FROM file_key_envelopes WHERE file_id = ? AND recipient_type = 'contact' AND recipient_id = ? LIMIT 1",
      [t.file_id, t.contact_id]
    );

    const [fown] = await pool.query("SELECT user_id FROM files WHERE id = ? LIMIT 1", [t.file_id]);
    const ownerUserId = fown && fown.length ? String(fown[0].user_id) : "";
    if (!ownerUserId) return res.status(404).json({ ok: false, error: "file_not_found" });

    const [uenv] = await pool.query(
      "SELECT meta_json FROM file_key_envelopes WHERE file_id = ? AND recipient_type = 'user' AND recipient_id = ? LIMIT 1",
      [t.file_id, ownerUserId]
    );

    let ivB64 = null;
    try {
      const uj = uenv && uenv.length && uenv[0].meta_json ? JSON.parse(String(uenv[0].meta_json)) : null;
      ivB64 = uj && uj.iv_b64 ? String(uj.iv_b64) : null;
    } catch {
      ivB64 = null;
    }


    if (!envRows || !envRows.length) {
      const [crows] = await pool.query("SELECT public_key FROM emergency_contacts WHERE id = ? LIMIT 1", [t.contact_id]);
      
const contactPub = crows && crows.length && crows[0].public_key ? String(crows[0].public_key) : "";

	const contactPubPem = contactPub.replace(/\\n/g, "\n").trim();
      if (!contactPub) return res.status(404).json({ ok: false, error: "contact_missing_public_key" });

      const [erows] = await pool.query("SELECT alg, enc_key_b64 FROM file_key_escrows WHERE file_id = ? LIMIT 1", [t.file_id]);
      if (!erows || !erows.length || !erows[0].enc_key_b64) {
        return res.status(500).json({ ok: false, error: "missing_file_escrow" });
      }

      const privPem = getEscrowPrivateKeyPemOrNull();
      if (!privPem) return res.status(500).json({ ok: false, error: "escrow_private_key_missing" });

      const envelope = buildContactEnvelopeFromEscrow({
        escrowAlg: String(erows[0].alg || "rsa-oaep-sha256"),
        escrowEncKeyB64: String(erows[0].enc_key_b64),
        contactPublicKeyPem: contactPubPem,
        escrowPrivateKeyPem: privPem,
      });

      const metaForContact = uenv && uenv.length && uenv[0].meta_json ? String(uenv[0].meta_json) : null;

      await pool.query(
        "INSERT INTO file_key_envelopes (file_id, recipient_type, recipient_id, alg, enc_key_b64, meta_json) VALUES (?, 'contact', ?, ?, ?, ?) ON DUPLICATE KEY UPDATE alg=VALUES(alg), enc_key_b64=VALUES(enc_key_b64), meta_json=VALUES(meta_json)",
        [t.file_id, t.contact_id, envelope.alg, envelope.enc_key_b64, metaForContact]
      );

      const [fresh] = await pool.query(
        "SELECT alg, enc_key_b64, meta_json FROM file_key_envelopes WHERE file_id = ? AND recipient_type = 'contact' AND recipient_id = ? LIMIT 1",
        [t.file_id, t.contact_id]
      );
      envRows = fresh;

      [envRows] = await pool.query(
        "SELECT alg, enc_key_b64, meta_json FROM file_key_envelopes WHERE file_id = ? AND recipient_type = 'contact' AND recipient_id = ? LIMIT 1",
        [t.file_id, t.contact_id]
      );

      if (!envRows || !envRows.length) return res.status(500).json({ ok: false, error: "envelope_create_failed" });
    }

    let meta = null;
    try {
      meta = envRows[0].meta_json ? JSON.parse(String(envRows[0].meta_json)) : null;
    } catch {
      meta = null;
    }

    // Backfill meta_json.iv_b64 if missing (older rows were saved with NULL meta).
    let existingMeta = null;
    try {
      existingMeta = envRows[0].meta_json ? JSON.parse(String(envRows[0].meta_json)) : null;
    } catch {
      existingMeta = null;
    }

    if ((!existingMeta || !existingMeta.iv_b64) && ivB64) {
      const fixedMeta = JSON.stringify({ iv_b64: ivB64 });
      await pool.query(
        "UPDATE file_key_envelopes SET meta_json = ? WHERE file_id = ? AND recipient_type = 'contact' AND recipient_id = ? LIMIT 1",
        [fixedMeta, t.file_id, t.contact_id]
      );
      existingMeta = { iv_b64: ivB64 };
    }

    return res.json({
      ok: true,
      contact_id: Number(t.contact_id),
      file_id: String(t.file_id),
      alg: String(envRows[0].alg),
      enc_key_b64: String(envRows[0].enc_key_b64),
      meta_json: existingMeta,
    });

  })
);

router.post(
  "/share-presign-download",
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || "");
    if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

    const tokenHash = sha256Hex(token);
    const pool = getPool();

    const [trows] = await pool.query(
      "SELECT t.contact_id, t.file_id, t.expires_at FROM contact_file_share_tokens t WHERE t.token_hash = ? LIMIT 1",
      [tokenHash]
    );
    if (!trows || !trows.length) return res.status(404).json({ ok: false, error: "invalid_token" });

    const t = trows[0];
    if (new Date(t.expires_at).getTime() < Date.now()) return res.status(410).json({ ok: false, error: "token_expired" });

    const [frows] = await pool.query("SELECT bucket, content_type FROM files WHERE id = ? LIMIT 1", [String(t.file_id)]);
    if (!frows || !frows.length) return res.status(404).json({ ok: false, error: "file_not_found" });

    const f = frows[0];

    const region = String(process.env.AWS_REGION || "").trim();
    if (!region) return res.status(500).json({ ok: false, error: "AWS_REGION missing" });

    const s3 = new S3Client({ region });

    const bucket = String(f.bucket || "").trim();
    if (!bucket) return res.status(500).json({ ok: false, error: "missing_bucket" });

    const fileId = String(t.file_id);
    const basename = fileId.split("/").pop() || "download.bin";

    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: fileId,
      ResponseContentType: String(f.content_type || "application/octet-stream").slice(0, 255),
      ResponseContentDisposition: `attachment; filename="${basename}"`,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 600 });

    return res.json({ ok: true, url, file_id: fileId, contact_id: Number(t.contact_id) });
  })
);

router.get(
  "/list",
  requireUser,
  requirePaid,
  asyncHandler(async (req, res) => {
    const pool = getPool();

    const [rows] = await pool.query(
      `
    SELECT
      f.id,
      f.content_type,
      f.size_bytes,
      f.created_at,
      e.meta_json,
      EXISTS(
        SELECT 1
        FROM emergency_contact_file_assignments a
        JOIN emergency_contacts c ON c.id = a.contact_id
        WHERE a.file_id = f.id AND c.user_id = f.user_id
        LIMIT 1
      ) AS include_in_emergency
    FROM files f
    LEFT JOIN file_key_envelopes e
      ON e.file_id = f.id
     AND e.recipient_type = 'user'
     AND e.recipient_id = ?
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
    LIMIT 500
    `,
      [req.userId, req.userId]
    );

    const files = (rows || []).map((r) => {
      const id = String(r.id || "");
      const basename = id.split("/").pop() || id;

      let meta = null;
      try {
        meta = r.meta_json ? JSON.parse(String(r.meta_json)) : null;
      } catch {
        meta = null;
      }

      const name = meta && meta.original_name ? String(meta.original_name) : basename;

      return {
        key: id,
        name,
        content_type: String(r.content_type || "application/octet-stream"),
        size_bytes: r.size_bytes === null || r.size_bytes === undefined ? null : Number(r.size_bytes),
        created_at: r.created_at,
        include_in_emergency: Boolean(r.include_in_emergency),
      };
    });

    return res.json({ ok: true, files });
  })
);

module.exports = { filesRouter: router };
