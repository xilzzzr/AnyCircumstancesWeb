const fs = require("fs");
const crypto = require("crypto");
const { SignedDataVerifier, Environment } = require("@apple/app-store-server-library");

const ACTIVE_NOTIFICATION_TYPES = new Set([
  "SUBSCRIBED",
  "DID_RENEW",
  "DID_RECOVER",
  "DID_CHANGE_RENEWAL_STATUS",
  "DID_CHANGE_RENEWAL_PREF",
  "OFFER_REDEEMED",
  "RENEWAL_EXTENDED",
]);
const INACTIVE_NOTIFICATION_TYPES = new Set(["EXPIRED", "REFUND", "REVOKE"]);

function sandboxAllowed() {
  return process.env.NODE_ENV !== "production" && String(process.env.ALLOW_APPLE_SANDBOX || "").toLowerCase() === "true";
}

function configuredProductIds() {
  return new Set(
    String(process.env.APPLE_SUBSCRIPTION_PRODUCT_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

const DEFAULT_PRODUCT_PLANS = {
  "com.anycircumstances.subscription.starter.monthly": { storageLimitGb: 5, checkInFrequency: "monthly", billingInterval: "monthly" },
  "com.anycircumstances.subscription.plus.monthly": { storageLimitGb: 25, checkInFrequency: "weekly", billingInterval: "monthly" },
  "com.anycircumstances.subscription.commercial.monthly": { storageLimitGb: 200, checkInFrequency: "daily", billingInterval: "monthly" },
};

function productPlan(productId) {
  const configured = String(process.env.APPLE_PRODUCT_PLAN_JSON || "").trim();
  if (configured) {
    const parsed = JSON.parse(configured);
    if (parsed && parsed[productId]) return parsed[productId];
  }
  return DEFAULT_PRODUCT_PLANS[productId] || null;
}

function loadRootCertificates() {
  const paths = String(process.env.APPLE_ROOT_CA_PATHS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!paths.length) throw new Error("apple_root_certificates_not_configured");
  return paths.map((filePath) => fs.readFileSync(filePath));
}

function buildVerifier(environment) {
  const bundleId = String(process.env.APPLE_BUNDLE_ID || "").trim();
  const appAppleId = Number(process.env.APPLE_APP_ID || 0) || undefined;
  if (!bundleId) throw new Error("apple_bundle_id_not_configured");
  if (environment === Environment.PRODUCTION && !appAppleId) throw new Error("apple_app_id_not_configured");
  return new SignedDataVerifier(loadRootCertificates(), true, environment, bundleId, appAppleId);
}

async function verifyNotification(signedPayload) {
  let productionError;
  try {
    return await buildVerifier(Environment.PRODUCTION).verifyAndDecodeNotification(signedPayload);
  } catch (error) {
    productionError = error;
  }
  if (!sandboxAllowed()) {
    const error = new Error("invalid_apple_notification_signature");
    error.cause = productionError;
    throw error;
  }
  try {
    return await buildVerifier(Environment.SANDBOX).verifyAndDecodeNotification(signedPayload);
  } catch (sandboxError) {
    const error = new Error("invalid_apple_notification_signature");
    error.cause = { productionError, sandboxError };
    throw error;
  }
}

async function verifyTransaction(signedTransactionInfo, environmentHint) {
  const wantsSandbox = String(environmentHint || "").toLowerCase() === "sandbox";
  const environments = wantsSandbox && sandboxAllowed()
    ? [Environment.SANDBOX]
    : sandboxAllowed()
      ? [Environment.PRODUCTION, Environment.SANDBOX]
      : [Environment.PRODUCTION];
  let lastError;
  for (const environment of environments) {
    try {
      return await buildVerifier(environment).verifyAndDecodeTransaction(signedTransactionInfo);
    } catch (error) {
      lastError = error;
    }
  }
  const error = new Error("invalid_apple_transaction_signature");
  error.cause = lastError;
  throw error;
}

function assertSupportedProduct(transaction) {
  const products = configuredProductIds();
  if (!products.size) throw new Error("apple_product_ids_not_configured");
  if (!products.has(String(transaction.productId || ""))) throw new Error("unsupported_apple_product");
}

function transactionIsActive(transaction, notificationType) {
  if (transaction.revocationDate) return false;
  if (INACTIVE_NOTIFICATION_TYPES.has(String(notificationType || ""))) return false;
  const expiresAt = Number(transaction.expiresDate || 0);
  if (expiresAt) return expiresAt > Date.now();
  return ACTIVE_NOTIFICATION_TYPES.has(String(notificationType || ""));
}

async function findUserForTransaction(pool, transaction) {
  const token = String(transaction.appAccountToken || "").toLowerCase();
  if (token) {
    const [links] = await pool.query(
      "SELECT user_id FROM apple_account_links WHERE app_account_token = ? LIMIT 1",
      [token]
    );
    if (links?.[0]?.user_id) return String(links[0].user_id);
  }
  const originalId = String(transaction.originalTransactionId || "");
  if (originalId) {
    const [rows] = await pool.query(
      "SELECT user_id FROM billing_entitlements WHERE provider = 'apple' AND external_subscription_id = ? LIMIT 1",
      [originalId]
    );
    if (rows?.[0]?.user_id) return String(rows[0].user_id);
  }
  return null;
}

async function upsertAppleEntitlement(pool, userId, transaction, notificationType, environment) {
  assertSupportedProduct(transaction);
  const originalId = String(transaction.originalTransactionId || "");
  if (!originalId) throw new Error("missing_original_transaction_id");
  const active = transactionIsActive(transaction, notificationType);
  const expiresAt = transaction.expiresDate ? new Date(Number(transaction.expiresDate)) : null;
  const plan = productPlan(String(transaction.productId || ""));
  if (!plan) throw new Error("apple_product_plan_not_configured");
  await pool.query(
    `INSERT INTO billing_entitlements
      (user_id, provider, external_subscription_id, product_id, status, environment, current_period_end,
       storage_limit_gb, checkin_frequency, billing_interval, raw_metadata_json)
     VALUES (?, 'apple', ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id), product_id = VALUES(product_id), status = VALUES(status),
       environment = VALUES(environment), current_period_end = VALUES(current_period_end),
       storage_limit_gb = VALUES(storage_limit_gb), checkin_frequency = VALUES(checkin_frequency),
       billing_interval = VALUES(billing_interval),
       raw_metadata_json = VALUES(raw_metadata_json)`,
    [String(userId), originalId, String(transaction.productId), active ? "active" : "inactive",
      String(environment || transaction.environment || ""), expiresAt,
      Number(plan.storageLimitGb), String(plan.checkInFrequency), String(plan.billingInterval || "monthly"),
      JSON.stringify({ transactionId: transaction.transactionId, notificationType })]
  );
  await refreshAggregateBillingStatus(pool, userId);
  return { active, expiresAt, originalTransactionId: originalId };
}

async function refreshAggregateBillingStatus(pool, userId) {
  const [rows] = await pool.query(
    `SELECT provider, current_period_end, storage_limit_gb, checkin_frequency, billing_interval
     FROM billing_entitlements
     WHERE user_id = ? AND status = 'active'
       AND (current_period_end IS NULL OR current_period_end > UTC_TIMESTAMP(3))
     ORDER BY COALESCE(storage_limit_gb, 0) DESC, current_period_end DESC LIMIT 1`,
    [String(userId)]
  );
  const active = rows?.[0] || null;
  if (active) {
    await pool.query(
      `UPDATE billing_profiles SET status = 'active', current_period_end = ?,
       storage_limit_gb = COALESCE(?, storage_limit_gb),
       checkin_frequency = COALESCE(?, checkin_frequency),
       billing_interval = COALESCE(?, billing_interval)
       WHERE user_id = ?`,
      [active.current_period_end || null, active.storage_limit_gb || null,
        active.checkin_frequency || null, active.billing_interval || null, String(userId)]
    );
  } else {
    await pool.query(
      "UPDATE billing_profiles SET status = 'paused', current_period_end = NULL WHERE user_id = ?",
      [String(userId)]
    );
  }
}

async function ensureAppleAccountToken(pool, userId) {
  const [rows] = await pool.query("SELECT app_account_token FROM apple_account_links WHERE user_id = ? LIMIT 1", [String(userId)]);
  if (rows?.[0]?.app_account_token) return String(rows[0].app_account_token);
  const token = crypto.randomUUID();
  await pool.query("INSERT INTO apple_account_links (user_id, app_account_token) VALUES (?, ?)", [String(userId), token]);
  return token;
}

async function transactionBelongsToAnotherUser(pool, userId, originalTransactionId) {
  const [rows] = await pool.query(
    `SELECT user_id FROM billing_entitlements
     WHERE provider = 'apple' AND external_subscription_id = ? LIMIT 1`,
    [String(originalTransactionId)]
  );
  return Boolean(rows?.[0]?.user_id && String(rows[0].user_id) !== String(userId));
}

function createAppleNotificationHandler(pool) {
  return async function appleNotificationHandler(req, res) {
    let recordedUuid = "";
    try {
      const signedPayload = String(req.body?.signedPayload || "");
      if (!signedPayload) return res.status(400).json({ ok: false, error: "missing_signed_payload" });
      const notification = await verifyNotification(signedPayload);
      const uuid = String(notification.notificationUUID || "");
      if (uuid) {
        try {
          await pool.query(
            "INSERT INTO apple_notification_events (notification_uuid, notification_type, environment) VALUES (?, ?, ?)",
            [uuid, String(notification.notificationType || ""), String(notification.data?.environment || "")]
          );
          recordedUuid = uuid;
        } catch (error) {
          if (error?.code === "ER_DUP_ENTRY") return res.status(200).json({ ok: true, duplicate: true });
          throw error;
        }
      }
      const signedTransaction = notification.data?.signedTransactionInfo;
      if (signedTransaction) {
        const transaction = await verifyTransaction(signedTransaction, notification.data?.environment);
        const userId = await findUserForTransaction(pool, transaction);
        if (userId) {
          await upsertAppleEntitlement(pool, userId, transaction, notification.notificationType, notification.data?.environment);
        }
      }
      return res.status(200).json({ ok: true });
    } catch (error) {
      if (recordedUuid) {
        await pool.query("DELETE FROM apple_notification_events WHERE notification_uuid = ?", [recordedUuid]).catch(() => null);
      }
      console.error("[APPLE SUBSCRIPTION ERROR]", error?.stack || error);
      return res.status(400).json({ ok: false, error: "invalid_apple_notification" });
    }
  };
}

module.exports = {
  createAppleNotificationHandler,
  ensureAppleAccountToken,
  transactionBelongsToAnotherUser,
  refreshAggregateBillingStatus,
  upsertAppleEntitlement,
  verifyTransaction,
};
