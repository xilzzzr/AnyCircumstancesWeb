// Reporting never creates payments or changes subscriptions. Stripe amounts
// stay in minor units and currencies are always totaled separately.
const idOf = value => typeof value === "string" ? value : value?.id;
const object = value => value && typeof value === "object" ? value : null;

async function collect(list, params, deadline) {
  const all = [];
  let cursor;
  for (;;) {
    if (Date.now() > deadline) throw new Error("report_time_limit");
    const page = await list({ ...params, limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
    all.push(...page.data);
    if (all.length > 100000) throw new Error("report_size_limit");
    if (!page.has_more) return all;
    const next = page.data.at(-1)?.id;
    if (!next || next === cursor) throw new Error("invalid_stripe_page");
    cursor = next;
  }
}

function discountList(owner) {
  return Array.isArray(owner?.discounts) ? owner.discounts : owner?.discount ? [owner.discount] : [];
}

async function resolveDiscounts(stripe, discounts, memo, now) {
  return Promise.all(discounts.map(async value => {
    const d = object(value);
    if (!d) throw new Error("unexpanded_discount");
    if ((d.start && d.start > now) || (d.end && d.end <= now)) return null;
    const c = d.source?.coupon || d.coupon;
    const p = d.promotion_code;
    async function resolve(kind, value) {
      if (!value || object(value)) return value;
      const key = `${kind}:${value}`;
      if (!memo.has(key)) memo.set(key, stripe[kind].retrieve(value));
      return memo.get(key);
    }
    const coupon = await resolve("coupons", c);
    const promo = await resolve("promotionCodes", p);
    if (!coupon || coupon.deleted) throw new Error("coupon_unavailable");
    return { id: d.id, code: promo?.code || null, name: coupon.name || coupon.id,
      couponId: coupon.id, percentOff: coupon.percent_off ?? null, amountOff: coupon.amount_off ?? null,
      currency: coupon.currency || null, duration: coupon.duration, endsAt: d.end || null,
      products: coupon.applies_to?.products || null };
  })).then(values => values.filter(Boolean));
}

function discountedAmount(lines, discounts, recurringOnly = false) {
  const adjusted = lines.map(l => ({ ...l }));
  for (const d of discounts) {
    // One-time coupons affect a bill, not ongoing recurring revenue.
    if (recurringOnly && d.duration === "once") continue;
    const eligible = adjusted.filter(l => !d.products || d.products.includes(l.product));
    const subtotal = eligible.reduce((s, l) => s + l.amount, 0);
    const off = d.percentOff != null ? Math.round(subtotal * d.percentOff / 100)
      : d.currency === adjusted[0]?.currency ? Math.min(subtotal, d.amountOff || 0) : 0;
    if (subtotal) for (const line of eligible) line.amount = Math.max(0, line.amount - off * line.amount / subtotal);
  }
  return adjusted.reduce((s, l) => s + l.amount, 0);
}

async function summarizeSubscription(stripe, sub, memo, now) {
  const items = sub.items?.data || [];
  const customer = object(sub.customer);
  const ds = discountList(sub);
  const discounts = await resolveDiscounts(stripe, ds.length ? ds : discountList(customer), memo, now);
  const itemDiscounts = [];
  const lines = [];
  const recurringLines = [];
  let months = null;
  let supported = items.length > 0 && !sub.items.has_more;
  for (const item of items) {
    const price = item.price;
    const interval = price?.recurring?.interval;
    const count = Number(price?.recurring?.interval_count || 1);
    const itemMonths = interval === "year" ? count * 12 : interval === "month" ? count : null;
    if (!price || price.unit_amount == null || !itemMonths || price.billing_scheme === "tiered" ||
        price.recurring?.usage_type === "metered" || price.transform_quantity || (months && months !== itemMonths)) supported = false;
    months = itemMonths;
    const line = { amount: Number(price?.unit_amount || 0) * Number(item.quantity ?? 1), product: idOf(price?.product), currency: price?.currency };
    const ids = await resolveDiscounts(stripe, discountList(item), memo, now);
    itemDiscounts.push(...ids);
    lines.push({ ...line, amount: discountedAmount([line], ids) });
    recurringLines.push({ ...line, amount: discountedAmount([line], ids, true) });
  }
  if (new Set(lines.map(l => l.currency)).size > 1) supported = false;
  const amount = supported ? Math.round(discountedAmount(lines, discounts)) : null;
  const recurring = supported ? discountedAmount(recurringLines, discounts, true) : null;
  const earning = sub.status === "active" && !sub.pause_collection;
  return { id: sub.id, status: sub.status, currency: sub.currency || lines[0]?.currency,
    interval: months === 12 ? "annual" : months === 1 ? "monthly" : months ? `every ${months} months` : null,
    baseAmountCents: supported ? items.reduce((s, i) => s + i.price.unit_amount * Number(i.quantity ?? 1), 0) : null,
    amountCents: amount, monthlyRecurringCents: earning && supported ? recurring / months : earning ? null : 0,
    discounts: [...discounts, ...itemDiscounts], cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    priceNames: items.map(i => i.price?.nickname).filter(Boolean),
    sale: sub.metadata?.sale_name || sub.metadata?.sale || null,
    supported, trialEnd: sub.trial_end || null };
}

function monthRange(month) {
  const [year, m] = month.split("-").map(Number);
  return { gte: Date.UTC(year, m - 1, 1) / 1000, lt: Date.UTC(year, m, 1) / 1000 };
}

async function buildReport({ pool, stripe }, month) {
  const deadline = Date.now() + 120000;
  const now = Math.floor(Date.now() / 1000);
  const [profiles] = await pool.query("SELECT stripe_customer_id, stripe_subscription_id FROM billing_profiles WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL");
  const [entitlements] = await pool.query("SELECT external_subscription_id FROM billing_entitlements WHERE provider = 'stripe'");
  const customerIds = new Set(profiles.map(p => p.stripe_customer_id).filter(Boolean));
  const subscriptionIds = new Set([...profiles.map(p => p.stripe_subscription_id), ...entitlements.map(e => e.external_subscription_id)].filter(Boolean));
  const subscriptions = {};
  const currencies = {};
  const memo = new Map();
  const warnings = [];
  let mrrComplete = true;
  const totals = currency => currencies[currency] ||= { currency, monthlyRecurringCents: 0, grossCents: 0, feeCents: 0, netCents: 0, adjustmentsCents: 0 };
  const subs = await collect(params => stripe.subscriptions.list(params), { status: "all", expand: ["data.discounts", "data.items.data.discounts", "data.customer"] }, deadline);
  for (const sub of subs) {
    if (!subscriptionIds.has(sub.id)) continue;
    customerIds.add(idOf(sub.customer));
    try {
      if (Date.now() > deadline) throw new Error("report_time_limit");
      const summary = await summarizeSubscription(stripe, sub, memo, now);
      subscriptions[sub.id] = summary;
      if (summary.monthlyRecurringCents == null) { mrrComplete = false; warnings.push(`Recurring revenue unavailable for ${sub.id}: unsupported pricing.`); }
      else totals(summary.currency).monthlyRecurringCents += summary.monthlyRecurringCents;
    } catch {
      mrrComplete = false;
      subscriptions[sub.id] = { id: sub.id, status: sub.status, supported: false, error: "stripe_subscription_details_unavailable" };
      warnings.push(`Price and discount details unavailable for ${sub.id}.`);
    }
  }
  for (const id of subscriptionIds) if (!subscriptions[id]) { mrrComplete = false; warnings.push(`Subscription ${id} was not returned by Stripe.`); }
  const transactions = await collect(params => stripe.balanceTransactions.list(params), { created: monthRange(month), expand: ["data.source"] }, deadline);
  const payments = new Set(["charge", "payment"]);
  const adjustments = new Set(["refund", "payment_refund", "payment_failure_refund", "payment_reversal", "refund_failure", "adjustment"]);
  const chargeMemo = new Map();
  let unattributedAdjustments = 0;
  let separateFees = false;
  for (const t of transactions) {
    if (Date.now() > deadline) throw new Error("report_time_limit");
    if (["stripe_fee", "stripe_fx_fee", "tax_fee"].includes(t.type)) { separateFees = true; continue; }
    if (!payments.has(t.type) && !adjustments.has(t.type)) continue;
    let source = object(t.source);
    if (!source) { if (adjustments.has(t.type)) unattributedAdjustments++; continue; }
    let customerId = idOf(source.customer);
    if (!customerId && source.charge) {
      const chargeId = idOf(source.charge);
      if (!chargeMemo.has(chargeId)) chargeMemo.set(chargeId, object(source.charge) || await stripe.charges.retrieve(chargeId));
      customerId = idOf((await chargeMemo.get(chargeId)).customer);
    }
    if (!customerId && adjustments.has(t.type)) unattributedAdjustments++;
    if (!customerIds.has(customerId)) continue;
    const row = totals(t.currency);
    if (payments.has(t.type)) row.grossCents += t.amount;
    else row.adjustmentsCents += t.amount;
    row.feeCents += t.fee;
    row.netCents += t.net;
  }
  if (unattributedAdjustments) warnings.push(`${unattributedAdjustments} account adjustment(s) could not be attributed to a customer and are excluded.`);
  if (separateFees) warnings.push("Separately billed Stripe account fees are excluded because they cannot be attributed to UAC customers.");
  return { month, generatedAt: new Date().toISOString(), subscriptions,
    currencies: Object.values(currencies).map(c => ({ ...c, monthlyRecurringCents: Math.round(c.monthlyRecurringCents) })),
    warnings, mrrComplete,
    notes: "Recurring revenue is a current-plan estimate before fees and tax, with annual plans divided by 12. One-time coupons are excluded from recurring revenue. Net receipts use actual Stripe balance amounts minus transaction fees, including attributable refunds and disputes, for linked UAC customers. Includes tax collected; excludes payouts, Apple revenue, and separately billed account fees. Months use UTC. Storage GB uses 1,073,741,824 bytes to match upload limits and includes reserved uploads." };
}

function createReportingCache(deps) {
  const cache = new Map();
  return { get(month) {
    if (!deps.stripe) return { state: "unavailable", error: "stripe_not_configured" };
    let entry = cache.get(month);
    if (!entry || (entry.state !== "loading" && Date.now() - entry.updated > 300000)) {
      if (cache.size >= 12) {
        const key = [...cache.keys()].find(k => cache.get(k).state !== "loading");
        if (key) cache.delete(key); else return { state: "unavailable", error: "too_many_reports" };
      }
      entry = { state: "loading", updated: Date.now() };
      cache.set(month, entry);
      buildReport(deps, month).then(report => Object.assign(entry, { state: "ready", report, updated: Date.now() }))
        .catch(() => Object.assign(entry, { state: "unavailable", error: "stripe_report_unavailable", updated: Date.now() }));
    }
    return { state: entry.state, report: entry.report, error: entry.error };
  } };
}

module.exports = { createReportingCache, buildReport, summarizeSubscription, discountedAmount, monthRange };
