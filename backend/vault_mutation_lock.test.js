const test = require("node:test");
const assert = require("node:assert/strict");
const { acquireVaultUserLock, releaseVaultUserLock, vaultUserLockName } = require("./vault_mutation_lock");

test("vault mutation locks are deterministic, bounded and scoped to exact user IDs", () => {
  assert.equal(vaultUserLockName(12), "uac_vault_mutation_12");
  assert.notEqual(vaultUserLockName(12), vaultUserLockName(123));
  for (const invalid of ["", "1/2", "1;DROP", "x", "9".repeat(33)]) {
    assert.throws(() => vaultUserLockName(invalid), /invalid_vault_user_id/);
  }
});

test("vault mutation locks acquire and release through parameterized MySQL statements", async () => {
  const calls = [];
  const conn = { query: async (sql, values) => {
    calls.push({ sql, values });
    return [[{ acquired: 1, released: 1 }]];
  } };
  const name = await acquireVaultUserLock(conn, 77);
  await releaseVaultUserLock(conn, name);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /GET_LOCK\(\?, 10\)/);
  assert.deepEqual(calls[0].values, ["uac_vault_mutation_77"]);
  assert.match(calls[1].sql, /RELEASE_LOCK\(\?\)/);
});

test("vault mutation fails closed when the user lock cannot be acquired", async () => {
  await assert.rejects(acquireVaultUserLock({ query: async () => [[{ acquired: 0 }]] }, 10), /vault_operation_busy/);
});
