const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildReport, summarizeSubscription, monthRange, discountedAmount } = require("./admin_reporting");

const discount = (id, coupon, extra = {}) => ({ id, source: { coupon }, ...extra });
function subscription(overrides = {}) {
  return { id: "sub_uac", customer: "cus_uac", currency: "usd", status: "active", discounts: [],
    items: { data: [{ quantity: 1, price: { unit_amount: 12000, currency: "usd", product: "prod_uac", recurring: { interval: "year" } } }] }, ...overrides };
}
const stripe = { coupons: { retrieve: async id => ({ id, name: "Summer", percent_off: 20, duration: "forever" }) }, promotionCodes: { retrieve: async id => ({ id, code: "SAVE20" }) } };

test("annual plans normalize after recurring discounts, with actual code labels", async () => {
  const sub = subscription({ discounts: [discount("di_a", "coupon_20", { promotion_code: "promo_20" })] });
  const result = await summarizeSubscription(stripe, sub, new Map(), Date.now() / 1000);
  assert.equal(result.amountCents, 9600); assert.equal(result.monthlyRecurringCents, 800);
  assert.equal(result.discounts[0].code, "SAVE20"); assert.equal(result.interval, "annual");
});
test("one-time, expired, fixed, product-scoped, and stacked discounts are handled", async () => {
  const sub = subscription({ discounts: [discount("di_once", { id: "once", percent_off: 50, duration: "once" }), discount("di_expired", { id: "expired", percent_off: 100 }, { end: 1 })] });
  const result = await summarizeSubscription(stripe, sub, new Map(), Date.now() / 1000);
  assert.equal(result.amountCents, 6000); assert.equal(result.monthlyRecurringCents, 1000);
  const lines = [{ amount: 1000, product: "a", currency: "usd" }, { amount: 2000, product: "b", currency: "usd" }];
  assert.equal(discountedAmount(lines, [{ amountOff: 500, currency: "usd", products: ["a"] }, { percentOff: 10 }]), 2250);
  assert.equal(discountedAmount(lines, [{ amountOff: 500, currency: "eur" }]), 3000);
});
test("trials, cancellations and paused plans do not inflate MRR; unsupported prices remain unknown", async () => {
  for (const state of [{ status: "trialing" }, { status: "canceled" }, { pause_collection: {} }]) {
    assert.equal((await summarizeSubscription(stripe, subscription(state), new Map(), 100)).monthlyRecurringCents, 0);
  }
  const sub = subscription(); sub.items.data[0].price.recurring.usage_type = "metered";
  assert.equal((await summarizeSubscription(stripe, sub, new Map(), 100)).monthlyRecurringCents, null);
});
test("UTC month boundaries include leap years", () => {
  const range = monthRange("2024-02"); assert.equal((range.lt - range.gte) / 86400, 29);
});
test("report paginates Stripe data, excludes unrelated payments and payouts, and separates currencies", async () => {
  const pool = { query: async sql => sql.includes("billing_profiles") ? [[{ stripe_customer_id: "cus_uac", stripe_subscription_id: "sub_uac" }]] : [[{ external_subscription_id: "sub_uac" }]] };
  const calls = [];
  const mockStripe = { ...stripe,
    subscriptions: { list: async args => { calls.push(args); return { data: [subscription(), subscription({ id: "sub_other", customer: "cus_other" })], has_more: false }; } },
    balanceTransactions: { list: async args => args.starting_after ? { data: [
      { id: "txn_refund", type: "refund", currency: "usd", amount: -1000, fee: 0, net: -1000, source: { charge: "ch_uac" } },
      { id: "txn_eur", type: "charge", currency: "eur", amount: 500, fee: 40, net: 460, source: { customer: "cus_uac" } },
      { id: "txn_other", type: "charge", currency: "usd", amount: 999999, fee: 0, net: 999999, source: { customer: "cus_other" } },
      { id: "txn_payout", type: "payout", currency: "usd", amount: -999999, fee: 0, net: -999999 },
    ], has_more: false } : { data: [
      { id: "txn_uac", type: "charge", currency: "usd", amount: 12000, fee: 378, net: 11622, source: { customer: "cus_uac" } },
    ], has_more: true } }, charges: { retrieve: async () => ({ customer: "cus_uac" }) },
  };
  const report = await buildReport({ pool, stripe: mockStripe }, "2026-10");
  const usd = report.currencies.find(c => c.currency === "usd");
  assert.deepEqual(usd, { currency: "usd", monthlyRecurringCents: 1000, grossCents: 12000, feeCents: 378, netCents: 10622, adjustmentsCents: -1000 });
  assert.equal(report.currencies.find(c => c.currency === "eur").netCents, 460);
  assert.equal(report.subscriptions.sub_other, undefined); assert.equal(report.mrrComplete, true);
  assert.equal(calls[0].status, "all");
});
