// Run manually with STRIPE_SECRET_KEY set. Do NOT commit the generated private CSV.
// Usage: STRIPE_SECRET_KEY=sk_test_... node create_pioneer_codes.js /secure/path/pioneer-codes.csv
const Stripe = require("stripe");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { OFFER } = require("./pioneer_promo");
const key = process.env.STRIPE_SECRET_KEY;
const output = process.argv[2];
if (!key || !output || !path.isAbsolute(output)) {
 console.error("Provide STRIPE_SECRET_KEY and an ABSOLUTE private CSV output path.");
 process.exit(1);
}
if (fs.existsSync(output)) { console.error("Output file already exists; refusing to overwrite."); process.exit(1); }
const stripe = new Stripe(key);
(async () => {
 let coupon;
 for await (const c of stripe.coupons.list({limit:100})) {
   if (c.metadata?.uac_offer === OFFER && c.duration === "forever" && c.percent_off === 20) {
     coupon = c; break;
   }
 }
 if (!coupon) coupon = await stripe.coupons.create({
   name:"AnyCircumstances Pioneer: 20% for life after 30-day trial",
   percent_off:20, duration:"forever", metadata:{uac_offer:OFFER}
 }, { idempotencyKey:"uac-pioneer-30days-20forever-coupon-v1" });
 const existing = [];
 for await (const p of stripe.promotionCodes.list({limit:100})) {
   if (p.metadata?.uac_offer === OFFER) existing.push(p);
 }
 if (existing.length > 50) throw new Error("More than 50 pioneer codes already exist.");
 const rows = existing.map(p => ({code:p.code, id:p.id}));
 while (rows.length < 50) {
   const code = "PIONEER" + crypto.randomBytes(7).toString("hex").toUpperCase();
   const promo = await stripe.promotionCodes.create({
     promotion:{type:"coupon",coupon:coupon.id},
     code, max_redemptions:1,
     metadata:{uac_offer:OFFER}
   }, {idempotencyKey:"uac-pioneer-"+code});
   rows.push({code:promo.code,id:promo.id});
 }
 fs.writeFileSync(output,"code,stripe_promotion_id\n"+rows.map(r=>r.code+","+r.id).join("\n")+"\n",{flag:"wx",mode:0o600});
 console.log("Saved "+rows.length+" private promotion codes to "+output);
})().catch(e=>{ console.error(e.message);process.exitCode=1; });
