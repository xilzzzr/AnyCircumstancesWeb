// files.js
const express = require("express");
const crypto = require("crypto");

const { S3Client, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { KMSClient, DecryptCommand, GetPublicKeyCommand } = require("@aws-sdk/client-kms");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { createPresignedPost } = require("@aws-sdk/s3-presigned-post");
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

function isValidShareToken(token) {
  return /^[a-f0-9]{64}$/i.test(String(token || ""));
}

function shareExpiresAt() {
  const requested = Number(process.env.SHARE_LINK_TTL_DAYS || 30);
  const days = Number.isInteger(requested) ? Math.max(1, Math.min(requested, 90)) : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
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
  const auth = require("./auth");
  Promise.resolve(auth.validateAccessSession(req))
    .then((session) => {
      if (!session?.ok) {
        auth.clearVaultUnlockCookie(res);
        return res.status(session?.error === "temporarily_locked" ? 423 : 401).json({
          ok: false,
          error: session?.error || "not_authenticated",
        });
      }
      req.userId = session.userId;
      req.authVersion = session.authVersion;
      next();
    })
    .catch((error) => {
      console.error("[files requireUser]", error && (error.stack || error));
      res.status(500).json({ ok: false, error: "server_error" });
    });
}

function requireVaultUnlocked(req, res, next) {
  const auth = require("./auth");
  if (!auth.verifyVaultUnlockCookie(req, req.userId, req.authVersion)) {
    return res.status(403).json({ ok: false, error: "vault_locked" });
  }
  next();
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
function getLegacyEscrowPrivateKeyPem() {
  const raw = String(process.env.ESCROW_PRIVATE_KEY_PEM || "").replace(/\\n/g, "\n").trim();
  if (!raw) return "";
  if (process.env.NODE_ENV === "production" &&
      String(process.env.ALLOW_LEGACY_ESCROW_PRIVATE_KEY || "").toLowerCase() !== "true") {
    return "";
  }
  return raw;
}

function escrowKmsKeyId() {
  return String(process.env.ESCROW_KMS_KEY_ID || "").trim();
}

function kmsClient() {
  const region = String(process.env.AWS_REGION || "").trim();
  if (!region) throw new Error("AWS_REGION missing");
  return new KMSClient({ region });
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

function isBoundedBase64(input, maxLength = 4096) {
  const value = String(input || "").trim();
  return value.length > 0 && value.length <= maxLength && /^[A-Za-z0-9+/_=-]+$/.test(value);
}


async function getEscrowPublicKeyPem() {
  const keyId = escrowKmsKeyId();
  if (keyId) {
    const response = await kmsClient().send(new GetPublicKeyCommand({ KeyId: keyId }));
    if (!response.PublicKey) return null;
    return crypto.createPublicKey({
      key: Buffer.from(response.PublicKey),
      format: "der",
      type: "spki",
    }).export({ type: "spki", format: "pem" }).toString();
  }

  const privPem = getLegacyEscrowPrivateKeyPem();
  if (!privPem) return null;
  return crypto.createPublicKey(crypto.createPrivateKey(privPem))
    .export({ type: "spki", format: "pem" }).toString();
}

router.get(
  "/escrow-public-key",
  asyncHandler(async (req, res) => {
    const pub = await getEscrowPublicKeyPem();
    if (!pub) return res.status(500).json({ ok: false, error: "escrow_key_unavailable" });
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

    if (alg !== "rsa-oaep-sha256") return res.status(400).json({ ok: false, error: "invalid_alg" });
    if (!isBoundedBase64(encKeyB64)) return res.status(400).json({ ok: false, error: "invalid_enc_key" });

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
 * Unwraps an escrowed per-file AES key. Production should use an AWS KMS
 * asymmetric RSA key so the private key is non-exportable from KMS.
 */
async function unwrapEscrowKey(escrowEncKeyB64) {
  const ciphertext = Buffer.from(String(escrowEncKeyB64), "base64");
  const keyId = escrowKmsKeyId();

  if (keyId) {
    const response = await kmsClient().send(new DecryptCommand({
      KeyId: keyId,
      CiphertextBlob: ciphertext,
      EncryptionAlgorithm: "RSAES_OAEP_SHA_256",
    }));
    if (!response.Plaintext) throw new Error("kms_decrypt_failed");
    return Buffer.from(response.Plaintext);
  }

  const privateKeyPem = getLegacyEscrowPrivateKeyPem();
  if (!privateKeyPem) throw new Error("escrow_key_unavailable");
  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    ciphertext
  );
}

async function buildContactEnvelopeFromEscrow({ escrowAlg, escrowEncKeyB64, contactPublicKeyPem }) {
  const plainKeyBuf = await unwrapEscrowKey(escrowEncKeyB64);
  const normalizedContactPem = normalizePublicKeyPem(contactPublicKeyPem);
  if (!normalizedContactPem) throw new Error("invalid_contact_public_key");
  const contactKeyObj = crypto.createPublicKey(normalizedContactPem);
  const encForContactBuf = crypto.publicEncrypt(
    {
      key: contactKeyObj,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    plainKeyBuf
  );
  return {
    alg: String(escrowAlg || "rsa-oaep-sha256"),
    enc_key_b64: encForContactBuf.toString("base64"),
  };
}

router.get(
  "/health",
  asyncHandler(async (req, res) => {
    return res.json({ ok: true });
  })
);

require("./vault_keys").registerVaultKeyRoutes(router, requireUser, requireVaultUnlocked, getPool, asyncHandler);

router.post(
  "/set-user-public-key",
  requireUser,
  requirePaid,
  asyncHandler(async (req, res) => {
	const publicKey = String(req.body?.public_key || "").replace(/\\n/g, "\n").trim();
    if (!publicKey) return res.status(400).json({ ok: false, error: "missing_public_key" });
    if (publicKey.length > 20000) return res.status(400).json({ ok: false, error: "public_key_too_large" });
    const normalized = normalizePublicKeyPem(publicKey);
    if (!normalized) return res.status(400).json({ ok: false, error: "invalid_public_key" });

    const pool = getPool();
    const [rows] = await pool.query("SELECT public_key FROM users WHERE id = ? LIMIT 1", [req.userId]);
    const existing = rows?.[0]?.public_key ? normalizePublicKeyPem(rows[0].public_key) : null;
    if (existing && existing !== normalized) return res.status(409).json({ ok: false, error: "public_key_already_set" });
    await pool.query("UPDATE users SET public_key = COALESCE(public_key, ?) WHERE id = ? LIMIT 1", [normalized, req.userId]);

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
    const uploadSize = Number(req.body?.sizeBytes);
    const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 209715200);
    if (!Number.isInteger(uploadSize) || uploadSize <= 0 || uploadSize > maxUploadBytes) {
      return res.status(400).json({ ok: false, error: "invalid_upload_size" });
    }

    const key = "users/" + req.userId + "/uploads/" + crypto.randomUUID();
    const uploadContentType = "application/octet-stream";

    const s3 = new S3Client({ region });

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [profileRows] = await conn.query(
        "SELECT storage_limit_gb FROM billing_profiles WHERE user_id = ? LIMIT 1 FOR UPDATE",
        [req.userId]
      );
      const [usageRows] = await conn.query(
        "SELECT COALESCE(SUM(size_bytes), 0) AS used_bytes FROM files WHERE user_id = ?",
        [req.userId]
      );
      const limitGb = Number(profileRows?.[0]?.storage_limit_gb || 0);
      const usedBytes = Number(usageRows?.[0]?.used_bytes || 0);
      const storageLimitBytes = Math.floor(limitGb * 1024 * 1024 * 1024);
      if (!Number.isFinite(storageLimitBytes) || storageLimitBytes <= 0 || usedBytes + uploadSize > storageLimitBytes) {
        await conn.rollback();
        return res.status(413).json({ ok: false, error: "storage_limit_exceeded" });
      }
      await conn.query("INSERT INTO files (id, user_id, bucket, content_type, size_bytes) VALUES (?, ?, ?, ?, ?)", [
        key,
        req.userId,
        bucket,
        originalContentType,
        uploadSize,
      ]);
      await conn.commit();
    } catch (error) {
      try { await conn.rollback(); } catch {}
      throw error;
    } finally {
      conn.release();
    }

    let presigned;
    try {
      presigned = await createPresignedPost(s3, {
        Bucket: bucket,
        Key: key,
        Expires: 600,
        Fields: {
          "Content-Type": uploadContentType,
          "x-amz-server-side-encryption": "AES256",
        },
        Conditions: [
          // S3 evaluates the multipart request size, which includes form-field overhead.
          // The uploaded object's exact byte length is independently verified on confirm.
          ["content-length-range", uploadSize, uploadSize + 64 * 1024],
          ["eq", "$Content-Type", uploadContentType],
          ["eq", "$x-amz-server-side-encryption", "AES256"],
        ],
      });
    } catch (error) {
      await pool.query("DELETE FROM files WHERE id = ? AND user_id = ? LIMIT 1", [key, req.userId]).catch(() => null);
      throw error;
    }

    return res.json({
      ok: true,
      method: "POST",
      url: presigned.url,
      key,
      filename,
      fields: presigned.fields,
    });
  })
);

router.post(
  "/delete",
  requireUser,
  requirePaid,
  requireVaultUnlocked,
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
    const [rows] = await pool.query("SELECT bucket, size_bytes FROM files WHERE id = ? AND user_id = ? LIMIT 1", [
      key,
      req.userId,
    ]);
    if (!rows?.length) return res.status(404).json({ ok: false, error: "file_not_found" });
    const reservedSize = Number(rows[0].size_bytes);
    const s3 = getS3();
    const head = await s3.send(new HeadObjectCommand({ Bucket: String(rows[0].bucket), Key: key }));
    const actualSize = Number(head.ContentLength);
    if (!Number.isInteger(actualSize) || actualSize <= 0 || actualSize > maxUploadBytes || actualSize !== reservedSize || sizeBytes !== actualSize) {
      await s3.send(new DeleteObjectCommand({ Bucket: String(rows[0].bucket), Key: key })).catch(() => null);
      await pool.query("DELETE FROM files WHERE id = ? AND user_id = ? LIMIT 1", [key, req.userId]);
      return res.status(400).json({ ok: false, error: "upload_size_mismatch" });
    }

    return res.json({ ok: true });
  })
);

router.post(
  "/presign-download",
  requireUser,
  requirePaid,
  requireVaultUnlocked,
  presignDownloadLimiter,

  asyncHandler(async (req, res) => {
    const bucket = String(process.env.S3_BUCKET || "").trim();
    if (!bucket) return res.status(500).json({ ok: false, error: "S3_BUCKET missing" });

    const region = String(process.env.AWS_REGION || "").trim();
    if (!region) return res.status(500).json({ ok: false, error: "AWS_REGION missing" });

    const key = String(req.body?.key || "");
    const prefix = "users/" + req.userId + "/";
    if (!key.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

    const pool = getPool();
    const [rows] = await pool.query("SELECT bucket FROM files WHERE id = ? AND user_id = ? LIMIT 1", [key, req.userId]);
    if (!rows?.length) return res.status(404).json({ ok: false, error: "file_not_found" });

    const s3 = new S3Client({ region });

    const cmd = new GetObjectCommand({ Bucket: String(rows[0].bucket || bucket), Key: key });
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
    if (metaJson && metaJson.length > 20000) return res.status(400).json({ ok: false, error: "invalid_meta" });

    const pool = getPool();
    const [fileRows] = await pool.query("SELECT 1 FROM files WHERE id = ? AND user_id = ? LIMIT 1", [fileId, req.userId]);
    if (!fileRows?.length) return res.status(404).json({ ok: false, error: "file_not_found" });
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
  requireVaultUnlocked,
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
    if (!crows[0].verified_at) return res.status(409).json({ ok: false, error: "contact_not_verified" });

    const [arows] = await pool.query(
      "SELECT 1 FROM emergency_contact_file_assignments WHERE contact_id = ? AND file_id = ? LIMIT 1",
      [contactId, fileId]
    );
    if (!arows || !arows.length) return res.status(400).json({ ok: false, error: "file_not_assigned_to_contact" });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    await pool.query("INSERT INTO contact_file_share_tokens (contact_id, file_id, token_hash, expires_at) VALUES (?, ?, ?, ?)", [
      contactId,
      fileId,
      tokenHash,
      shareExpiresAt()
    ]);

    const publicBase = String(process.env.PUBLIC_APP_BASE_URL || "https://anycircumstances.com").replace(/\/+$/, "");
    const link = publicBase + "/share#token=" + encodeURIComponent(token);

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
    if (!isValidShareToken(token)) return res.status(400).json({ ok: false, error: "invalid_token" });

    const tokenHash = sha256Hex(token);
    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT t.contact_id, t.file_id, t.expires_at, t.used_at,
              f.content_type
       FROM contact_file_share_tokens t
       JOIN emergency_contacts c ON c.id = t.contact_id
       JOIN files f ON f.id = t.file_id AND f.user_id = c.user_id
       WHERE t.token_hash = ? LIMIT 1`,
      [tokenHash]
    );

    if (!rows || !rows.length) return res.status(404).json({ ok: false, error: "invalid_token" });

    const r = rows[0];
    if (new Date(r.expires_at).getTime() < Date.now()) return res.status(410).json({ ok: false, error: "token_expired" });
    if (r.used_at && Date.now() - new Date(r.used_at).getTime() > 15 * 60 * 1000) {
      return res.status(410).json({ ok: false, error: "token_consumed" });
    }

    return res.json({
      ok: true,
      file: {
        id: String(r.file_id),
        content_type: String(r.content_type),
      },
      token: {
        expires_at: r.expires_at,
        used_at: r.used_at,
      },
    });
  })
);

// Legacy recipient key-registration endpoint.
// New emergency access uses ephemeral per-download keys.
// Remove after old clients are no longer supported.
router.post(
  "/share-set-contact-public-key",
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || "");
    const publicKey = String(req.body?.public_key || "").trim();

    if (!isValidShareToken(token)) return res.status(400).json({ ok: false, error: "invalid_token" });
    if (!publicKey) return res.status(400).json({ ok: false, error: "missing_public_key" });
    if (publicKey.length > 20000) return res.status(400).json({ ok: false, error: "public_key_too_large" });
    const normalizedPublicKey = normalizePublicKeyPem(publicKey);
    if (!normalizedPublicKey) return res.status(400).json({ ok: false, error: "invalid_public_key" });

    const tokenHash = sha256Hex(token);
    const pool = getPool();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [trows] = await conn.query(
        `SELECT t.id, t.contact_id, t.file_id, t.expires_at, t.used_at, c.public_key
         FROM contact_file_share_tokens t
         JOIN emergency_contacts c ON c.id = t.contact_id
         JOIN files f ON f.id = t.file_id AND f.user_id = c.user_id
         WHERE t.token_hash = ? LIMIT 1 FOR UPDATE`,
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

      const existingContactKey = t.public_key ? normalizePublicKeyPem(t.public_key) : null;
      if (existingContactKey && existingContactKey !== normalizedPublicKey) {
        await conn.rollback();
        return res.status(409).json({ ok: false, error: "contact_key_already_set" });
      }

      await conn.query(
        "UPDATE emergency_contacts SET public_key = COALESCE(public_key, ?), verified_at = COALESCE(verified_at, NOW()) WHERE id = ? LIMIT 1",
        [normalizedPublicKey, t.contact_id]
      );

      // Keep legacy registration, but never create permanent contact envelopes.

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

    // Legacy compatibility acknowledgement; emergency envelopes are now ephemeral.
    // Existing contact envelopes remain untouched.

    return res.json({ ok: true });
  })
);

router.post(
  "/share-get-contact-envelope",
  asyncHandler(async (req, res) => {
    // The unexpired bearer token authorizes re-wrapping to this request's key.
    res.set("Cache-Control", "no-store");
    const token = String(req.body?.token || "");
    if (!isValidShareToken(token)) return res.status(400).json({ ok: false, error: "invalid_token" });

    const publicKey = String(req.body?.public_key || "").trim();
    if (!publicKey) return res.status(400).json({ ok: false, error: "missing_public_key" });
    if (publicKey.length > 20000) return res.status(400).json({ ok: false, error: "public_key_too_large" });
    const normalizedPublicKey = normalizePublicKeyPem(publicKey);
    if (!normalizedPublicKey || crypto.createPublicKey(normalizedPublicKey).asymmetricKeyType !== "rsa") {
      return res.status(400).json({ ok: false, error: "invalid_public_key" });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT t.id, t.contact_id, t.file_id, t.expires_at, t.used_at
       FROM contact_file_share_tokens t
       JOIN emergency_contacts c ON c.id = t.contact_id
       JOIN files f ON f.id = t.file_id AND f.user_id = c.user_id
       WHERE t.token_hash = ? LIMIT 1`,
      [sha256Hex(token)]
    );
    if (!rows?.length) return res.status(404).json({ ok: false, error: "invalid_token" });
    const share = rows[0];
    if (new Date(share.expires_at).getTime() < Date.now()) return res.status(410).json({ ok: false, error: "token_expired" });
    if (share.used_at && Date.now() - new Date(share.used_at).getTime() > 15 * 60 * 1000) {
      return res.status(410).json({ ok: false, error: "token_consumed" });
    }
    await pool.query(
      "UPDATE contact_file_share_tokens SET used_at = COALESCE(used_at, UTC_TIMESTAMP(3)) WHERE id = ? LIMIT 1",
      [share.id]
    );

    const [escrowRows] = await pool.query(
      "SELECT alg, enc_key_b64 FROM file_key_escrows WHERE file_id = ? LIMIT 1", [share.file_id]
    );
    if (!escrowRows?.[0]?.enc_key_b64) return res.status(500).json({ ok: false, error: "missing_file_escrow" });
    if (!escrowKmsKeyId() && !getLegacyEscrowPrivateKeyPem()) {
      return res.status(500).json({ ok: false, error: "escrow_key_unavailable" });
    }

    const [ownerRows] = await pool.query("SELECT user_id FROM files WHERE id = ? LIMIT 1", [share.file_id]);
    if (!ownerRows?.[0]?.user_id) return res.status(500).json({ ok: false, error: "missing_envelope_meta" });
    const [metaRows] = await pool.query(
      "SELECT meta_json FROM file_key_envelopes WHERE file_id = ? AND recipient_type = 'user' AND recipient_id = ? LIMIT 1",
      [share.file_id, String(ownerRows[0].user_id)]
    );
    const storedMeta = metaRows?.[0]?.meta_json;
    if (!storedMeta) return res.status(500).json({ ok: false, error: "missing_envelope_meta" });
    let meta;
    try {
      // MySQL JSON columns may already be decoded by the driver.
      meta = typeof storedMeta === "string" ? JSON.parse(storedMeta) : storedMeta;
      if (!meta || typeof meta !== "object" || Array.isArray(meta)) throw new Error("invalid_envelope_meta");
    } catch {
      return res.status(500).json({ ok: false, error: "invalid_envelope_meta" });
    }

    let envelope;
    try {
      envelope = await buildContactEnvelopeFromEscrow({
        escrowAlg: String(escrowRows[0].alg || "rsa-oaep-sha256"),
        escrowEncKeyB64: String(escrowRows[0].enc_key_b64),
        contactPublicKeyPem: normalizedPublicKey,
      });
    } catch {
      // Do not forward crypto exceptions or key material to logs/responses.
      return res.status(500).json({ ok: false, error: "envelope_create_failed" });
    }
    return res.json({
      ok: true,
      contact_id: Number(share.contact_id),
      file_id: String(share.file_id),
      alg: envelope.alg,
      enc_key_b64: envelope.enc_key_b64,
      meta_json: meta,
    });
  })
);

router.post(
  "/share-presign-download",
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || "");
    if (!isValidShareToken(token)) return res.status(400).json({ ok: false, error: "invalid_token" });

    const tokenHash = sha256Hex(token);
    const pool = getPool();

    const [trows] = await pool.query(
      `SELECT t.contact_id, t.file_id, t.expires_at, t.used_at
       FROM contact_file_share_tokens t
       JOIN emergency_contacts c ON c.id = t.contact_id
       JOIN files f ON f.id = t.file_id AND f.user_id = c.user_id
       WHERE t.token_hash = ? LIMIT 1`,
      [tokenHash]
    );
    if (!trows || !trows.length) return res.status(404).json({ ok: false, error: "invalid_token" });

    const t = trows[0];
    if (new Date(t.expires_at).getTime() < Date.now()) return res.status(410).json({ ok: false, error: "token_expired" });
    if (t.used_at && Date.now() - new Date(t.used_at).getTime() > 15 * 60 * 1000) {
      return res.status(410).json({ ok: false, error: "token_consumed" });
    }

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
