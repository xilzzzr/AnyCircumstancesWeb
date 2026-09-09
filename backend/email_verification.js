const crypto = require("crypto");

async function consumeEmailVerificationByTokenOnly(conn, rawToken) {
  const tokenHash = crypto.createHash("sha256").update(String(rawToken), "utf8").digest("hex");

  const [rows] = await conn.query(
    "SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ? LIMIT 1 FOR UPDATE",
    [tokenHash]
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid_token" };
  if (row.used_at) return { ok: false, reason: "already_used" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

  await conn.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [row.user_id]);
  await conn.query("UPDATE users SET email_verified_at = NOW() WHERE id = ? AND email_verified_at IS NULL", [row.user_id]);

  return { ok: true };
}

module.exports = { consumeEmailVerificationByTokenOnly };
