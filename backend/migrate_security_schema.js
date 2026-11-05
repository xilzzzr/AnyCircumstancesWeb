const fs = require("node:fs");
const path = require("node:path");

const MIGRATION_PATH = path.join(__dirname, "20260923_prelaunch_security_hardening.sql");

// This runner is deliberately limited to the bundled prelaunch migration.
// Parse the complete file before executing anything, and fail on new SQL forms.
function parseMigration(sql) {
  return sql.replace(/^\s*--[^\r\n]*/gm, "").split(";").map(s => s.trim()).filter(Boolean).flatMap(statement => {
    const alter = statement.match(/^ALTER TABLE\s+(\w+)\s+([\s\S]+)$/i);
    if (alter) return alter[2].split(/,\s*(?=ADD COLUMN\b)/i).map(clause => {
      const column = clause.trim().match(/^ADD COLUMN\s+(\w+)\b/i);
      if (!column) throw new Error("Unrecognized migration ALTER clause");
      return { kind: "column", table: alter[1], column: column[1], sql: `ALTER TABLE \`${alter[1]}\` ${clause.trim()}` };
    });
    const create = statement.match(/^CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(/i);
    if (create) return [{ kind: "table", table: create[1], sql: statement }];
    if (/^UPDATE verification_reminder_emails\s+SET sent_at = UTC_TIMESTAMP\(3\)\s+WHERE sent_at IS NULL$/i.test(statement)) {
      return [{ kind: "reminder_history", sql: statement }];
    }
    throw new Error("Unrecognized statement in the security migration");
  });
}

async function migrateSecuritySchema(db, { apply = false, sql = fs.readFileSync(MIGRATION_PATH, "utf8"), log = console.log } = {}) {
  const operations = parseMigration(sql);
  const [rows] = await db.query(`SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
    FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`);
  const columns = new Set(rows.map(r => `${r.table_name}.${r.column_name}`));
  const tables = new Set(rows.map(r => r.table_name));
  // Preserve existing timestamps AND pending NULL values when this column
  // predates the migration. Never mark current pending reminders as delivered.
  const hadSentAt = columns.has("verification_reminder_emails.sent_at");
  const missing = [];
  for (const operation of operations) {
    if (operation.kind === "reminder_history") {
      if (apply && !hadSentAt) {
        await db.query(operation.sql);
        log("Initialized legacy reminder history.");
      }
      continue;
    }
    const name = operation.kind === "column" ? `${operation.table}.${operation.column}` : operation.table;
    const present = operation.kind === "column" ? columns.has(name) : tables.has(name);
    if (present) { log(`Already exists: ${name}`); continue; }
    missing.push(name);
    if (!apply) { log(`Missing: ${name}`); continue; }
    await db.query(operation.sql);
    if (operation.kind === "column") columns.add(name);
    else tables.add(name);
    log(`Applied: ${name}`);
  }
  return { missing, applied: apply ? missing.length : 0 };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--check", "--apply"].includes(args[0])) {
    throw new Error("Usage: node backend/migrate_security_schema.js --check|--apply");
  }
  require("./environment").initializeEnvironment();
  const { authPool } = require("./auth");
  let connection;
  let locked = false;
  try {
    connection = await authPool.getConnection();
    if (args[0] === "--apply") {
      const [rows] = await connection.query("SELECT GET_LOCK('uac_prelaunch_security_migration', 10) AS acquired");
      if (Number(rows[0]?.acquired) !== 1) throw new Error("Another security migration is running; retry later");
      locked = true;
    }
    const result = await migrateSecuritySchema(connection, { apply: args[0] === "--apply" });
    if (args[0] === "--apply") console.log(`Migration complete. Applied ${result.applied} missing schema change(s).`);
    else if (result.missing.length) {
      console.log("Security schema is incomplete. Back up the database, then run with --apply.");
      process.exitCode = 2;
    } else console.log("Security schema is up to date.");
  } finally {
    try {
      if (locked) await connection.query("SELECT RELEASE_LOCK('uac_prelaunch_security_migration')");
    } finally {
      if (connection) connection.release();
      await authPool.end();
    }
  }
}

if (require.main === module) main().catch(error => {
  console.error("Security migration failed:", error.code || error.message);
  process.exitCode = 1;
});

module.exports = { migrateSecuritySchema, parseMigration };
