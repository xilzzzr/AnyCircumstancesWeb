export async function createCheckoutSession(payload: {
  storageGb: number;
  checkInFrequency: "monthly" | "weekly" | "daily";
  billingInterval: "monthly" | "annual";
  addons: string[];
  promoCode?: string;
}) {
  const res = await fetch("/auth/billing/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.error || "checkout_failed");
    // @ts-ignore
    err.data = data;
    throw err;
  }

  return data as { ok: true; url: string };
}
