export type BillingStatusResponse = {
  ok: true;
  status: "active" | "past_due" | "paused" | "none";
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
};

export async function getBillingStatus() {
  const res = await fetch("/auth/billing/status", {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error || "billing_status_failed");
    // @ts-ignore
    err.data = data;
    throw err;
  }
  return data as BillingStatusResponse;
}
