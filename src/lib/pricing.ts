// Single source of truth for plan pricing in the web app.
// Mirrors backend/auth.js computeStoragePrice / computeFrequencyPrice: the backend
// charges round(amount * 100) cents, where amount = storage + frequency
// (x 10 for annual). Keep these numbers identical to the backend.

export const MIN_STORAGE_GB = 5;
export const MAX_STORAGE_GB = 200;
export const STORAGE_STEP_GB = 5;

// Anchor prices (USD per month). Prices between anchors are linearly interpolated.
export const storageTiers = [
  { gb: 5, price: 4.99 },
  { gb: 10, price: 7.99 },
  { gb: 25, price: 12.99 },
  { gb: 50, price: 17.99 },
  { gb: 100, price: 22.99 },
  { gb: 200, price: 29.99 },
];

// Not implemented and rejected by the backend (addons must be []). Kept only so
// existing billing data types keep compiling. Never offer these for purchase.
export const addons = [
  { id: "call-contacts", label: "Call emergency contacts", price: 1.99 },
  { id: "text-contacts", label: "Text emergency contacts", price: 0.49 },
  { id: "log-location", label: "Log location at check-in", price: 0.99 },
];

// Features that are planned but not available. Shown without prices or checkboxes.
export const plannedFeatures = [
  "Calling your emergency contacts",
  "Text messages to your emergency contacts",
  "Logging your location at check-in",
];

export const checkInFrequencies = [
  { id: "monthly", label: "Monthly", price: 0.0, days: 30 },
  { id: "weekly", label: "Weekly", price: 1.99, days: 7 },
  { id: "daily", label: "Daily / scheduled", price: 2.99, days: 1 },
] as const;

export type CheckInFrequencyId = "monthly" | "weekly" | "daily";
export type BillingIntervalId = "monthly" | "annual";

export function getStoragePrice(gb: number): number {
  for (let i = storageTiers.length - 1; i >= 0; i--) {
    if (gb >= storageTiers[i].gb) {
      if (i === storageTiers.length - 1) return storageTiers[i].price;
      const currentTier = storageTiers[i];
      const nextTier = storageTiers[i + 1];
      const ratio = (gb - currentTier.gb) / (nextTier.gb - currentTier.gb);
      return currentTier.price + ratio * (nextTier.price - currentTier.price);
    }
  }
  return storageTiers[0].price;
}

export function getFrequencyPrice(frequency: CheckInFrequencyId): number {
  return checkInFrequencies.find((f) => f.id === frequency)?.price ?? 0;
}

/** True monthly storage price divided by the number of GB. */
export function getEffectivePricePerGb(gb: number): number {
  if (!Number.isFinite(gb) || gb <= 0) return 0;
  return getStoragePrice(gb) / gb;
}

export function computePlanPrice(opts: {
  storageGb: number;
  addons: string[];
  checkInFrequency: CheckInFrequencyId;
  billingInterval: BillingIntervalId;
}) {
  const storage = getStoragePrice(opts.storageGb);

  const addonsTotal = addons
    .filter((a) => opts.addons.includes(a.id))
    .reduce((sum, a) => sum + a.price, 0);

  const frequency = getFrequencyPrice(opts.checkInFrequency);

  const monthlyTotal = storage + addonsTotal + frequency;

  if (opts.billingInterval === "annual") {
    const annualTotal = monthlyTotal * 10;
    return { storage, addons: addonsTotal, frequency, monthlyTotal, annualTotal };
  }

  return { storage, addons: addonsTotal, frequency, monthlyTotal, annualTotal: null };
}

/**
 * What the customer is charged per billing period for a plan (no add-ons).
 * Monthly: the monthly total, every month. Annual: 10 x the monthly total, once a year.
 */
export function getPlanCharge(storageGb: number, frequency: CheckInFrequencyId, billing: BillingIntervalId) {
  const p = computePlanPrice({ storageGb, addons: [], checkInFrequency: frequency, billingInterval: billing });
  const amount = billing === "annual" ? (p.annualTotal ?? p.monthlyTotal * 10) : p.monthlyTotal;
  return { storage: p.storage, frequency: p.frequency, monthlyTotal: p.monthlyTotal, amount, amountCents: toCents(amount) };
}

/** Same rounding as the backend's cents(): Math.round(amount * 100). */
export function toCents(n: number): number {
  return Math.round(Number(n) * 100);
}

export function formatMoney(n: number) {
  return `$${(toCents(n) / 100).toFixed(2)}`;
}
