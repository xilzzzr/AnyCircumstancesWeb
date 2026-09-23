const { purgeVaultFiles, deleteUserRecords } = require("./account_lifecycle");
const { refreshAggregateBillingStatus } = require("./apple_subscriptions");

async function queueAccountLifecycleJob(pool, {
  userId,
  action,
  stripeSubscriptionId = "",
}) {
  if (!["cancel_files", "delete_account"].includes(action)) {
    throw new Error("invalid_account_lifecycle_action");
  }

  const uid = String(userId);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (action === "delete_account") {
      await conn.query(
        `UPDATE users
         SET session_version = session_version + 1,
             duress_locked_until = '9999-12-31 23:59:59.999'
         WHERE id = ?
         LIMIT 1`,
        [uid]
      );
    } else {
      await conn.query(
        "UPDATE users SET session_version = session_version + 1 WHERE id = ? LIMIT 1",
        [uid]
      );
    }

    await conn.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
      [uid]
    );

    await conn.query(
      `INSERT INTO account_lifecycle_jobs
        (user_id, action, stripe_subscription_id, status, attempts, last_error)
       VALUES (?, ?, ?, 'pending', 0, NULL)
       ON DUPLICATE KEY UPDATE
         action = VALUES(action),
         stripe_subscription_id = VALUES(stripe_subscription_id),
         status = 'pending',
         last_error = NULL`,
      [uid, action, stripeSubscriptionId || null]
    );

    await conn.commit();
  } catch (error) {
    try { await conn.rollback(); } catch {}
    throw error;
  } finally {
    conn.release();
  }
}

async function cancelStripeSubscription(stripe, subscriptionId) {
  if (!subscriptionId) return;
  if (!stripe) throw new Error("stripe_not_configured");
  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    const code = String(error?.code || "");
    const type = String(error?.type || "");
    const message = String(error?.message || "");
    const alreadyGone =
      code === "resource_missing" ||
      type === "StripeInvalidRequestError" && /no such subscription|already canceled/i.test(message);
    if (!alreadyGone) throw error;
  }
}

async function processAccountLifecycleJob(pool, stripe, job) {
  const userId = String(job.user_id);
  const action = String(job.action);
  const subscriptionId = String(job.stripe_subscription_id || "");

  await pool.query(
    `UPDATE account_lifecycle_jobs
     SET status='processing', attempts=attempts+1, last_error=NULL
     WHERE user_id = ?`,
    [userId]
  );

  try {
    await cancelStripeSubscription(stripe, subscriptionId);

    if (subscriptionId) {
      await pool.query(
        `UPDATE billing_entitlements
         SET status='inactive'
         WHERE provider='stripe' AND external_subscription_id = ?`,
        [subscriptionId]
      );
    }

    await purgeVaultFiles(pool, userId);

    if (action === "delete_account") {
      await deleteUserRecords(pool, userId);
    } else if (action === "cancel_files") {
      await refreshAggregateBillingStatus(pool, userId);
    } else {
      throw new Error("invalid_account_lifecycle_action");
    }

    await pool.query("DELETE FROM account_lifecycle_jobs WHERE user_id = ?", [userId]);
    return { ok: true };
  } catch (error) {
    await pool.query(
      `UPDATE account_lifecycle_jobs
       SET status='failed', last_error=?
       WHERE user_id = ?`,
      [String(error?.message || error || "account_action_failed").slice(0, 255), userId]
    ).catch(() => null);
    return { ok: false, error };
  }
}

async function processPendingAccountLifecycleJobs(pool, stripe, { limit = 20 } = {}) {
  const [jobs] = await pool.query(
    `SELECT user_id, action, stripe_subscription_id, attempts
     FROM account_lifecycle_jobs
     WHERE status IN ('pending','failed') AND attempts < 10
     ORDER BY updated_at, created_at
     LIMIT ?`,
    [Math.max(1, Math.min(100, Number(limit) || 20))]
  );

  let completed = 0;
  let failed = 0;
  for (const job of jobs || []) {
    const out = await processAccountLifecycleJob(pool, stripe, job);
    if (out.ok) completed += 1;
    else failed += 1;
  }
  return { completed, failed };
}

async function attemptAccountLifecycleJob(pool, stripe, userId) {
  const [rows] = await pool.query(
    `SELECT user_id, action, stripe_subscription_id, attempts
     FROM account_lifecycle_jobs
     WHERE user_id = ?
     LIMIT 1`,
    [String(userId)]
  );
  if (!rows?.[0]) return { ok: true, missing: true };
  return processAccountLifecycleJob(pool, stripe, rows[0]);
}

module.exports = {
  attemptAccountLifecycleJob,
  processPendingAccountLifecycleJobs,
  queueAccountLifecycleJob,
};
