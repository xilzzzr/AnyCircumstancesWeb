const test = require("node:test");
const assert = require("node:assert/strict");

const lifecyclePath = require.resolve("./account_lifecycle");
let purges = 0;
let deletes = 0;
require.cache[lifecyclePath] = {
  id: lifecyclePath,
  filename: lifecyclePath,
  loaded: true,
  exports: {
    purgeVaultFiles: async () => { purges += 1; return { deletedFiles: 1 }; },
    deleteUserRecords: async () => { deletes += 1; },
  },
};
const applePath = require.resolve("./apple_subscriptions");
let refreshes = 0;
require.cache[applePath] = {
  id: applePath,
  filename: applePath,
  loaded: true,
  exports: { refreshAggregateBillingStatus: async () => { refreshes += 1; } },
};

const {
  attemptAccountLifecycleJob,
  queueAccountLifecycleJob,
} = require("./account_actions");

function makePool() {
  let job = null;
  let sessionBumps = 0;
  let refreshRevocations = 0;

  const query = async (sql, params) => {
    if (sql.startsWith("UPDATE users SET session_version")) {
      sessionBumps += 1;
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("UPDATE refresh_tokens")) {
      refreshRevocations += 1;
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("INSERT INTO account_lifecycle_jobs")) {
      job = {
        user_id: String(params[0]),
        action: params[1],
        stripe_subscription_id: params[2],
        attempts: 0,
        status: "pending",
      };
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("SELECT user_id, action, stripe_subscription_id, attempts")) {
      return [job ? [job] : []];
    }
    if (sql.startsWith("UPDATE account_lifecycle_jobs") && sql.includes("status='processing'")) {
      job.status = "processing";
      job.attempts += 1;
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("UPDATE account_lifecycle_jobs") && sql.includes("status='failed'")) {
      job.status = "failed";
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("UPDATE billing_entitlements")) return [{ affectedRows: 1 }];
    if (sql.startsWith("DELETE FROM account_lifecycle_jobs")) {
      job = null;
      return [{ affectedRows: 1 }];
    }
    throw new Error("Unexpected SQL: " + sql);
  };

  return {
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
    }),
    snapshot: () => ({ job, sessionBumps, refreshRevocations }),
  };
}

test("destructive account cleanup survives a transient Stripe failure and retries idempotently", async () => {
  purges = 0;
  deletes = 0;
  refreshes = 0;
  const pool = makePool();

  await queueAccountLifecycleJob(pool, {
    userId: 1,
    action: "cancel_files",
    stripeSubscriptionId: "sub_test",
  });

  assert.equal(pool.snapshot().sessionBumps, 1);
  assert.equal(pool.snapshot().refreshRevocations, 1);

  let calls = 0;
  const stripe = {
    subscriptions: {
      cancel: async () => {
        calls += 1;
        if (calls === 1) throw new Error("temporary_stripe_failure");
        return { id: "sub_test", status: "canceled" };
      },
    },
  };

  const first = await attemptAccountLifecycleJob(pool, stripe, 1);
  assert.equal(first.ok, false);
  assert.equal(pool.snapshot().job.status, "failed");
  assert.equal(purges, 0);

  const second = await attemptAccountLifecycleJob(pool, stripe, 1);
  assert.equal(second.ok, true);
  assert.equal(pool.snapshot().job, null);
  assert.equal(purges, 1);
  assert.equal(refreshes, 1);
  assert.equal(deletes, 0);
});
