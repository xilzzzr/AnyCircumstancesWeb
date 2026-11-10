// Retry policy for emergency trigger jobs and contact deliveries.
//
// A release must survive a mail-provider outage. Instead of five attempts in
// about two minutes, failed rows wait 2, 4, 8 ... minutes between attempts,
// then every 6 hours, for about three days in total. Uses the existing
// `attempts` and `updated_at` columns, so no schema change is needed.

const MAX_ATTEMPTS = 20;
const MAX_GAP_MINUTES = 360;

// Minutes to wait after a row has failed `attempts` times.
function retryGapMinutes(attempts) {
  return Math.min(2 ** Math.max(1, Number(attempts) || 1), MAX_GAP_MINUTES);
}

// Total time from the first attempt to the last one.
function retryWindowMinutes() {
  let total = 0;
  for (let attempts = 1; attempts < MAX_ATTEMPTS; attempts += 1) total += retryGapMinutes(attempts);
  return total;
}

// SQL condition for a row that may be claimed now: never tried, its retry gap
// has passed, or a worker died mid-attempt. `p` is a table alias prefix such
// as "d." (or "" for none). Mirrors retryGapMinutes.
function retryDueSql(p = "") {
  return `(${p}attempts < ${MAX_ATTEMPTS} AND (
      ${p}status = 'pending'
      OR (${p}status = 'failed' AND ${p}updated_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL LEAST(POW(2, GREATEST(${p}attempts, 1)), ${MAX_GAP_MINUTES}) MINUTE))
      OR (${p}status = 'processing' AND ${p}updated_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE))
    ))`;
}

module.exports = { MAX_ATTEMPTS, retryDueSql, retryGapMinutes, retryWindowMinutes };
