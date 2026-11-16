const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { planFromSubscription } = require("./stripe_checkout_plan");

const source = fs.readFileSync(require.resolve("./auth.js"), "utf8").replace(/\r\n/g, "\n");

// Runs the real Stripe webhook handler for one event. billing_profiles may hold
// the plan the account last opened a checkout for; the subscription's metadata
// holds the plan that was actually paid for.
async function runWebhook({ type, object, subscriptionMetadata }) {
  const start = source.indexOf("async function stripeWebhookHandler(");
  const end = source.indexOf("\n}\n", start) + 2;
  assert.ok(start > 0 && end > start, "webhook handler not found in auth.js");

  const queries = [];
  const errors = [];
  let refreshed = 0;
  const context = {
    String, Number, Date, Error, JSON,
    process: { env: { STRIPE_WEBHOOK_SECRET: "whsec_test" } },
    planFromSubscription,
    logError: (label) => errors.push(label),
    refreshAggregateBillingStatus: async () => { refreshed += 1; },
    pool: { query: async (sql, params) => { queries.push({ sql, params: [...params] }); return [{}]; } },
    stripe: {
      webhooks: { constructEvent: () => ({ id: "evt_1", type, data: { object } }) },
      subscriptions: {
        retrieve: async () => ({ id: "sub_cheap", metadata: subscriptionMetadata, items: { data: [{ price: { unit_amount: 499 } }] } }),
      },
    },
  };
  vm.runInNewContext(`${source.slice(start, end)}\nthis.handler = stripeWebhookHandler;`, context);

  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
  await context.handler({ headers: { "stripe-signature": "sig" }, body: Buffer.from("{}") }, res);
  return { res, queries, errors, refreshed };
}

function completeCheckout(subscriptionMetadata) {
  return runWebhook({
    type: "checkout.session.completed",
    object: { subscription: "sub_cheap", client_reference_id: "7" },
    subscriptionMetadata,
  });
}

const cheapPlan = { user_id: "7", storage_gb: "5", checkin_frequency: "monthly", billing_interval: "monthly", addons_json: "[]" };

test("a paid checkout grants the plan in the paid subscription, not the last plan opened in another tab", async () => {
  const { res, queries, refreshed } = await completeCheckout(cheapPlan);
  assert.equal(res.statusCode, 200);

  const entitlement = queries.find((q) => q.sql.includes("INSERT INTO billing_entitlements"));
  assert.ok(entitlement, "entitlement written");
  assert.doesNotMatch(entitlement.sql, /FROM billing_profiles/);
  assert.deepEqual(entitlement.params, ["7", "sub_cheap", 5, "monthly", "monthly"]);

  const profile = queries.find((q) => q.sql.includes("UPDATE billing_profiles"));
  assert.deepEqual(profile.params, ["sub_cheap", 5, "monthly", "monthly", 499, "7"]);
  assert.equal(refreshed, 1);
});

test("a checkout whose subscription has no plan metadata grants nothing and is flagged", async () => {
  const { res, queries, errors } = await completeCheckout({ user_id: "7" });
  assert.equal(res.statusCode, 200);
  assert.equal(queries.some((q) => q.sql.includes("INSERT INTO billing_entitlements")), false);
  assert.ok(errors.includes("stripe:checkout-plan-missing"));
});

test("a checkout whose subscription belongs to another account grants nothing", async () => {
  const { queries, errors } = await completeCheckout({ ...cheapPlan, user_id: "8" });
  assert.equal(queries.some((q) => q.sql.includes("billing_entitlements") || q.sql.includes("UPDATE billing_profiles")), false);
  assert.ok(errors.includes("stripe:checkout-user-mismatch"));
});

test("a subscription update arriving before checkout completion records the subscription's own plan", async () => {
  const { queries } = await runWebhook({
    type: "customer.subscription.updated",
    object: { id: "sub_cheap", status: "active", metadata: cheapPlan },
  });
  const entitlement = queries.find((q) => q.sql.includes("INSERT INTO billing_entitlements"));
  assert.ok(entitlement, "entitlement written");
  assert.deepEqual(entitlement.params, ["7", "sub_cheap", "active", null, 5, "monthly", "monthly"]);
});
