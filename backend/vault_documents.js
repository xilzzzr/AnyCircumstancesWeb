const crypto = require("crypto");
const { acquireVaultUserLock, releaseVaultUserLock } = require("./vault_mutation_lock");
const DOCUMENT_TYPE = "application/vnd.anycircumstances.document+json";
const MAX_ENCRYPTED_DOCUMENT_BYTES = 132 * 1024;
function parseMeta(value) {
  try {
    const meta = typeof value === "string" ? JSON.parse(value) : value;
    return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  } catch {
    return {};
  }
}
function validSealedNote(note) {
  return (
    note === null ||
    (note &&
      note.version === 1 &&
      typeof note.iv_b64 === "string" &&
      /^[A-Za-z0-9+/]{16}$/.test(note.iv_b64) &&
      typeof note.ciphertext_b64 === "string" &&
      note.ciphertext_b64.length >= 24 &&
      note.ciphertext_b64.length <= 22000 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(note.ciphertext_b64))
  );
}
function revisionOf(meta) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(parseMeta(meta)))
    .digest("hex");
}
function registerDocumentRoutes(
  router,
  {
    requireUser,
    requirePaid,
    requireVaultAuthorization,
    limiter,
    asyncHandler,
    getPool,
    putDocument,
    deleteDocument,
  },
) {
  router.post(
    "/update-content",
    requireUser,
    requirePaid,
    requireVaultAuthorization,
    limiter,
    asyncHandler(async (req, res) => {
      const fileId = String(req.body?.file_id || "");
      if (!fileId.startsWith(`users/${req.userId}/`))
        return res.status(403).json({ ok: false, error: "forbidden" });
      if (!validSealedNote(req.body?.recipient_note))
        return res
          .status(400)
          .json({ ok: false, error: "invalid_recipient_note" });
      const replacing = req.body?.ciphertext_b64 !== undefined;
      let ciphertext;
      if (replacing) {
        const b64 = req.body.ciphertext_b64;
        if (
          typeof b64 !== "string" ||
          b64.length > 185000 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)
        )
          return res.status(400).json({ ok: false, error: "invalid_document" });
        ciphertext = Buffer.from(b64, "base64");
        if (
          ciphertext.length < 50 ||
          ciphertext.length > MAX_ENCRYPTED_DOCUMENT_BYTES ||
          ciphertext.subarray(0, 4).toString() !== "UAC1"
        )
          return res.status(400).json({ ok: false, error: "invalid_document" });
        if (
          typeof req.body.original_name !== "string" ||
          req.body.original_name.length > 160 ||
          !req.body.original_name.trim() ||
          /[\r\n\x00]/.test(req.body.original_name)
        )
          return res
            .status(400)
            .json({ ok: false, error: "invalid_document_name" });
      }
      const conn = await getPool().getConnection();
      let vaultLockName = null;
      try {
        vaultLockName = await acquireVaultUserLock(conn, req.userId);
        await conn.beginTransaction();
        // Use the same lock order as new upload reservations to serialize storage accounting.
        const [profiles] = await conn.query(
          "SELECT storage_limit_gb FROM billing_profiles WHERE user_id = ? LIMIT 1 FOR UPDATE",
          [req.userId],
        );
        const [rows] = await conn.query(
          "SELECT f.bucket, f.content_type, f.size_bytes, f.storage_key, e.meta_json FROM files f JOIN file_key_envelopes e ON e.file_id=f.id AND e.recipient_type='user' AND e.recipient_id=f.user_id WHERE f.id=? AND f.user_id=? LIMIT 1 FOR UPDATE",
          [fileId, req.userId],
        );
        const row = rows?.[0];
        if (!row) {
          await conn.rollback();
          return res.status(404).json({ ok: false, error: "file_not_found" });
        }
        const meta = parseMeta(row.meta_json);
        if (req.body.expected_revision !== revisionOf(meta)) {
          await conn.rollback();
          return res
            .status(409)
            .json({
              ok: false,
              error: "document_changed_reload_before_saving",
            });
        }
        if (replacing) {
          if (row.content_type !== DOCUMENT_TYPE || !meta.document_template) {
            await conn.rollback();
            return res
              .status(400)
              .json({ ok: false, error: "not_editable_document" });
          }
          const [usage] = await conn.query(
            "SELECT COALESCE(SUM(size_bytes), 0) AS used_bytes FROM files WHERE user_id = ?",
            [req.userId],
          );
          const limit = Math.floor(
            Number(profiles?.[0]?.storage_limit_gb || 0) * 1024 ** 3,
          );
          if (!limit || Number(usage?.[0]?.used_bytes || 0) - Number(row.size_bytes || 0) + ciphertext.length > limit) {
            await conn.rollback();
            return res.status(413).json({ ok: false, error: "storage_limit_exceeded" });
          }

          // NEVER overwrite a live encrypted S3 object. First register a unique staged
          // object key in its own committed transaction so even failed saves can be
          // purged by file/account deletion. The public file ID stays unchanged.
          const storageKey = `${fileId}.revisions/${crypto.randomUUID()}`;
          await conn.query(
            "INSERT INTO file_storage_objects (file_id, object_key) VALUES (?, ?)",
            [fileId, storageKey],
          );
          await conn.commit();
          await putDocument({ bucket: row.bucket, fileId, storageKey, ciphertext });

          // Re-check revision and storage allowance after upload. Other operations
          // may have changed the file while S3 was writing. The original object
          // remains readable until this second transaction commits atomically.
          await conn.beginTransaction();
          const [freshProfiles] = await conn.query(
            "SELECT storage_limit_gb FROM billing_profiles WHERE user_id = ? LIMIT 1 FOR UPDATE",
            [req.userId],
          );
          const [freshRows] = await conn.query(
            "SELECT f.bucket, f.content_type, f.size_bytes, f.storage_key, e.meta_json FROM files f JOIN file_key_envelopes e ON e.file_id=f.id AND e.recipient_type='user' AND e.recipient_id=f.user_id WHERE f.id=? AND f.user_id=? LIMIT 1 FOR UPDATE",
            [fileId, req.userId],
          );
          const fresh = freshRows?.[0];
          if (!fresh || revisionOf(fresh.meta_json) !== req.body.expected_revision) {
            await conn.rollback();
            return res.status(409).json({ ok: false, error: "document_changed_reload_before_saving" });
          }
          const [freshUsage] = await conn.query(
            "SELECT COALESCE(SUM(size_bytes), 0) AS used_bytes FROM files WHERE user_id = ?",
            [req.userId],
          );
          const freshLimit = Math.floor(Number(freshProfiles?.[0]?.storage_limit_gb || 0) * 1024 ** 3);
          if (!freshLimit || Number(freshUsage?.[0]?.used_bytes || 0) - Number(fresh.size_bytes || 0) + ciphertext.length > freshLimit) {
            await conn.rollback();
            return res.status(413).json({ ok: false, error: "storage_limit_exceeded" });
          }
          meta.original_name = req.body.original_name;
          meta.ciphertext_size_bytes = ciphertext.length;
          meta.original_size_bytes = Number(ciphertext.readBigUInt64LE(9));
          await conn.query(
            "UPDATE files SET size_bytes=?, storage_key=? WHERE id=? AND user_id=?",
            [ciphertext.length, storageKey, fileId, req.userId],
          );
        }
        if (req.body.recipient_note)
          meta.recipient_note = req.body.recipient_note;
        else delete meta.recipient_note;
        meta.content_revision = crypto.randomUUID();
        await conn.query(
          "UPDATE file_key_envelopes SET meta_json=? WHERE file_id=? AND recipient_type='user' AND recipient_id=?",
          [JSON.stringify(meta), fileId, req.userId],
        );
        await conn.commit();
        // The previous ciphertext is removed only AFTER the new encrypted data
        // and its SQL pointer are committed. Cleanup failure never rolls back
        // a successful user edit; old revisions remain registered for deletion.
        if (replacing && typeof deleteDocument === "function") {
          const oldStorageKey = row.storage_key || fileId;
          try {
            await deleteDocument({ bucket: row.bucket, storageKey: oldStorageKey });
            if (oldStorageKey !== fileId) {
              await getPool().query(
                "DELETE FROM file_storage_objects WHERE file_id=? AND object_key=?",
                [fileId, oldStorageKey],
              );
            }
          } catch (cleanupError) {
            console.warn("Deferred previous ciphertext cleanup:", cleanupError.code || cleanupError.message);
          }
        }
        return res.json({
          ok: true,
          meta_json: meta,
          revision: revisionOf(meta),
        });
      } catch (error) {
        try {
          await conn.rollback();
        } catch {}
        throw error;
      } finally {
        try { await releaseVaultUserLock(conn, vaultLockName); }
        finally { conn.release(); }
      }
    }),
  );
}
module.exports = {
  registerDocumentRoutes,
  validSealedNote,
  revisionOf,
  parseMeta,
};
