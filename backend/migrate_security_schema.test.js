const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { migrateSecuritySchema, parseMigration } = require("./migrate_security_schema");
const sql = fs.readFileSync(path.join(__dirname, "20260923_prelaunch_security_hardening.sql"), "utf8");

function fixture({ sentAt = true, failAt = null } = {}) {
  const columns = new Set(["users.id", "file_key_escrows.file_id", "verification_reminder_emails.id"]);
  if (sentAt) columns.add("verification_reminder_emails.sent_at");
  const queries = [];
  const db = { query: async query => {
    queries.push(query);
    if (query.includes("INFORMATION_SCHEMA.COLUMNS")) return [[...columns].map(value => {
      const [table_name, column_name] = value.split("."); return { table_name, column_name };
    })];
    if (failAt && query.includes(failAt)) throw new Error("simulated DDL failure");
    const alter = query.match(/^ALTER TABLE `(\w+)` ADD COLUMN\s+(\w+)/i);
    const create = query.match(/^CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
    if (alter) {
      const key = `${alter[1]}.${alter[2]}`;
      assert.equal(columns.has(key), false, `duplicate column: ${key}`); columns.add(key);
    } else if (create) columns.add(`${create[1]}.id`);
    else assert.match(query, /^UPDATE verification_reminder_emails/);
    return [{ affectedRows: 1 }];
  } };
  return { db, columns, queries };
}

test("partially applied schema preserves existing sent_at and applies the complete migration once", async () => {
  const f = fixture();
  const result = await migrateSecuritySchema(f.db, { apply: true, sql, log() {} });
  assert.equal(result.applied, 10);
  assert.ok(f.columns.has("users.session_version"));
  assert.ok(f.columns.has("users.duress_locked_until"));
  assert.ok(f.columns.has("pin_reset_challenges.id"));
  assert.equal(f.queries.some(q => q.startsWith("UPDATE ")), false);
  f.queries.length = 0;
  const repeat = await migrateSecuritySchema(f.db, { apply: true, sql, log() {} });
  assert.equal(repeat.applied, 0);
  assert.equal(f.queries.length, 1);
});
test("check mode reports missing schema without executing any writes", async () => {
  const f = fixture();
  const result = await migrateSecuritySchema(f.db, { sql, log() {} });
  assert.equal(result.missing.length, 10);
  assert.equal(result.applied, 0);
  assert.equal(f.queries.length, 1);
});
test("legacy reminder history is initialized only when sent_at is newly introduced", async () => {
  const f = fixture({ sentAt: false });
  await migrateSecuritySchema(f.db, { apply: true, sql, log() {} });
  assert.equal(f.queries.filter(q => q.startsWith("UPDATE ")).length, 1);
  f.queries.length = 0;
  await migrateSecuritySchema(f.db, { apply: true, sql, log() {} });
  assert.equal(f.queries.some(q => q.startsWith("UPDATE ")), false);
});
test("DDL errors stop the migration rather than falsely reporting success", async () => {
  const f = fixture({ failAt: "ADD COLUMN duress_locked_until" });
  await assert.rejects(migrateSecuritySchema(f.db, { apply: true, sql, log() {} }), /simulated DDL failure/);
  assert.equal(f.queries.some(q => q.includes("CREATE TABLE")), false);
});
test("unrecognized SQL is rejected before database access", async () => {
  assert.equal(parseMigration(sql).length, 12);
  const f = fixture();
  await assert.rejects(migrateSecuritySchema(f.db, { apply: true, sql: sql + "\nDROP TABLE users;", log() {} }), /Unrecognized statement/);
  assert.equal(f.queries.length, 0);
});
