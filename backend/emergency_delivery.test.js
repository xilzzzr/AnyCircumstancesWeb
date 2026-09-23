const test = require("node:test");
const assert = require("node:assert/strict");
const { queueEmergencyDispatch } = require("./emergency_delivery");

function makePool({ currentDueAt, graceHours = 24, contacts = [{ id: 7 }], assignments = [{ contact_id: 7, file_id: "users/1/file" }] }) {
  const writes = [];
  let committed = false;
  let rolledBack = false;

  const query = async (sql, params) => {
    if (sql.includes("FROM verification_settings")) {
      return [[{ next_due_at: currentDueAt, grace_period_hours: graceHours }]];
    }
    if (sql.includes("FROM emergency_contacts") && sql.startsWith("SELECT")) {
      return [contacts];
    }
    if (sql.includes("FROM emergency_contact_file_assignments")) {
      return [assignments];
    }
    if (sql.startsWith("INSERT IGNORE INTO verification_emergency_contact_dispatches")) {
      writes.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("INSERT INTO verification_panic_dispatches")) {
      writes.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
    throw new Error("Unexpected SQL: " + sql);
  };

  return {
    writes,
    state: () => ({ committed, rolledBack }),
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => { committed = true; },
      rollback: async () => { rolledBack = true; },
      release() {},
    }),
  };
}

test("scheduled emergency queue fails closed when a check-in already moved next_due_at", async () => {
  const staleDue = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const currentDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pool = makePool({ currentDueAt: currentDue });

  const out = await queueEmergencyDispatch(pool, {
    userId: 1,
    dueAt: staleDue,
    reason: "scheduled",
    requireOverdue: true,
  });

  assert.equal(out.ok, true);
  assert.equal(out.queued, 0);
  assert.equal(out.skipped, "no_longer_due");
  assert.equal(pool.writes.length, 0);
  assert.equal(pool.state().rolledBack, true);
});

test("scheduled emergency queue creates one durable row per verified contact after locked re-check", async () => {
  const due = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const pool = makePool({
    currentDueAt: due,
    graceHours: 6,
    contacts: [{ id: 7 }, { id: 8 }],
    assignments: [
      { contact_id: 7, file_id: "users/1/a" },
      { contact_id: 7, file_id: "users/1/b" },
      { contact_id: 8, file_id: "users/1/c" },
    ],
  });

  const out = await queueEmergencyDispatch(pool, {
    userId: 1,
    dueAt: due,
    reason: "scheduled",
    requireOverdue: true,
  });

  assert.equal(out.ok, true);
  assert.equal(out.queued, 2);
  const dispatchWrites = pool.writes.filter((entry) => entry.sql.startsWith("INSERT IGNORE INTO verification_emergency_contact_dispatches"));
  assert.equal(dispatchWrites.length, 2);
  assert.equal(pool.state().committed, true);
});
