const { planFromSubscription } = require("./stripe_checkout_plan");

// How a Stripe subscription status maps to access.
function stripeAccess(status) {
  const value = String(status || "");
  if (value === "active" || value === "trialing") return { profileStatus: "active", entitlementStatus: "active" };
  if (value === "canceled") return { profileStatus: "paused", entitlementStatus: "inactive" };
  // past_due, unpaid, incomplete, incomplete_expired, paused
  return { profileStatus: "past_due", entitlementStatus: "inactive" };
}

// Since Stripe API version 2025-03-31 the billing period lives on the
// subscription items, not the subscription. Reading only the old field left
// the period end empty, which counted as "active forever".
function subscriptionPeriodEnd(subscription) {
  const top = Number(subscription?.current_period_end);
  const itemEnds = (subscription?.items?.data || [])
    .map((item) => Number(item?.current_period_end))
    .filter((seconds) => Number.isFinite(seconds) && seconds > 0);
  const seconds = Number.isFinite(top) && top > 0 ? top : itemEnds.length ? Math.max(...itemEnds) : 0;
  return seconds ? new Date(seconds * 1000) : null;
}

function idOf(value) {
  if (!value) return "";
  return typeof value === "string" ? value : String(value.id || "");
}

// Since API version 2025-03-31 an invoice's subscription is under
// parent.subscription_details. Older payloads have it at the top level.
function invoiceSubscriptionId(invoice) {
  return idOf(invoice?.subscription) || idOf(invoice?.parent?.subscription_details?.subscription);
}

// Applies a subscription's current state as Stripe reports it now, rather than
// the state inside whichever webhook event happens to arrive. Stripe retries
// events for days and doesn't guarantee order, so an old "active" event must
// not switch a cancelled subscription back on.
function createStripeSubscriptionSync({ pool, stripe, refreshAggregateBillingStatus }) {
  return async function syncStripeSubscription(subscriptionId, fallback = null) {
    const id = String(subscriptionId || fallback?.id || "");
    if (!id) return null;

    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(id);
    } catch (error) {
      if (String(error?.code || "") !== "resource_missing" || !fallback) throw error;
      subscription = fallback;
    }

    let userId = subscription?.metadata?.user_id ? String(subscription.metadata.user_id) : "";
    if (!userId) {
      const [ownerRows] = await pool.query(
        "SELECT user_id FROM billing_profiles WHERE stripe_subscription_id = ? LIMIT 1",
        [id]
      );
      userId = ownerRows?.[0]?.user_id ? String(ownerRows[0].user_id) : "";
    }
    if (!userId) return null;

    const access = stripeAccess(subscription?.status);
    const periodEnd = subscriptionPeriodEnd(subscription);
    const plan = planFromSubscription(subscription);

    await pool.query("UPDATE billing_profiles SET status = ?, current_period_end = ? WHERE user_id = ?", [
      access.profileStatus,
      periodEnd,
      userId,
    ]);
    await pool.query(
      `INSERT INTO billing_entitlements
         (user_id, provider, external_subscription_id, status, current_period_end,
          storage_limit_gb, checkin_frequency, billing_interval)
       VALUES (?, 'stripe', ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), status = VALUES(status),
         current_period_end = VALUES(current_period_end),
         storage_limit_gb = COALESCE(VALUES(storage_limit_gb), storage_limit_gb),
         checkin_frequency = COALESCE(VALUES(checkin_frequency), checkin_frequency),
         billing_interval = COALESCE(VALUES(billing_interval), billing_interval)`,
      [
        userId, id, access.entitlementStatus, periodEnd,
        plan ? plan.storageGb : null, plan ? plan.checkinFrequency : null, plan ? plan.billingInterval : null,
      ]
    );
    await refreshAggregateBillingStatus(pool, userId);
    return { userId, status: access.entitlementStatus, periodEnd };
  };
}

module.exports = { createStripeSubscriptionSync, invoiceSubscriptionId, stripeAccess, subscriptionPeriodEnd };
