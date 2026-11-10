// The plan a Stripe subscription was actually bought for.
//
// Checkout writes the plan into the subscription's metadata on the server, in
// the same call that sets the price, and plan changes update it there too. Use
// it when a checkout completes. billing_profiles is not safe for this: it holds
// whichever plan the account last opened a checkout for, which may be a more
// expensive plan opened in another tab and never paid for.

const FREQUENCIES = new Set(["daily", "weekly", "monthly"]);
const INTERVALS = new Set(["monthly", "annual"]);

function planFromSubscription(subscription) {
  const metadata = subscription?.metadata || {};
  const storageGb = Number(metadata.storage_gb);
  const checkinFrequency = String(metadata.checkin_frequency || "");
  const billingInterval = String(metadata.billing_interval || "");

  if (!Number.isInteger(storageGb) || storageGb < 5 || storageGb > 200 || storageGb % 5 !== 0) return null;
  if (!FREQUENCIES.has(checkinFrequency) || !INTERVALS.has(billingInterval)) return null;

  const unitAmount = Number(subscription?.items?.data?.[0]?.price?.unit_amount);
  return {
    storageGb,
    checkinFrequency,
    billingInterval,
    amountCents: Number.isInteger(unitAmount) && unitAmount > 0 ? unitAmount : null,
  };
}

module.exports = { planFromSubscription };
