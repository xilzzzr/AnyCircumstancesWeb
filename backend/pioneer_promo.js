// A free trial is granted only for server-provisioned, single-use Pioneer invitations.
// The client supplies only a code. Never accept discount or trial terms from the client.
const OFFER = "pioneer_30days_20forever";

function couponFromCode(promo) {
  return promo?.resolvedCoupon || promo?.coupon || promo?.promotion?.coupon || null;
}

function isPioneer(promo) {
  const coupon = couponFromCode(promo);
  const validCoupon = coupon && typeof coupon === "object" &&
    coupon.percent_off === 20 &&
    coupon.duration === "forever" &&
    coupon.valid !== false &&
    coupon.metadata?.uac_offer === OFFER;
  return Boolean(
    promo?.metadata?.uac_offer === OFFER &&
    promo.active === true &&
    promo.max_redemptions === 1 &&
    Number(promo.times_redeemed || 0) === 0 &&
    (!promo.expires_at || promo.expires_at > Math.floor(Date.now() / 1000)) &&
    validCoupon
  );
}

function checkoutTerms(promotion) {
  const pioneer = Boolean(promotion && isPioneer(promotion));
  return {
    pioneer,
    checkout: {
      // Entry on our website is required so only verified Pioneer codes get a trial.
      allow_promotion_codes: false,
      ...(promotion ? { discounts: [{ promotion_code: promotion.id }] } : {}),
      ...(pioneer ? { payment_method_collection: "always" } : {}),
    },
    subscription: pioneer ? {
      trial_period_days: 30,
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    } : {},
  };
}

async function findPromotion(stripe, input) {
  const code = String(input || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,40}$/.test(code)) return null;

  const matches = await stripe.promotionCodes.list({ code, active: true, limit: 20 });
  const promo = (matches.data || []).find((p) =>
    String(p.code || "").toUpperCase() === code &&
    p.active === true &&
    (p.max_redemptions == null || Number(p.times_redeemed || 0) < p.max_redemptions) &&
    (!p.expires_at || p.expires_at > Math.floor(Date.now() / 1000)) &&
    p.restrictions?.minimum_amount == null
  ) || null;
  if (!promo) return null;

  if (promo.metadata?.uac_offer !== OFFER) return promo;

  // The SDK can return an ID rather than an expanded coupon.
  // Reject a marked code unless the server can verify every offer term.
  const coupon = couponFromCode(promo);
  const id = typeof coupon === "string" ? coupon : coupon?.id;
  if (!id && typeof coupon !== "object") return null;
  const resolvedCoupon = typeof coupon === "string"
    ? await stripe.coupons.retrieve(id)
    : coupon;
  const checked = { ...promo, resolvedCoupon };
  return isPioneer(checked) ? checked : null;
}

module.exports = { OFFER, couponFromCode, isPioneer, findPromotion, checkoutTerms };
