const test = require("node:test");
const assert = require("node:assert/strict");
const { OFFER, findPromotion, isPioneer } = require("./pioneer_promo");
const makePromo = (overrides = {}) => ({
 id:"promo_test", code:"PIONEERABC", active:true, max_redemptions:1,
 times_redeemed:0, metadata:{uac_offer:OFFER},
 coupon:{percent_off:20, duration:"forever", valid:true}, ...overrides
});
test("pioneer requires offer marker, 20% forever, and exactly one redemption", () => {
 assert.equal(isPioneer(makePromo()), true);
 assert.equal(isPioneer(makePromo({metadata:{}})), false);
 assert.equal(isPioneer(makePromo({max_redemptions:2})), false);
 assert.equal(isPioneer(makePromo({times_redeemed:1})), false);
 assert.equal(isPioneer(makePromo({coupon:{percent_off:100,duration:"forever"}})), false);
});
test("promotion lookup checks active and redemption status", async () => {
 const stripe = {promotionCodes:{list:async () => ({data:[makePromo()]})}};
 assert.equal((await findPromotion(stripe,"pioneerabc")).id,"promo_test");
 stripe.promotionCodes.list = async () => ({data:[makePromo({times_redeemed:1})]});
 assert.equal(await findPromotion(stripe,"PIONEERABC"),null);
 assert.equal(await findPromotion(stripe,"bad code"),null);
});
