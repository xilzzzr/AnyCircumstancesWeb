// files.js
const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { decryptEscrowedKey, escrowKeyId, getEscrowPublicKeyInfo } = require("./escrow_keys");

const { S3Client, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
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

function shareSessionCookieOptions(maxAgeMs = 20 * 60 * 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || String(process.env.COOKIE_SECURE || "").toLowerCase() === "true",
    sameSite: "strict",
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge: maxAgeMs,
  };
}

function setShareSessionCookie(res, shareRow, tokenHash) {
  const secret = String(process.env.JWT_ACCESS_SECRET || "");
  if (!secret) throw new Error("server_misconfig");
  const session = jwt.sign(
    {
      purpose: "share",
      tid: String(shareRow.id),
      cid: String(shareRow.contact_id),
      fid: String(shareRow.file_id),
      th: String(tokenHash),
    },
    secret,
    { algorithm: "HS256", expiresIn: 20 * 60 }
  );
  res.cookie("share_session", session, shareSessionCookieOptions());
}

function getShareSession(req) {
  const raw = req.cookies?.share_session ? String(req.cookies.share_session) : "";
  const secret = String(process.env.JWT_ACCESS_SECRET || "");
  if (!raw || !secret) return null;
  try {
    const payload = jwt.verify(raw, secret, { algorithms: ["HS256"] });
    return payload?.purpose === "share" ? payload : null;
  } catch {
    return null;
  }
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

async function requireUser(req, res, next) {
  const access = req.cookies?.access_token ? String(req.cookies.access_token) : "";
  if (!access) return res.status(401).json({ ok: false, error: "not_authenticated" });

  const secret = process.env.JWT_ACCESS_SECRET || "";
  if (!secret) return res.status(500).json({ ok: false, error: "server_misconfig" });

  let payload;
  try {
    payload = jwt.verify(access, secret, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_session" });
  }

  const userId = payload?.sub ? String(payload.sub) : "";
  if (!userId) return res.status(401).json({ ok: false, error: "invalid_session" });

  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT status, email_verified_at, session_version, duress_locked_until FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const user = rows?.[0];
  const locked = Boolean(
    user?.duress_locked_until &&
    new Date(user.duress_locked_until).getTime() > Date.now()
  );
  if (
    !user ||
    user.status !== "active" ||
    !user.email_verified_at ||
    locked ||
    Number(payload.sv || 0) !== Number(user.session_version || 1)
  ) {
    return res.status(401).json({ ok: false, error: locked ? "account_temporarily_locked" : "invalid_session" });
  }

  req.userId = userId;
  req.sessionVersion = Number(user.session_version || 1);
  return next();
}

function requireVaultAuthorization(req, res, next) {
  const token = req.cookies?.vault_auth ? String(req.cookies.vault_auth) : "";
  const secret = process.env.JWT_ACCESS_SECRET || "";
  if (!token || !secret) return res.status(423).json({ ok: false, error: "vault_locked" });

  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (
      payload?.purpose !== "vault" ||
      String(payload?.sub || "") !== String(req.userId || "") ||
      Number(payload?.sv || 0) !== Number(req.sessionVersion || 0)
    ) {
      return res.status(423).json({ ok: false, error: "vault_locked" });
    }
    return next();
  } catch {
    return res.status(423).json({ ok: false, error: "vault_locked" });
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


router.get(
  "/escrow-public-key",
  requireUser,
  requirePaid,
  requireVaultAuthorization,
  asyncHandler(async (req, res) => {
    const info = await getEscrowPublicKeyInfo();
    if (!info?.publicKeyPem || !info?.keyId) {
      return res.status(500).json({ ok: false, error: "escrow_key_missing" });
    }
    return res.json({
      ok: true,
      public_key_pem: info.publicKeyPem,
      key_ref: info.keyId,
    });
  })
);

router.post(
  "/save-file-escrow",
  requireUser,
  requirePaid,
  requireVaultAuthorization,
  asyncHandler(async (req, res) => {
    const fileId = String(req.body?.file_id || "");
    const alg = String(req.body?.alg || "").trim();
    const encKeyB64 = String(req.body?.enc_key_b64 || "").trim();
    const keyRef = String(req.body?.key_ref || "").trim();

    if (!fileId) return res.status(400).json({ ok: false, error: "missing_file_id" });

    const prefix = "users/" + req.userId + "/";
    if (!fileId.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

    if (alg !== "rsa-oaep-sha256") return res.status(400).json({ ok: false, error: "invalid_alg" });
    if (!isBoundedBase64(encKeyB64)) return res.status(400).json({ ok: false, error: "invalid_enc_key" });
    if (!keyRef || keyRef.length > 255) return res.status(400).json({ ok: false, error: "invalid_key_ref" });

    const currentKeyRef = escrowKeyId();
    if (keyRef !== currentKeyRef) {
      return res.status(409).json({ ok: false, error: "escrow_key_rotated" });
    }

    const pool = getPool();

    const [frows] = await pool.query("SELECT id FROM files WHERE id = ? AND user_id = ? LIMIT 1", [fileId, req.userId]);
    if (!frows || !frows.length) return res.status(404).json({ ok: false, error: "file_not_found" });

    await pool.query(
      "INSERT INTO file_key_escrows (file_id, alg, enc_key_b64, escrow_key_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE alg=VALUES(alg), enc_key_b64=VALUES(enc_key_b64), escrow_key_id=VALUES(escrow_key_id)",
      [fileId, alg, encKeyB64, keyRef]
    );

    return res.json({ ok: true });
  })
);


/**
 * Decrypt the escrowed per-file key through AWS KMS in production and
 * re-encrypt it to the recipient's temporary RSA public key.
 */
async function buildContactEnvelopeFromEscrow({ escrowAlg, escrowEncKeyB64, escrowKeyId: storedEscrowKeyId, contactPublicKeyPem }) {
  const normalizedContactPem = normalizePublicKeyPem(contactPublicKeyPem);
  if (!normalizedContactPem) throw new Error("invalid_contact_public_key");

  const contactKeyObj = crypto.createPublicKey(normalizedContactPem);
  if (contactKeyObj.asymmetricKeyType !== "rsa") {
    throw new Error("contact_public_key_must_be_rsa");
  }

  const plainKeyBuf = await decryptEscrowedKey(escrowEncKeyB64, storedEscrowKeyId);
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

require("./vault_keys").registerVaultKeyRoutes(router, requireUser, requireVaultAuthorization, getPool, asyncHandler);

router.post(
  "/set-user-public-key",
  requireUser,
  requirePaid,
  requireVaultAuthorization,
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
  requireVaultAuthorization,
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
  requireVaultAuthorization,
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
          "Cache-Control": "no-store",
        },
        Conditions: [
          // S3 evaluates the multipart request size, which includes form-field overhead.
          // The uploaded object's exact byte length is independently verified on confirm.
          ["content-length-range", uploadSize, uploadSize + 64 * 1024],
          ["eq", "$Content-Type", uploadContentType],
          ["eq", "$Cache-Control", "no-store"],
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
  requireVaultAuthorization,
  deleteLimiter,

  asyncHandler(async (req, res) => {
    const region = String(process.env.AWS_REGION || "").trim();
    if (!region) return res.status(500).json({ ok: false, error: "AWS_REGION missing" });

    const key = String(req.body?.key || "");
    const prefix = "users/" + req.userId + "/";
    if (!key.startsWith(prefix)) return res.status(403).json({ ok: false, error: "forbidden" });

    const pool = getPool();

    const [rows] = await pool.query("SELECT bucket, storage_key FROM files WHERE id = ? AND user_id = ? LIMIT 1", [
      key,
      req.userId,
    ]);
    if (!rows || !rows.length) return res.status(404).json({ ok: false, error: "file_not_found" });

    const bucket = String(rows[0].bucket || "").trim();
    if (!bucket) return res.status(500).json({ ok: false, error: "missing_bucket" });

    const s3 = new S3Client({ region });
    const [revisionRows] = await pool.query("SELECT object_key FROM file_storage_objects WHERE file_id = ?", [key]);
    const storedKeys = [...new Set([key, rows[0].storage_key, ...revisionRows.map((r) => r.object_key)].filter(Boolean))];
    for (let i = 0; i < storedKeys.length; i += 1000) {
      const result = await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: {
        Objects: storedKeys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true,
      } }));
      if (result.Errors?.length) throw new Error("file_object_delete_incomplete");
    }

    await pool.query("DELETE FROM contact_file_share_tokens WHERE file_id = ?", [key]);
    await pool.query("DELETE FROM emergency_contact_file_assignments WHERE file_id = ?", [key]);
    await pool.query("DELETE FROM file_key_envelopes WHERE file_id = ?", [key]);
    await pool.query("DELETE FROM file_key_escrows WHERE file_id = ?", [key]);
    await pool.query("DELETE FROM file_storage_objects WHERE file_id = ?", [key]);
    await pool.query("DELETE FROM files WHERE id = ? AND user_id = ? LIMIT 1", [key, req.userId]);

    return res.json({ ok: true });
  })
);


router.post(
  "/confirm-upload",
  requireUser,
  requirePaid,
  requireVaultAuthorization,
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
  requireVaultAuthorization,
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
    const [rows] = await pool.query("SELECT bucket, storage_key FROM files WHERE id = ? AND user_id = ? LIMIT 1", [key, req.userId]);
    if (!rows?.length) return res.status(404).json({ ok: false, error: "file_not_found" });

    const s3 = new S3Client({ region });

    const cmd = new GetObjectCommand({ Bucket: String(rows[0].bucket || bucket), Key: String(rows[0].storage_key || key), ResponseCacheControl: "no-store" });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 600 });

    return res.json({ ok: true, url });
  })
);

