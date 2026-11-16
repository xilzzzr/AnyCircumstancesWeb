const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { planFromSubscription } = require("./stripe_checkout_plan");
const {
  createStripeSubscriptionSync,
  invoiceSubscriptionId,
  stripeAccess,
  subscriptionPeriodEnd,
} = require("./stripe_subscription_state");

const source = fs.readFileSync(require.resolve("./auth.js"), "utf8").replace(/\r\n/g, "\n");

const PERIOD_END_SECONDS = 1_800_000_000;
const cheapPlan = { user_id: "7", storage_gb: "5", checkin_frequency: "monthly", billing_interval: "monthly", addons_json: "[]" };

// The subscription as Stripe reports it now (what subscriptions.retrieve returns).
function liveSubscription({ status = "active", metadata = cheapPlan } = {}) {
  return {
    id: "sub_cheap",
    status,
    metadata,
    items: { data: [{ current_period_end: PERIOD_END_SECONDS, price: { unit_amount: 499 } }] },
  };
}

// Runs the real Stripe webhook handler for one event. billing_profiles may hold
// the plan the account last opened a checkout for; the subscription's metadata
// holds the plan that was actually paid for.
async function runWebhook({ type, object, live = liveSubscription() }) {
  const start = source.indexOf("async function stripeWebhookHandler(");
  const end = source.indexOf("\n}\n", start) + 2;
  assert.ok(start > 0 && end > start, "webhook handler not found in auth.js");

  const queries = [];
  const errors = [];
  let refreshed = 0;
  const pool = {
    query: async (sql, params = []) => {
      queries.push({ sql, params: [...params] });
      if (sql.startsWith("SELECT user_id FROM billing_profiles")) return [[{ user_id: "7" }]];
      return [{}];
    },
  };
  const stripe = {
    webhooks: { constructEvent: () => ({ id: "evt_1", type, data: { object } }) },
    subscriptions: { retrieve: async () => live },
  };
  const refreshAggregateBillingStatus = async () => { refreshed += 1; };
  const context = {
    String, Number, Date, Error, JSON,
    process: { env: { STRIPE_WEBHOOK_SECRET: "whsec_test" } },
    planFromSubscription, stripeAccess, subscriptionPeriodEnd, invoiceSubscriptionId,
    syncStripeSubscription: createStripeSubscriptionSync({ pool, stripe, refreshAggregateBillingStatus }),
    logError: (label) => errors.push(label),
    refreshAggregateBillingStatus,
    pool,
    stripe,
  };
  vm.runInNewContext(`${source.slice(start, end)}\nthis.handler = stripeWebhookHandler;`, context);

  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
  await context.handler({ headers: { "stripe-signature": "sig" }, body: Buffer.from("{}") }, res);
  const entitlement = queries.find((q) => q.sql.includes("INSERT INTO billing_entitlements"));
  return { res, queries, errors, refreshed, entitlement };
}

function completeCheckout(live) {
  return runWebhook({
    type: "checkout.session.completed",
    object: { subscription: "sub_cheap", client_reference_id: "7" },
    live,
  });
}

test("a paid checkout grants the plan in the paid subscription, not the last plan opened in another tab", async () => {
  const { res, queries, refreshed, entitlement } = await completeCheckout(liveSubscription());
  assert.equal(res.statusCode, 200);
  assert.ok(entitlement, "entitlement written");
  assert.doesNotMatch(entitlement.sql, /FROM billing_profiles/);
  const [userId, subId, periodEnd, ...plan] = entitlement.params;
  assert.deepEqual([userId, subId, ...plan], ["7", "sub_cheap", 5, "monthly", "monthly"]);
  assert.equal(new Date(periodEnd).getTime(), PERIOD_END_SECONDS * 1000);

  const profile = queries.find((q) => q.sql.includes("UPDATE billing_profiles"));
  assert.deepEqual(profile.params, ["sub_cheap", 5, "monthly", "monthly", 499, "7"]);
  assert.equal(refreshed, 1);
});

test("a checkout whose first payment is still pending grants nothing yet", async () => {
  const { entitlement, queries } = await completeCheckout(liveSubscription({ status: "incomplete" }));
  assert.equal(entitlement, undefined);
  assert.equal(queries.some((q) => /status = 'active'/.test(q.sql)), false);
});

test("a checkout whose subscription has no plan metadata grants nothing and is flagged", async () => {
  const { res, entitlement, errors } = await completeCheckout(liveSubscription({ metadata: { user_id: "7" } }));
  assert.equal(res.statusCode, 200);
  assert.equal(entitlement, undefined);
  assert.ok(errors.includes("stripe:checkout-plan-missing"));
});

test("a checkout whose subscription belongs to another account grants nothing", async () => {
  const { queries, errors } = await completeCheckout(liveSubscription({ metadata: { ...cheapPlan, user_id: "8" } }));
  assert.equal(queries.some((q) => q.sql.includes("billing_entitlements") || q.sql.includes("UPDATE billing_profiles")), false);
  assert.ok(errors.includes("stripe:checkout-user-mismatch"));
});

test("a subscription update records the subscription's own plan and its item period end", async () => {
  const { entitlement } = await runWebhook({
    type: "customer.subscription.updated",
    object: { id: "sub_cheap", status: "active", metadata: cheapPlan },
  });
  assert.ok(entitlement, "entitlement written");
  const [userId, subId, status, periodEnd, ...plan] = entitlement.params;
  assert.deepEqual([userId, subId, status, ...plan], ["7", "sub_cheap", "active", 5, "monthly", "monthly"]);
  assert.equal(new Date(periodEnd).getTime(), PERIOD_END_SECONDS * 1000);
});

test("a late 'active' event cannot switch a cancelled subscription back on", async () => {
  const { entitlement, queries } = await runWebhook({
    type: "customer.subscription.updated",
    object: { id: "sub_cheap", status: "active", metadata: cheapPlan },
    live: liveSubscription({ status: "canceled" }),
  });
  assert.equal(entitlement.params[2], "inactive");
  const profile = queries.find((q) => q.sql.startsWith("UPDATE billing_profiles SET status"));
  assert.equal(profile.params[0], "paused");
});

test("a failed renewal payment removes access right away", async () => {
  const { entitlement } = await runWebhook({
    type: "invoice.payment_failed",
    object: { id: "in_1", parent: { subscription_details: { subscription: "sub_cheap" } } },
    live: liveSubscription({ status: "past_due" }),
  });
  assert.equal(entitlement.params[2], "inactive");
});

test("a paid invoice in the current Stripe format is recorded and extends the period", async () => {
  const { queries, entitlement } = await runWebhook({
    type: "invoice.paid",
    object: { id: "in_2", amount_paid: 499, hosted_invoice_url: "https://invoice.example/in_2", parent: { subscription_details: { subscription: "sub_cheap" } } },
  });
  const invoice = queries.find((q) => q.sql.includes("INSERT INTO billing_invoices"));
  assert.ok(invoice, "invoice recorded");
  assert.deepEqual(invoice.params, [7, "Subscription", 499, "https://invoice.example/in_2", "in_2"]);
  assert.equal(entitlement.params[2], "active");
});
