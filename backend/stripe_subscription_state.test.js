const assert = require("node:assert/strict");
const test = require("node:test");
const { invoiceSubscriptionId, stripeAccess, subscriptionPeriodEnd } = require("./stripe_subscription_state");

test("only active and trialing subscriptions grant access", () => {
  assert.equal(stripeAccess("active").entitlementStatus, "active");
  assert.equal(stripeAccess("trialing").entitlementStatus, "active");
  for (const status of ["past_due", "unpaid", "incomplete", "incomplete_expired", "paused", "canceled", "", undefined]) {
    assert.equal(stripeAccess(status).entitlementStatus, "inactive", String(status));
  }
  assert.equal(stripeAccess("canceled").profileStatus, "paused");
});

test("the period end is read from subscription items in current Stripe versions", () => {
  assert.equal(subscriptionPeriodEnd({ items: { data: [{ current_period_end: 1_800_000_000 }] } }).getTime(), 1_800_000_000_000);
  assert.equal(subscriptionPeriodEnd({ current_period_end: 1_700_000_000 }).getTime(), 1_700_000_000_000);
  assert.equal(subscriptionPeriodEnd({ items: { data: [] } }), null);
  assert.equal(subscriptionPeriodEnd(null), null);
});

test("an invoice's subscription is found in both the old and the current format", () => {
  assert.equal(invoiceSubscriptionId({ subscription: "sub_old" }), "sub_old");
  assert.equal(invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_new" } } }), "sub_new");
  assert.equal(invoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: "sub_obj" } } } }), "sub_obj");
  assert.equal(invoiceSubscriptionId({}), "");
});