router.post(
  "/save-user-envelope",
  requireUser,
  requirePaid,
  requireVaultAuthorization,
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
    if (metaJson && metaJson.length > 40000) return res.status(400).json({ ok: false, error: "invalid_meta" });

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
  requireVaultAuthorization,
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
      meta = rows[0].meta_json ? require("./vault_documents").parseMeta(rows[0].meta_json) : null;
    } catch {
      meta = null;
    }

    return res.json({
      ok: true,
      alg: String(rows[0].alg),
      enc_key_b64: String(rows[0].enc_key_b64),
      meta_json: meta,
      revision: require("./vault_documents").revisionOf(meta),
    });
  })
);

require("./vault_documents").registerDocumentRoutes(router, {
  requireUser, requirePaid, requireVaultAuthorization, limiter: confirmUploadLimiter, asyncHandler, getPool,
  putDocument: ({ bucket, storageKey, ciphertext }) => getS3().send(new PutObjectCommand({
    Bucket: bucket, Key: storageKey, Body: ciphertext, ContentType: "application/octet-stream", ServerSideEncryption: "AES256", CacheControl: "no-store",
  })),
  deleteDocument: ({ bucket, storageKey }) => getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })),
});

router.post(
  "/create-contact-share-link",
  requireUser,
  requirePaid,
  requireVaultAuthorization,
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
    res.set("Cache-Control", "no-store");
    const token = String(req.body?.token || "");
    const pool = getPool();
    const existingSession = getShareSession(req);

    if (!isValidShareToken(token) && existingSession) {
      const [rows] = await pool.query(
        `SELECT t.id, t.contact_id, t.file_id, t.expires_at, t.used_at, f.content_type
         FROM contact_file_share_tokens t
         JOIN emergency_contacts c ON c.id = t.contact_id
         JOIN files f ON f.id = t.file_id AND f.user_id = c.user_id
         WHERE t.id = ? AND t.contact_id = ? AND t.file_id = ? LIMIT 1`,
        [String(existingSession.tid || ""), String(existingSession.cid || ""), String(existingSession.fid || "")]
      );
      const row = rows?.[0];
      if (row && row.used_at && new Date(row.expires_at).getTime() >= Date.now()) {
        return res.json({
          ok: true,
          file: { id: String(row.file_id), content_type: String(row.content_type) },
          token: { expires_at: row.expires_at, redeemed: true },
        });
      }
    }

    if (!isValidShareToken(token)) return res.status(400).json({ ok: false, error: "invalid_token" });
    const tokenHash = sha256Hex(token);

    if (existingSession && String(existingSession.th || "") === tokenHash) {
      const [rows] = await pool.query(
        `SELECT t.id, t.contact_id, t.file_id, t.expires_at, t.used_at, f.content_type
         FROM contact_file_share_tokens t
         JOIN emergency_contacts c ON c.id = t.contact_id
         JOIN files f ON f.id = t.file_id AND f.user_id = c.user_id
         WHERE t.id = ? AND t.token_hash = ? LIMIT 1`,
        [String(existingSession.tid || ""), tokenHash]
      );
      const row = rows?.[0];
      if (
        row &&
        row.used_at &&
        new Date(row.expires_at).getTime() >= Date.now() &&
        String(row.contact_id) === String(existingSession.cid || "") &&
        String(row.file_id) === String(existingSession.fid || "")
      ) {
        return res.json({
          ok: true,
          file: { id: String(row.file_id), content_type: String(row.content_type) },
          token: { expires_at: row.expires_at, redeemed: true },
        });
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT t.id, t.contact_id, t.file_id, t.expires_at, t.used_at, f.content_type
         FROM contact_file_share_tokens t
         JOIN emergency_contacts c ON c.id = t.contact_id
         JOIN files f ON f.id = t.file_id AND f.user_id = c.user_id
         WHERE t.token_hash = ? LIMIT 1 FOR UPDATE`,
        [tokenHash]
      );

      const row = rows?.[0];
      if (!row) {
        await conn.rollback();
        return res.status(404).json({ ok: false, error: "invalid_token" });
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        await conn.rollback();
        return res.status(410).json({ ok: false, error: "token_expired" });
      }
      if (row.used_at) {
        await conn.rollback();
        return res.status(410).json({ ok: false, error: "token_already_redeemed" });
      }

      await conn.query(
        "UPDATE contact_file_share_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = ? AND used_at IS NULL",
        [row.id]
      );
      await conn.commit();

      setShareSessionCookie(res, row, tokenHash);
      return res.json({
        ok: true,
        file: { id: String(row.file_id), content_type: String(row.content_type) },
        token: { expires_at: row.expires_at, redeemed: true },
      });
    } catch (error) {
      try { await conn.rollback(); } catch {}
      throw error;
    } finally {
      conn.release();
    }
  })
);

router.get(
  "/contact-public-key",
  requireUser,
  requirePaid,
  requireVaultAuthorization,
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
  requireVaultAuthorization,
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
    res.set("Cache-Control", "no-store");
    const shareSession = getShareSession(req);
    if (!shareSession) return res.status(401).json({ ok: false, error: "share_session_required" });

    const publicKey = String(req.body?.public_key || "").trim();
    if (!publicKey) return res.status(400).json({ ok: false, error: "missing_public_key" });
    if (publicKey.length > 20000) return res.status(400).json({ ok: false, error: "public_key_too_large" });
    const normalizedPublicKey = normalizePublicKeyPem(publicKey);
    if (!normalizedPublicKey || crypto.createPublicKey(normalizedPublicKey).asymmetricKeyType !== "rsa") {
      return res.status(400).json({ ok: false, error: "invalid_public_key" });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT t.contact_id, t.file_id, t.expires_at, t.used_at, t.delivery_group_id
       FROM contact_file_share_tokens t
       JOIN emergency_contacts c ON c.id = t.contact_id
       JOIN files f ON f.id = t.file_id AND f.user_id = c.user_id
       WHERE t.id = ? AND t.contact_id = ? AND t.file_id = ? LIMIT 1`,
      [String(shareSession.tid || ""), String(shareSession.cid || ""), String(shareSession.fid || "")]
    );
    if (!rows?.length || !rows[0].used_at) return res.status(404).json({ ok: false, error: "invalid_share_session" });
    const share = rows[0];
    if (new Date(share.expires_at).getTime() < Date.now()) return res.status(410).json({ ok: false, error: "token_expired" });
    const target = await require("./share_packages").authorizedPackageFile(pool, share, req.body?.file_id);
    if (!target) return res.status(403).json({ ok: false, error: "file_not_in_package" });
    share.file_id = target;

    const [escrowRows] = await pool.query(
      "SELECT alg, enc_key_b64, escrow_key_id FROM file_key_escrows WHERE file_id = ? LIMIT 1", [share.file_id]
    );
    if (!escrowRows?.[0]?.enc_key_b64) return res.status(500).json({ ok: false, error: "missing_file_escrow" });
    const storedEscrowKeyId = String(escrowRows[0].escrow_key_id || "").trim();
    if (process.env.NODE_ENV === "production" && (!storedEscrowKeyId || storedEscrowKeyId === "legacy-local")) {
      return res.status(503).json({ ok: false, error: "escrow_key_migration_required" });
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
        escrowKeyId: storedEscrowKeyId,
        contactPublicKeyPem: normalizedPublicKey,
      });
    } catch {
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
    const shareSession = getShareSession(req);
    if (!shareSession) return res.status(401).json({ ok: false, error: "share_session_required" });

    const pool = getPool();
    const [trows] = await pool.query(
      `SELECT t.contact_id, t.file_id, t.expires_at, t.used_at, t.delivery_group_id
       FROM contact_file_share_tokens t
       JOIN emergency_contacts c ON c.id = t.contact_id
       JOIN files f ON f.id = t.file_id AND f.user_id = c.user_id
       WHERE t.id = ? AND t.contact_id = ? AND t.file_id = ? LIMIT 1`,
      [String(shareSession.tid || ""), String(shareSession.cid || ""), String(shareSession.fid || "")]
    );
    if (!trows?.length || !trows[0].used_at) return res.status(404).json({ ok: false, error: "invalid_share_session" });

    const t = trows[0];
    if (new Date(t.expires_at).getTime() < Date.now()) return res.status(410).json({ ok: false, error: "token_expired" });
    const target = await require("./share_packages").authorizedPackageFile(pool, t, req.body?.file_id);
    if (!target) return res.status(403).json({ ok: false, error: "file_not_in_package" });
    t.file_id = target;

    const [frows] = await pool.query(
      "SELECT bucket, content_type, storage_key FROM files WHERE id = ? AND user_id = (SELECT user_id FROM emergency_contacts WHERE id = ? LIMIT 1) LIMIT 1",
      [String(t.file_id), String(t.contact_id)]
    );
    if (!frows?.length) return res.status(404).json({ ok: false, error: "file_not_found" });

    const region = String(process.env.AWS_REGION || "").trim();
    if (!region) return res.status(500).json({ ok: false, error: "AWS_REGION missing" });

    const bucket = String(frows[0].bucket || "").trim();
    if (!bucket) return res.status(500).json({ ok: false, error: "missing_bucket" });

    const fileId = String(t.file_id);
    const basename = fileId.split("/").pop() || "download.bin";
    const s3 = new S3Client({ region });
    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: String(frows[0].storage_key || fileId),
      ResponseCacheControl: "no-store",
      ResponseContentType: String(frows[0].content_type || "application/octet-stream").slice(0, 255),
      ResponseContentDisposition: `attachment; filename="${basename.replace(/["\\\r\n]/g, "_")}"`,
    });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 600 });

    return res.json({ ok: true, url, file_id: fileId, contact_id: Number(t.contact_id) });
  })
);

router.get(
  "/list",
  requireUser,
  requirePaid,
  requireVaultAuthorization,
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
        meta = r.meta_json ? require("./vault_documents").parseMeta(r.meta_json) : null;
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
        document_template: meta?.document_template || null,
        has_recipient_note: Boolean(meta?.recipient_note),
      };
    });

    return res.json({ ok: true, files });
  })
);

require("./share_packages").registerPackageRoutes(router, { asyncHandler, getPool, getShareSession });

module.exports = { filesRouter: router };

