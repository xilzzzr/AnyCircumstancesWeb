const { S3Client, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

async function purgeVaultFiles(pool, userId) {
  const [files] = await pool.query("SELECT id, bucket FROM files WHERE user_id = ?", [String(userId)]);
  const byBucket = new Map();
  for (const file of files || []) {
    const bucket = String(file.bucket || "").trim();
    const key = String(file.id || "").trim();
    if (!bucket || !key) continue;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(key);
  }

  if (byBucket.size) {
    const region = String(process.env.AWS_REGION || "").trim();
    if (!region) throw new Error("AWS_REGION missing");
    const s3 = new S3Client({ region });
    for (const [bucket, keys] of byBucket) {
      for (let i = 0; i < keys.length; i += 1000) {
        await s3.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        }));
      }
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE cft FROM contact_file_share_tokens cft JOIN files f ON f.id = cft.file_id WHERE f.user_id = ?", [String(userId)]);
    await conn.query("DELETE ecfa FROM emergency_contact_file_assignments ecfa JOIN files f ON f.id = ecfa.file_id WHERE f.user_id = ?", [String(userId)]);
    await conn.query("DELETE fke FROM file_key_envelopes fke JOIN files f ON f.id = fke.file_id WHERE f.user_id = ?", [String(userId)]);
    await conn.query("DELETE fks FROM file_key_escrows fks JOIN files f ON f.id = fks.file_id WHERE f.user_id = ?", [String(userId)]);
    await conn.query("DELETE FROM files WHERE user_id = ?", [String(userId)]);
    await conn.commit();
  } catch (error) {
    try { await conn.rollback(); } catch {}
    throw error;
  } finally {
    conn.release();
  }
  return { deletedFiles: (files || []).length };
}

async function deleteUserRecords(pool, userId) {
  const uid = String(userId);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE ecvt FROM emergency_contact_verification_tokens ecvt JOIN emergency_contacts ec ON ec.id = ecvt.contact_id WHERE ec.user_id = ?", [uid]);
    await conn.query("DELETE FROM emergency_contacts WHERE user_id = ?", [uid]);
    for (const table of [
      "verification_reminder_emails", "verification_emergency_dispatches", "verification_panic_dispatches",
      "verification_checkins", "verification_settings", "user_device_tokens", "password_reset_tokens",
      "email_verification_tokens", "refresh_tokens", "billing_invoices", "billing_entitlements",
      "apple_account_links", "billing_profiles",
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
