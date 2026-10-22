export const storageTiers = [
  { gb: 5, price: 4.99, perGb: 1.0 },
  { gb: 10, price: 7.99, perGb: 0.8 },
  { gb: 25, price: 12.99, perGb: 0.52 },
  { gb: 50, price: 17.99, perGb: 0.36 },
  { gb: 100, price: 22.99, perGb: 0.23 },
  { gb: 200, price: 29.99, perGb: 0.15 },
];

export const addons = [
  { id: "call-contacts", label: "Call emergency contacts", price: 1.99 },
  { id: "text-contacts", label: "Text emergency contacts", price: 0.49 },
  { id: "log-location", label: "Log location at check-in", price: 0.99 },
];

export const checkInFrequencies = [
  { id: "monthly", label: "Monthly", price: 0.0 },
  { id: "weekly", label: "Weekly", price: 1.99 },
  { id: "daily", label: "Daily / scheduled", price: 2.99 },
];

export type CheckInFrequencyId = "monthly" | "weekly" | "daily";

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

export function computePlanPrice(opts: {
  storageGb: number;
  addons: string[];
  checkInFrequency: CheckInFrequencyId;
  billingInterval: "monthly" | "annual";
}) {
  const storage = getStoragePrice(opts.storageGb);

  const addonsTotal = addons
    .filter((a) => opts.addons.includes(a.id))
    .reduce((sum, a) => sum + a.price, 0);

  const frequency =
    checkInFrequencies.find((f) => f.id === opts.checkInFrequency)?.price ?? 0;

  const monthlyTotal = storage + addonsTotal + frequency;

  if (opts.billingInterval === "annual") {
    const annualTotal = monthlyTotal * 10;
    return { storage, addons: addonsTotal, frequency, monthlyTotal, annualTotal };
  }

  return { storage, addons: addonsTotal, frequency, monthlyTotal, annualTotal: null };
}

export function formatMoney(n: number) {
  return `$${n.toFixed(2)}`;
}
