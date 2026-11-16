const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");
const { createUtcPool } = require("../database");

// Explicit test-only connection settings; never inherit the application's DB_*.
const socketPath = process.env.MYSQL_TEST_SOCKET;
const host = process.env.MYSQL_TEST_HOST;
if (!socketPath && !host) throw new Error("Set MYSQL_TEST_SOCKET or MYSQL_TEST_HOST for an isolated test database");
const config = {
  ...(socketPath ? { socketPath } : { host, port: Number(process.env.MYSQL_TEST_PORT || 3306) }),
  user: process.env.MYSQL_TEST_USER || "root",
  password: process.env.MYSQL_TEST_PASSWORD || "",
  timezone: "Z",
};
const sent = [];
nodemailer.createTransport = () => ({ sendMail: async message => { sent.push(message); } });
Object.assign(process.env, {
  SMTP_HOST: "smtp.example.test", SMTP_PORT: "587", SMTP_USER: "test", SMTP_PASS: "test",
  EMAIL_FROM: "sender@example.test",
});
const { queueEmergencyDispatch, deliverPendingEmergencyDispatches, cancelPendingDispatchesForContact } = require("../emergency_delivery");
const { createStripeSubscriptionSync } = require("../stripe_subscription_state");
const { refreshAggregateBillingStatus } = require("../apple_subscriptions");

