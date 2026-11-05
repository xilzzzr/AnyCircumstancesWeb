// The free month is granted ONLY for Stripe codes provisioned with our offer marker.
// Never trust a client-supplied discount percentage or a promo code alone.
const OFFER = "pioneer_30days_20forever";
function couponFromCode(promo) {
  return promo?.coupon || promo?.promotion?.coupon || null;
}
function isPioneer(promo) {
  const coupon = couponFromCode(promo);
  return promo?.metadata?.uac_offer === OFFER &&
    promo.active === true &&
    promo.max_redemptions === 1 &&
    Number(promo.times_redeemed || 0) === 0 &&
    (!promo.expires_at || promo.expires_at > Math.floor(Date.now() / 1000)) &&
    coupon && typeof coupon === "object" &&
    coupon.percent_off === 20 && coupon.duration === "forever" &&
    coupon.valid !== false;
}
async function findPromotion(stripe, input) {
  const code = String(input || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,40}$/.test(code)) return null;
  const matches = await stripe.promotionCodes.list({ code, active: true, limit: 20 });
  return (matches.data || []).find(p =>
    p.code.toUpperCase() === code &&
    p.active && (p.max_redemptions == null || p.times_redeemed < p.max_redemptions) &&
    (!p.expires_at || p.expires_at > Math.floor(Date.now() / 1000)) &&
    p.restrictions?.minimum_amount == null
  ) || null;
}
module.exports = { OFFER, findPromotion, isPioneer };
