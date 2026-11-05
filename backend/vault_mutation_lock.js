// Serialize vault edits against whole-account and single-file deletion.
// MySQL advisory locks are connection-scoped and work across PM2 processes.
function vaultUserLockName(userId) {
  const id = String(userId || "");
  if (!/^\d{1,32}$/.test(id)) throw new Error("invalid_vault_user_id");
  return "uac_vault_mutation_" + id;
}

async function acquireVaultUserLock(conn, userId) {
  const name = vaultUserLockName(userId);
  const [rows] = await conn.query("SELECT GET_LOCK(?, 10) AS acquired", [name]);
  if (Number(rows?.[0]?.acquired) !== 1) throw new Error("vault_operation_busy");
  return name;
}

async function releaseVaultUserLock(conn, name) {
  if (!name) return;
  await conn.query("SELECT RELEASE_LOCK(?) AS released", [name]);
}

module.exports = { acquireVaultUserLock, releaseVaultUserLock, vaultUserLockName };