test("release behavior with real MySQL queries and transactions", async t => {
  const name = `uac_release_test_${crypto.randomBytes(8).toString("hex")}`;
  const admin = await mysql.createConnection(config);
  await admin.query(`CREATE DATABASE \`${name}\``);
  const pool = createUtcPool({ ...config, database: name, connectionLimit: 5 });
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP DATABASE \`${name}\``);
    await admin.end();
  });

  // Use the shipped migration's delivery tables, including timestamps and ENUMs.
  const schema = fs.readFileSync(path.join(__dirname, "../20260923_prelaunch_security_hardening.sql"), "utf8");
  for (const match of schema.matchAll(/CREATE TABLE IF NOT EXISTS[\s\S]*?;/g)) await pool.query(match[0]);
  const billingSchema = fs.readFileSync(path.join(__dirname, "../20260812_add_multi_provider_entitlements.sql"), "utf8");
  await pool.query(billingSchema.match(/CREATE TABLE IF NOT EXISTS billing_entitlements[\s\S]*?;/)[0]);
  for (const statement of [
    "CREATE TABLE users (id BIGINT PRIMARY KEY, email VARCHAR(254), display_name VARCHAR(100))",
    "CREATE TABLE emergency_contacts (id BIGINT PRIMARY KEY, user_id BIGINT, email VARCHAR(254), name VARCHAR(100), verified_at DATETIME(3), public_key TEXT)",
    "CREATE TABLE files (id VARCHAR(255) PRIMARY KEY, user_id BIGINT)",
    "CREATE TABLE emergency_contact_file_assignments (contact_id BIGINT, file_id VARCHAR(255), PRIMARY KEY(contact_id, file_id))",
    "CREATE TABLE verification_settings (user_id BIGINT PRIMARY KEY, next_due_at DATETIME(3), grace_period_hours INT, last_checkin_at DATETIME(3))",
    "CREATE TABLE contact_file_share_tokens (id BIGINT AUTO_INCREMENT PRIMARY KEY, contact_id BIGINT, file_id VARCHAR(255), token_hash CHAR(64), expires_at DATETIME(3), delivery_group_id CHAR(36), used_at DATETIME(3))",
    "CREATE TABLE verification_emergency_dispatches (user_id BIGINT, due_at DATETIME(3), PRIMARY KEY(user_id, due_at))",
    "CREATE TABLE verification_panic_dispatches (user_id BIGINT, ip VARCHAR(64), user_agent VARCHAR(255))",
    "CREATE TABLE file_key_escrows (file_id VARCHAR(255) PRIMARY KEY, enc_key_b64 TEXT)",
    "CREATE TABLE billing_profiles (user_id BIGINT PRIMARY KEY, stripe_subscription_id VARCHAR(255), status VARCHAR(32), current_period_end DATETIME(3), storage_limit_gb INT, checkin_frequency VARCHAR(16), billing_interval VARCHAR(16))",
  ]) await pool.query(statement);

  const due = new Date(Date.now() - 48 * 3600_000);
  const tables = ["verification_emergency_contact_dispatches", "contact_file_share_tokens", "verification_emergency_dispatches", "emergency_contact_file_assignments", "emergency_contacts", "files", "users", "verification_settings", "file_key_escrows", "billing_entitlements", "billing_profiles"];
  async function seed() {
    sent.length = 0;
    for (const table of tables) await pool.query(`DELETE FROM ${table}`);
    await pool.query("INSERT INTO users VALUES (1, 'owner@example.test', 'Owner')");
    await pool.query("INSERT INTO emergency_contacts VALUES (7, 1, 'contact@example.test', 'Contact', UTC_TIMESTAMP(3), NULL)");
    await pool.query("INSERT INTO files VALUES ('users/1/a', 1), ('users/1/b', 1)");
    await pool.query("INSERT INTO emergency_contact_file_assignments VALUES (7, 'users/1/a'), (7, 'users/1/b')");
    await pool.query("INSERT INTO verification_settings VALUES (1, ?, 6, NULL)", [due]);
    const queued = await queueEmergencyDispatch(pool, { userId: 1, dueAt: due, reason: "scheduled", requireOverdue: true });
    assert.equal(queued.queued, 1);
  }
  async function row() {
    const [rows] = await pool.query("SELECT status, attempts, last_error FROM verification_emergency_contact_dispatches");
    return rows[0];
  }
  async function tokenCount() {
    const [rows] = await pool.query("SELECT COUNT(*) AS n FROM contact_file_share_tokens");
    return rows[0].n;
  }

  await t.test("every new pooled connection uses UTC independently of the server zone", async () => {
    const connections = await Promise.all([pool.getConnection(), pool.getConnection(), pool.getConnection()]);
    try {
      for (const connection of connections) {
        const [[zone]] = await connection.query("SELECT @@session.time_zone AS zone, ABS(TIMESTAMPDIFF(SECOND, NOW(), UTC_TIMESTAMP())) AS offset_seconds");
        assert.equal(zone.zone, "+00:00");
        assert.equal(zone.offset_seconds, 0);
      }
    } finally { connections.forEach(connection => connection.release()); }
  });

  await t.test("concurrent workers deliver a claimed release only once", async () => {
    await seed();
    await Promise.all([deliverPendingEmergencyDispatches(pool), deliverPendingEmergencyDispatches(pool)]);
    assert.equal(sent.length, 1);
    assert.equal(await tokenCount(), 2);
    assert.equal((await row()).status, "delivered");
  });
  await t.test("checking in cancels a scheduled retry permanently", async () => {
    await seed();
    await pool.query("UPDATE verification_settings SET last_checkin_at = UTC_TIMESTAMP(3)");
    await deliverPendingEmergencyDispatches(pool);
    await deliverPendingEmergencyDispatches(pool);
    assert.equal(sent.length, 0);
    assert.equal(await tokenCount(), 0);
    assert.match((await row()).last_error, /^cancelled:/);
  });
  await t.test("unassigned files are excluded at delivery time", async () => {
    await seed();
    await pool.query("DELETE FROM emergency_contact_file_assignments WHERE file_id = 'users/1/a'");
    await deliverPendingEmergencyDispatches(pool);
    assert.equal(sent.length, 1);
    const [tokens] = await pool.query("SELECT file_id FROM contact_file_share_tokens");
    assert.deepEqual(tokens.map(r => r.file_id), ["users/1/b"]);
  });
  await t.test("cancelled contacts are never requeued by the retry policy", async () => {
    await seed();
    await cancelPendingDispatchesForContact(pool, 7, "contact_email_changed");
    await deliverPendingEmergencyDispatches(pool);
    assert.equal(sent.length, 0);
    assert.equal((await row()).attempts, 20);
  });
  await t.test("failed deliveries wait for their backoff before becoming claimable", async () => {
    await seed();
    await pool.query("UPDATE verification_emergency_contact_dispatches SET status = 'failed', attempts = 1");
    await deliverPendingEmergencyDispatches(pool);
    assert.equal(sent.length, 0);
    await pool.query("UPDATE verification_emergency_contact_dispatches SET updated_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 MINUTE)");
    await deliverPendingEmergencyDispatches(pool);
    assert.equal(sent.length, 1);
    assert.equal((await row()).attempts, 2);
  });
  await t.test("a later token insert failure cleans up earlier committed tokens", async () => {
    await seed();
    await pool.query("CREATE TRIGGER fail_second_token BEFORE INSERT ON contact_file_share_tokens FOR EACH ROW BEGIN IF NEW.file_id = 'users/1/b' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_token_insert_failure'; END IF; END");
    try {
      const result = await deliverPendingEmergencyDispatches(pool);
      assert.equal(result.failed, 1);
      assert.equal(sent.length, 0);
      assert.equal(await tokenCount(), 0);
    } finally { await pool.query("DROP TRIGGER fail_second_token"); }
  });
  await t.test("recipient changes during link creation cancel delivery and revoke tokens", async () => {
    await seed();
    let changed = false;
    const duringCreation = { query: async (sql, params) => {
      const result = await pool.query(sql, params);
      if (!changed && sql.startsWith("INSERT INTO contact_file_share_tokens")) {
        changed = true;
        await pool.query("UPDATE emergency_contacts SET email = 'new@example.test', verified_at = NULL WHERE id = 7");
        await cancelPendingDispatchesForContact(pool, 7, "contact_email_changed");
      }
      return result;
    } };
    await deliverPendingEmergencyDispatches(duringCreation);
    assert.equal(sent.length, 0);
    assert.equal(await tokenCount(), 0);
  });
  await t.test("a worker that lost its lease cannot cancel the newer worker's attempt", async () => {
    await seed();
    let changed = false;
    const lostLease = { query: async (sql, params) => {
      const result = await pool.query(sql, params);
      if (!changed && sql.startsWith("INSERT INTO contact_file_share_tokens")) {
        changed = true;
        await pool.query("UPDATE verification_emergency_contact_dispatches SET attempts = attempts + 1");
      }
      return result;
    } };
    await deliverPendingEmergencyDispatches(lostLease);
    assert.equal(sent.length, 0);
    assert.equal(await tokenCount(), 0);
    assert.equal((await row()).status, "processing");
    assert.equal((await row()).attempts, 2);
  });
  await t.test("escrow reuse SQL compares bytes across base64 spellings", async () => {
    await seed();
    const filesSource = fs.readFileSync(path.join(__dirname, "../files.js"), "utf8");
    const sql = filesSource.match(/`(SELECT file_id FROM file_key_escrows[\s\S]*?LIMIT 1)`/)[1];
    const bytes = Buffer.alloc(256, 251);
    const canonical = bytes.toString("base64");
    const aliases = [canonical, canonical.replace(/=+$/, ""), bytes.toString("base64url"), canonical.slice(0, -3) + "x=="];
    for (const encoded of aliases) {
      assert.deepEqual(Buffer.from(encoded, "base64"), bytes);
      await pool.query("DELETE FROM file_key_escrows");
      await pool.query("INSERT INTO file_key_escrows VALUES ('users/1/a', ?)", [encoded]);
      const [matches] = await pool.query(sql, [canonical, "users/2/copied"]);
      assert.equal(matches.length, 1, encoded);
    }
    const [fresh] = await pool.query(sql, [Buffer.alloc(256, 9).toString("base64"), "users/2/fresh"]);
    assert.equal(fresh.length, 0);
  });
  await t.test("Stripe sync uses the subscription plan and denies incomplete entitlements", async () => {
    await seed();
    await pool.query("INSERT INTO billing_profiles VALUES (1, 'sub_test', 'pending_setup', NULL, 200, 'daily', 'annual')");
    const live = { id: "sub_test", status: "active", metadata: { user_id: "1", storage_gb: "5", checkin_frequency: "monthly", billing_interval: "monthly" }, items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400, price: { unit_amount: 499 } }] } };
    const sync = createStripeSubscriptionSync({ pool, stripe: { subscriptions: { retrieve: async () => live } }, refreshAggregateBillingStatus });
    await sync("sub_test");
    const [[profile]] = await pool.query("SELECT * FROM billing_profiles WHERE user_id = 1");
    assert.equal(profile.status, "active");
    assert.equal(profile.storage_limit_gb, 5);
    live.metadata = { user_id: "1" };
    await sync("sub_test");
    const [[invalid]] = await pool.query("SELECT status FROM billing_profiles WHERE user_id = 1");
    assert.equal(invalid.status, "paused");
  });
});
