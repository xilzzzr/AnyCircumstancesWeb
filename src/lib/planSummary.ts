import { formatMoney, getPlanCharge, type CheckInFrequencyId } from "@/lib/pricing";
import type { PendingPlan } from "@/lib/pendingPlan";

export const FREQUENCY_CHECK_IN_LABEL: Record<CheckInFrequencyId, string> = {
  monthly: "monthly check-ins",
  weekly: "weekly check-ins",
  daily: "daily check-ins",
};

/** Human-readable pieces describing what a plan costs and how it is billed. */
export function planSummaryParts(plan: PendingPlan) {
  const charge = getPlanCharge(plan.storageGb, plan.frequency, plan.billing);
  const monthly = formatMoney(charge.monthlyTotal);
  if (plan.billing === "annual") {
    const yearly = formatMoney(charge.amount);
    return {
      storage: `${plan.storageGb} GB`,
      checkIns: FREQUENCY_CHECK_IN_LABEL[plan.frequency],
      price: `${yearly}/year`,
      billing: `billed once a year up front (10 × ${monthly}), renews yearly`,
      line: `${plan.storageGb} GB · ${FREQUENCY_CHECK_IN_LABEL[plan.frequency]} · ${yearly}/year, billed annually`,
    };
  }
  return {
    storage: `${plan.storageGb} GB`,
    checkIns: FREQUENCY_CHECK_IN_LABEL[plan.frequency],
    price: `${monthly}/month`,
    billing: "billed monthly, renews monthly",
    line: `${plan.storageGb} GB · ${FREQUENCY_CHECK_IN_LABEL[plan.frequency]} · ${monthly}/month, billed monthly`,
  };
}
