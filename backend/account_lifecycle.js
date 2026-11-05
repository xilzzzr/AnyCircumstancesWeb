const { S3Client, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { acquireVaultUserLock, releaseVaultUserLock } = require("./vault_mutation_lock");

async function purgeVaultFiles(pool, userId) {
  const conn = await pool.getConnection();
  let vaultLockName = null;
  try {
    vaultLockName = await acquireVaultUserLock(conn, userId);
    const [files] = await conn.query(
      "SELECT f.id, f.bucket, f.storage_key, o.object_key AS revision_key FROM files f LEFT JOIN file_storage_objects o ON o.file_id=f.id WHERE f.user_id=?",
      [String(userId)],
    );
    const byBucket = new Map();
    const deletedFileIds = new Set();
    for (const file of files || []) {
      const bucket = String(file.bucket || "").trim();
      const id = String(file.id || "").trim();
      if (!bucket || !id) continue;
      deletedFileIds.add(id);
      if (!byBucket.has(bucket)) byBucket.set(bucket, new Set());
      for (const key of [id, file.storage_key, file.revision_key]) {
        if (key) byBucket.get(bucket).add(String(key));
      }
    }

    if (byBucket.size) {
      const region = String(process.env.AWS_REGION || "").trim();
      if (!region) throw new Error("AWS_REGION missing");
      const s3 = new S3Client({ region });
      for (const [bucket, storedKeys] of byBucket) {
        const keys = [...storedKeys];
        for (let i = 0; i < keys.length; i += 1000) {
          const result = await s3.send(new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
          }));
          if (Array.isArray(result.Errors) && result.Errors.length) {
            const error = new Error("s3_delete_incomplete");
            error.failedKeys = result.Errors.map((entry) => String(entry.Key || "")).filter(Boolean);
            throw error;
          }
        }
      }
    }

    await conn.beginTransaction();
    try {
      const uid = String(userId);
      await conn.query("DELETE cft FROM contact_file_share_tokens cft JOIN files f ON f.id = cft.file_id WHERE f.user_id = ?", [uid]);
      await conn.query("DELETE ecfa FROM emergency_contact_file_assignments ecfa JOIN files f ON f.id = ecfa.file_id WHERE f.user_id = ?", [uid]);
      await conn.query("DELETE fke FROM file_key_envelopes fke JOIN files f ON f.id = fke.file_id WHERE f.user_id = ?", [uid]);
      await conn.query("DELETE fks FROM file_key_escrows fks JOIN files f ON f.id = fks.file_id WHERE f.user_id = ?", [uid]);
      await conn.query("DELETE o FROM file_storage_objects o JOIN files f ON f.id = o.file_id WHERE f.user_id = ?", [uid]);
      await conn.query("DELETE FROM files WHERE user_id = ?", [uid]);
      await conn.commit();
    } catch (error) {
      try { await conn.rollback(); } catch {}
      throw error;
    }
    return { deletedFiles: deletedFileIds.size };
  } finally {
    try { await releaseVaultUserLock(conn, vaultLockName); }
    finally { conn.release(); }
  }
}

async function deleteUserRecords(pool, userId) {
  const uid = String(userId);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE ecvt FROM emergency_contact_verification_tokens ecvt JOIN emergency_contacts ec ON ec.id = ecvt.contact_id WHERE ec.user_id = ?", [uid]);
    await conn.query("DELETE FROM verification_emergency_contact_dispatches WHERE user_id = ?", [uid]);
    await conn.query("DELETE FROM emergency_trigger_jobs WHERE user_id = ?", [uid]);
    await conn.query("DELETE FROM emergency_contacts WHERE user_id = ?", [uid]);
    for (const table of [
      "verification_reminder_emails", "verification_emergency_dispatches", "verification_panic_dispatches",
      "verification_checkins", "verification_settings", "user_device_tokens", "password_reset_tokens",
      "pin_reset_challenges", "email_verification_tokens", "refresh_tokens", "billing_invoices", "billing_entitlements",
      "apple_account_links", "billing_profiles", "user_vault_keys", "account_lifecycle_jobs",
    ]) {
      await conn.query(`DELETE FROM ${table} WHERE user_id = ?`, [uid]);
    }
    await conn.query("DELETE FROM users WHERE id = ? LIMIT 1", [uid]);
    await conn.commit();
  } catch (error) {
    try { await conn.rollback(); } catch {}
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = { purgeVaultFiles, deleteUserRecords };
