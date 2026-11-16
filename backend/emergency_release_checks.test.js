const test = require("node:test");
const assert = require("node:assert/strict");
const nodemailer = require("nodemailer");

// Fake mail transport; set up before emergency_delivery creates its transporter.
const sentMail = [];
let failNextSend = false;
nodemailer.createTransport = () => ({
  sendMail: async (message) => {
    if (failNextSend) { failNextSend = false; throw new Error("smtp_unavailable"); }
    sentMail.push(message);
  },
});
Object.assign(process.env, { SMTP_HOST: "smtp.test", SMTP_PORT: "587", SMTP_USER: "sender@example.test", SMTP_PASS: "test", EMAIL_FROM: "sender@example.test" });

const { cancelPendingDispatchesForContact, deliverPendingEmergencyDispatches } = require("./emergency_delivery");

const due = new Date("2026-11-01T12:00:00Z");

function dispatchRow(overrides = {}) {
  return {
    id: 501, user_id: 1, contact_id: 7, due_at: due, reason: "scheduled", attempts: 0,
    file_ids_json: JSON.stringify(["users/1/a", "users/1/b"]),
    email: "contact@example.test", name: "Contact", public_key: null,
    owner_email: "owner@example.test", owner_name: "Owner",
    ...overrides,
  };
}

// A pool that answers the delivery loop's queries and records what it did.
function makePool({ dispatch, lastCheckinAt = null, assigned = ["users/1/a", "users/1/b"], failDeliveredUpdate = false }) {
  const log = { tokens: 0, revoked: 0, cancelled: [], failed: [], delivered: 0 };
  const query = async (sql, params = []) => {
    if (sql.includes("FROM verification_emergency_contact_dispatches d")) return [[dispatch]];
    if (sql.includes("SET status='processing'")) return [{ affectedRows: 1 }];
    if (sql.includes("SELECT last_checkin_at FROM verification_settings")) return [[{ last_checkin_at: lastCheckinAt }]];
    if (sql.includes("JOIN emergency_contact_file_assignments a")) {
      const requested = params.slice(2);
      return [requested.filter((id) => assigned.includes(id)).map((id) => ({ id }))];
    }
    if (sql.startsWith("INSERT INTO contact_file_share_tokens")) { log.tokens += 1; return [{}]; }
    if (sql.includes("SET status='delivered'")) {
      if (failDeliveredUpdate) { failDeliveredUpdate = false; throw new Error("db_down"); }
      log.delivered += 1;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes("SUM(status = 'delivered')")) return [[{ delivered_count: 1, total_count: 1 }]];
    if (sql.startsWith("INSERT IGNORE INTO verification_emergency_dispatches")) return [{}];
    if (sql.startsWith("DELETE FROM contact_file_share_tokens")) { log.revoked += 1; return [{}]; }
    if (sql.includes("SET status='failed', attempts=?")) { log.cancelled.push(params[1]); return [{}]; }
    if (sql.includes("SET status='failed', last_error=?")) { log.failed.push(params[0]); return [{}]; }
    throw new Error("Unexpected SQL: " + sql);
  };
  return { query, log };
}

test.beforeEach(() => { sentMail.length = 0; failNextSend = false; });

test("a scheduled release is cancelled if the owner checked in after the missed deadline", async () => {
  const pool = makePool({ dispatch: dispatchRow(), lastCheckinAt: new Date("2026-11-02T08:00:00Z") });
  const out = await deliverPendingEmergencyDispatches(pool, {});
  assert.equal(sentMail.length, 0);
  assert.equal(out.delivered, 0);
  assert.deepEqual(pool.log.cancelled, ["cancelled:checked_in"]);
});

test("a panic release still goes out after a later check-in", async () => {
  const pool = makePool({ dispatch: dispatchRow({ reason: "panic_checkin" }), lastCheckinAt: new Date("2026-11-02T08:00:00Z") });
  const out = await deliverPendingEmergencyDispatches(pool, {});
  assert.equal(sentMail.length, 1);
  assert.equal(out.delivered, 1);
});

test("files unassigned since the release was queued are not sent", async () => {
  const pool = makePool({ dispatch: dispatchRow(), assigned: ["users/1/b"] });
  await deliverPendingEmergencyDispatches(pool, {});
  assert.equal(sentMail.length, 1);
  assert.equal(pool.log.tokens, 1);
});

test("a release with no files left assigned is cancelled, not retried", async () => {
  const pool = makePool({ dispatch: dispatchRow(), assigned: [] });
  const out = await deliverPendingEmergencyDispatches(pool, {});
  assert.equal(sentMail.length, 0);
  assert.equal(out.failed, 0);
  assert.deepEqual(pool.log.cancelled, ["cancelled:no_assigned_files"]);
});

test("links already emailed are kept if recording the delivery fails", async () => {
  const pool = makePool({ dispatch: dispatchRow(), failDeliveredUpdate: true });
  const out = await deliverPendingEmergencyDispatches(pool, {});
  assert.equal(sentMail.length, 1);
  assert.equal(pool.log.revoked, 0);
  assert.equal(pool.log.failed.length, 0);
  assert.equal(out.delivered, 1);
});

test("a failed send revokes its unsent links and is left for a retry", async () => {
  failNextSend = true;
  const pool = makePool({ dispatch: dispatchRow() });
  const out = await deliverPendingEmergencyDispatches(pool, {});
  assert.equal(sentMail.length, 0);
  assert.equal(pool.log.revoked, 1);
  assert.deepEqual(pool.log.failed, ["smtp_unavailable"]);
  assert.equal(out.failed, 1);
});

test("changing a contact cancels deliveries queued for them", async () => {
  const calls = [];
  await cancelPendingDispatchesForContact({ query: async (sql, params) => { calls.push({ sql, params }); return [{}]; } }, 7, "contact_email_changed");
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /WHERE contact_id = \? AND status IN \('pending','failed','processing'\)/);
  assert.deepEqual(calls[0].params.slice(1), ["cancelled:contact_email_changed", "7"]);
});
