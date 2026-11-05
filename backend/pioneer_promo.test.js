const test = require("node:test");
const assert = require("node:assert/strict");
const { OFFER, findPromotion, isPioneer, checkoutTerms } = require("./pioneer_promo");

function makePromo(overrides = {}) {
  return {
    id: "promo_test",
    code: "PIONEERABC",
    active: true,
    max_redemptions: 1,
    times_redeemed: 0,
    metadata: { uac_offer: OFFER },
    coupon: {
      id: "coupon_pioneer",
      percent_off: 20,
      duration: "forever",
      valid: true,
      metadata: { uac_offer: OFFER },
    },
    ...overrides,
  };
}

test("trial requires marked, unused, single-use code and 20% forever marked coupon", () => {
  assert.equal(isPioneer(makePromo()), true);
  for (const bad of [
    { metadata: {} },
    { active: false },
    { max_redemptions: 2 },
    { times_redeemed: 1 },
    { expires_at: Math.floor(Date.now() / 1000) - 60 },
    { coupon: { percent_off: 100, duration: "forever", metadata: { uac_offer: OFFER } } },
    { coupon: { percent_off: 20, duration: "once", metadata: { uac_offer: OFFER } } },
    { coupon: { percent_off: 20, duration: "forever", metadata: {} } },
  ]) assert.equal(isPioneer(makePromo(bad)), false);
});

test("marked promotion with unverified coupon is rejected instead of silently losing the trial", async () => {
  const promo = makePromo({ coupon: "coupon_pioneer" });
  const stripe = {
    promotionCodes: { list: async () => ({ data: [promo] }) },
    coupons: { retrieve: async () => ({ id: "coupon_pioneer", percent_off: 20, duration: "forever", metadata: {} }) },
  };
  assert.equal(await findPromotion(stripe, "pioneerabc"), null);
});

test("server resolves a current Stripe promotion.coupon ID to the marked coupon", async () => {
  const promo = makePromo({ coupon: undefined, promotion: { type: "coupon", coupon: "coupon_pioneer" } });
  let calls = 0;
  const stripe = {
    promotionCodes: { list: async ({ code }) => { assert.equal(code, "PIONEERABC"); return { data: [promo] }; } },
    coupons: { retrieve: async (id) => {
      calls += 1;
      assert.equal(id, "coupon_pioneer");
      return { id, percent_off: 20, duration: "forever", valid: true, metadata: { uac_offer: OFFER } };
    } },
  };
  const checked = await findPromotion(stripe, "pioneerabc");
  assert.equal(calls, 1);
  assert.equal(isPioneer(checked), true);
  assert.equal(checkoutTerms(checked).subscription.trial_period_days, 30);
});

test("promotion lookup validates code, remaining redemption count and expiration", async () => {
  const stripe = { promotionCodes: { list: async () => ({ data: [makePromo()] }) } };
  assert.equal((await findPromotion(stripe, "pioneerabc")).id, "promo_test");
  stripe.promotionCodes.list = async () => ({ data: [makePromo({ times_redeemed: 1 })] });
  assert.equal(await findPromotion(stripe, "PIONEERABC"), null);
  assert.equal(await findPromotion(stripe, "bad code"), null);
  assert.equal(await findPromotion(stripe, "x".repeat(50)), null);
});

test("checkout terms distinguish Pioneer trial from ordinary promo discounts", () => {
  const pioneer = checkoutTerms(makePromo());
  assert.deepEqual(pioneer.checkout.discounts, [{ promotion_code: "promo_test" }]);
  assert.equal(pioneer.checkout.allow_promotion_codes, false);
  assert.equal(pioneer.checkout.payment_method_collection, "always");
  assert.equal(pioneer.subscription.trial_period_days, 30);
  assert.equal(pioneer.subscription.trial_settings.end_behavior.missing_payment_method, "cancel");
  const ordinary = checkoutTerms(makePromo({ metadata: {} }));
  assert.equal(ordinary.pioneer, false);
  assert.deepEqual(ordinary.checkout.discounts, [{ promotion_code: "promo_test" }]);
  assert.deepEqual(ordinary.subscription, {});
  assert.deepEqual(checkoutTerms(null).subscription, {});
  assert.equal(checkoutTerms(null).checkout.allow_promotion_codes, false);
});
