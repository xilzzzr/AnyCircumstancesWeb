const Stripe = require("stripe");
const { purgeVaultFiles, deleteUserRecords } = require("./account_lifecycle");
const { refreshAggregateBillingStatus } = require("./apple_subscriptions");

function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  return key ? new Stripe(key) : null;
}

async function cancelStripeIfNeeded(pool, userId) {
  const [rows] = await pool.query(
    "SELECT stripe_subscription_id FROM billing_profiles WHERE user_id = ? LIMIT 1",
    [String(userId)]
  );
  const subscriptionId = String(rows?.[0]?.stripe_subscription_id || "");
  if (!subscriptionId) return;

  const stripe = stripeClient();
  if (!stripe) throw new Error("stripe_not_configured");

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription && subscription.status !== "canceled") {
      await stripe.subscriptions.cancel(subscriptionId);
    }
  } catch (error) {
    const code = String(error?.code || "");
    const type = String(error?.type || "");
    if (!(code === "resource_missing" || type === "StripeInvalidRequestError" && /No such subscription/i.test(String(error?.message || "")))) {
      throw error;
    }
  }

  await pool.query(
    "UPDATE billing_entitlements SET status = 'inactive' WHERE provider = 'stripe' AND external_subscription_id = ?",
    [subscriptionId]
  );
}

async function getAppleState(pool, userId) {
  const [rows] = await pool.query(
    "SELECT EXISTS(SELECT 1 FROM billing_entitlements WHERE user_id = ? AND provider = 'apple' AND status = 'active') AS has_apple",
    [String(userId)]
  );
  return Boolean(rows?.[0]?.has_apple);
}

async function enqueueAccountLifecycleJob(pool, userId, action) {
  if (!["cancel_subscription", "delete_account"].includes(action)) throw new Error("invalid_account_job_action");
  const [result] = await pool.query(
    "INSERT INTO account_lifecycle_jobs (user_id, action, status) VALUES (?, ?, 'pending')",
    [String(userId), action]
  );
  return Number(result.insertId);
}

async function processAccountLifecycleJob(pool, jobId) {
  const [jobs] = await pool.query(
    "SELECT id, user_id, action, status FROM account_lifecycle_jobs WHERE id = ? LIMIT 1",
    [Number(jobId)]
  );
  const job = jobs?.[0];
  if (!job) throw new Error("account_job_not_found");
  if (job.status === "completed") return { ok: true, completed: true };

  await pool.query(
    "UPDATE account_lifecycle_jobs SET status = 'running', attempt_count = attempt_count + 1, last_error = NULL WHERE id = ?",
    [job.id]
  );

  try {
    const userId = String(job.user_id);
    const hasApple = await getAppleState(pool, userId);
    await cancelStripeIfNeeded(pool, userId);
    const purge = await purgeVaultFiles(pool, userId);

    if (job.action === "delete_account") {
      await deleteUserRecords(pool, userId);
    } else {
      await refreshAggregateBillingStatus(pool, userId);
    }

    await pool.query(
      "UPDATE account_lifecycle_jobs SET status = 'completed', completed_at = UTC_TIMESTAMP(3), last_error = NULL WHERE id = ?",
      [job.id]
    );
    return {
      ok: true,
      completed: true,
      deletedFiles: Number(purge?.deletedFiles || 0),
      requiresAppleAction: hasApple,
      appleManageUrl: hasApple ? "https://apps.apple.com/account/subscriptions" : null,
    };
  } catch (error) {
    await pool.query(
      "UPDATE account_lifecycle_jobs SET status = 'retry', last_error = ? WHERE id = ?",
      [String(error?.message || error || "account_job_failed").slice(0, 240), job.id]
    ).catch(() => null);
    throw error;
  }
}

async function processPendingAccountJobs(pool, limit = 20) {
  const [jobs] = await pool.query(
    `SELECT id
     FROM account_lifecycle_jobs
     WHERE status IN ('pending', 'retry')
        OR (status = 'running' AND updated_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE))
     ORDER BY created_at
     LIMIT ?`,
    [Number(limit)]
  );
  for (const job of jobs || []) {
    try {
      await processAccountLifecycleJob(pool, job.id);
    } catch (error) {
      console.error("[account lifecycle retry]", job.id, String(error?.message || error).slice(0, 240));
    }
  }
}

module.exports = {
  enqueueAccountLifecycleJob,
  processAccountLifecycleJob,
  processPendingAccountJobs,
};
