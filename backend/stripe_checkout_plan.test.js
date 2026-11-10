const assert = require("node:assert/strict");
const test = require("node:test");
const { planFromSubscription } = require("./stripe_checkout_plan");

function subscription(metadata, unitAmount = 499) {
  return { metadata, items: { data: [{ price: { unit_amount: unitAmount } }] } };
}

test("reads the plan the subscription was bought for", () => {
  const plan = planFromSubscription(subscription({
    user_id: "7", storage_gb: "5", checkin_frequency: "monthly", billing_interval: "monthly", addons_json: "[]",
  }));
  assert.deepEqual(plan, { storageGb: 5, checkinFrequency: "monthly", billingInterval: "monthly", amountCents: 499 });
});

test("rejects metadata that is missing or outside the plan range", () => {
  assert.equal(planFromSubscription(null), null);
  assert.equal(planFromSubscription(subscription({})), null);
  assert.equal(planFromSubscription(subscription({ storage_gb: "500", checkin_frequency: "daily", billing_interval: "monthly" })), null);
  assert.equal(planFromSubscription(subscription({ storage_gb: "12", checkin_frequency: "daily", billing_interval: "monthly" })), null);
  assert.equal(planFromSubscription(subscription({ storage_gb: "50", checkin_frequency: "hourly", billing_interval: "monthly" })), null);
  assert.equal(planFromSubscription(subscription({ storage_gb: "50", checkin_frequency: "daily", billing_interval: "weekly" })), null);
});

test("leaves the amount empty when Stripe gives no unit price", () => {
  const plan = planFromSubscription(subscription({ storage_gb: "200", checkin_frequency: "daily", billing_interval: "annual" }, null));
  assert.equal(plan.amountCents, null);
  assert.equal(plan.storageGb, 200);
});
