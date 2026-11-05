import {
  MAX_STORAGE_GB,
  MIN_STORAGE_GB,
  STORAGE_STEP_GB,
  type BillingIntervalId,
  type CheckInFrequencyId,
} from "@/lib/pricing";

// The plan a visitor picked on /pricing before they had an account. It is carried
// through signup, PIN setup and onboarding, then preloaded into /app/plan.
export type PendingPlan = {
  storageGb: number;
  frequency: CheckInFrequencyId;
  billing: BillingIntervalId;
};

export const DEFAULT_PLAN: PendingPlan = { storageGb: 5, frequency: "monthly", billing: "monthly" };

export const PENDING_PLAN_STORAGE_KEY = "pendingCheckout";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeStorageGb(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < MIN_STORAGE_GB || n > MAX_STORAGE_GB || n % STORAGE_STEP_GB !== 0) return null;
  return n;
}

export function isFrequency(value: unknown): value is CheckInFrequencyId {
  return value === "monthly" || value === "weekly" || value === "daily";
}

export function isBilling(value: unknown): value is BillingIntervalId {
  return value === "monthly" || value === "annual";
}

/** Strictly validates a stored plan. Also accepts the older {checkInFrequency, billingInterval} shape. */
export function normalizePlan(raw: unknown): PendingPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const storageGb = normalizeStorageGb(r.storageGb);
  const frequency = r.frequency ?? r.checkInFrequency;
  const billing = r.billing ?? r.billingInterval;
  if (storageGb === null || !isFrequency(frequency) || !isBilling(billing)) return null;
  return { storageGb, frequency, billing };
}

/**
 * Reads ?storage=25&frequency=weekly&billing=annual. Returns null when none of the
 * plan params are present; otherwise invalid or missing fields fall back to defaults.
 */
export function planFromSearchParams(input: URLSearchParams | string): PendingPlan | null {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  if (!params.has("storage") && !params.has("frequency") && !params.has("billing")) return null;
  const frequency = params.get("frequency");
  const billing = params.get("billing");
  return {
    storageGb: normalizeStorageGb(params.get("storage")) ?? DEFAULT_PLAN.storageGb,
    frequency: isFrequency(frequency) ? frequency : DEFAULT_PLAN.frequency,
    billing: isBilling(billing) ? billing : DEFAULT_PLAN.billing,
  };
}

/** "storage=25&frequency=weekly&billing=annual" (no leading "?"). */
export function planToSearchParams(plan: PendingPlan): string {
  return new URLSearchParams({
    storage: String(plan.storageGb),
    frequency: plan.frequency,
    billing: plan.billing,
  }).toString();
}

export function pricingHrefForPlan(plan: PendingPlan): string {
  return `/pricing?${planToSearchParams(plan)}`;
}

export function savePendingPlan(plan: PendingPlan): boolean {
  const valid = normalizePlan(plan);
  if (!valid) return false;
  try {
    window.localStorage.setItem(PENDING_PLAN_STORAGE_KEY, JSON.stringify({ ...valid, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function readPendingPlan(): PendingPlan | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PENDING_PLAN_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const plan = normalizePlan(parsed);
    const savedAt = Number(parsed?.savedAt);
    const expired = Number.isFinite(savedAt) && Date.now() - savedAt > MAX_AGE_MS;
    if (!plan || expired) {
      clearPendingPlan();
      return null;
    }
    return plan;
  } catch {
    clearPendingPlan();
    return null;
  }
}

export function clearPendingPlan(): void {
  try {
    window.localStorage.removeItem(PENDING_PLAN_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); nothing to clear.
  }
}
