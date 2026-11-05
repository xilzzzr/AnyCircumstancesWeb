import { describe, test, expect } from 'vitest';
import {
  computePlanPrice,
  formatMoney,
  getEffectivePricePerGb,
  getPlanCharge,
  getStoragePrice,
  toCents,
  type BillingIntervalId,
  type CheckInFrequencyId,
} from '@/lib/pricing';

// Copy of backend/auth.js computeStoragePrice + computeFrequencyPrice + cents(),
// used to prove the page shows exactly what the backend charges.
function backendAmountCents(gb: number, freq: CheckInFrequencyId, interval: BillingIntervalId) {
  const tiers = [
    { gb: 5, price: 4.99 }, { gb: 10, price: 7.99 }, { gb: 25, price: 12.99 },
    { gb: 50, price: 17.99 }, { gb: 100, price: 22.99 }, { gb: 200, price: 29.99 },
  ];
  let storage = tiers[0].price;
  if (gb >= tiers[tiers.length - 1].gb) storage = tiers[tiers.length - 1].price;
  else if (gb > tiers[0].gb) {
    for (let i = tiers.length - 2; i >= 0; i--) {
      if (gb >= tiers[i].gb) {
        const a = tiers[i];
        const b = tiers[i + 1];
        storage = a.price + ((gb - a.gb) / (b.gb - a.gb)) * (b.price - a.price);
        break;
      }
    }
  }
  const frequency = freq === 'daily' ? 2.99 : freq === 'weekly' ? 1.99 : 0;
  const monthlyTotal = storage + frequency;
  const amount = interval === 'annual' ? monthlyTotal * 10 : monthlyTotal;
  return Math.round(amount * 100);
}

const ALL_GB = Array.from({ length: 40 }, (_, i) => 5 + i * 5);
const FREQS: CheckInFrequencyId[] = ['monthly', 'weekly', 'daily'];
const INTERVALS: BillingIntervalId[] = ['monthly', 'annual'];

describe('storage pricing', () => {
  test.each([
    [5, 4.99], [10, 7.99], [25, 12.99], [50, 17.99], [100, 22.99], [200, 29.99],
  ])('anchor %i GB costs $%f per month', (gb, price) => {
    expect(getStoragePrice(gb)).toBe(price);
    expect(formatMoney(getStoragePrice(gb))).toBe(`$${price.toFixed(2)}`);
  });

  test('interpolates linearly between anchors', () => {
    // 15 GB is a third of the way from 10 GB ($7.99) to 25 GB ($12.99).
    expect(getStoragePrice(15)).toBeCloseTo(7.99 + 5 / 3, 10);
    expect(formatMoney(getStoragePrice(15))).toBe('$9.66');
    // 150 GB is halfway from 100 GB ($22.99) to 200 GB ($29.99).
    expect(formatMoney(getStoragePrice(150))).toBe('$26.49');
  });

  test('check-in frequency surcharge is added per month', () => {
    expect(computePlanPrice({ storageGb: 25, addons: [], checkInFrequency: 'monthly', billingInterval: 'monthly' }).monthlyTotal).toBeCloseTo(12.99, 10);
    expect(formatMoney(getPlanCharge(25, 'weekly', 'monthly').amount)).toBe('$14.98');
    expect(formatMoney(getPlanCharge(25, 'daily', 'monthly').amount)).toBe('$15.98');
  });
});

describe('annual billing', () => {
  test('annual total is exactly 10 x the monthly total (unrounded), as before', () => {
    for (const gb of ALL_GB) {
      for (const freq of FREQS) {
        const p = computePlanPrice({ storageGb: gb, addons: [], checkInFrequency: freq, billingInterval: 'annual' });
        expect(p.annualTotal).toBe(p.monthlyTotal * 10);
        expect(getPlanCharge(gb, freq, 'annual').amount).toBe(p.monthlyTotal * 10);
      }
    }
    expect(formatMoney(getPlanCharge(25, 'weekly', 'annual').amount)).toBe('$149.80');
    expect(formatMoney(getPlanCharge(5, 'monthly', 'annual').amount)).toBe('$49.90');
  });

  test('every displayed amount equals what the backend charges, and the old toFixed display', () => {
    for (const gb of ALL_GB) {
      for (const freq of FREQS) {
        for (const interval of INTERVALS) {
          const { amount, amountCents } = getPlanCharge(gb, freq, interval);
          expect(amountCents).toBe(backendAmountCents(gb, freq, interval));
          expect(toCents(amount)).toBe(amountCents);
          // Previous pages rendered `$${amount.toFixed(2)}`; the new formatter must not change any number.
          expect(formatMoney(amount)).toBe(`$${amount.toFixed(2)}`);
          expect(formatMoney(amount)).toBe(`$${(amountCents / 100).toFixed(2)}`);
        }
      }
    }
  });
});

describe('effective price per GB', () => {
  test('is the real storage price divided by GB, not the lower anchor rate', () => {
    expect(getEffectivePricePerGb(5)).toBeCloseTo(0.998, 10);
    expect(getEffectivePricePerGb(25)).toBeCloseTo(12.99 / 25, 10);
    // 195 GB costs $29.64/month; the old label showed the 100 GB anchor rate ($0.23).
    expect(getStoragePrice(195)).toBeCloseTo(29.64, 10);
    expect(getEffectivePricePerGb(195)).toBeCloseTo(29.64 / 195, 10);
    expect(formatMoney(getEffectivePricePerGb(195))).toBe('$0.15');
    expect(formatMoney(getEffectivePricePerGb(25))).toBe('$0.52');
  });

  test('handles invalid sizes', () => {
    expect(getEffectivePricePerGb(0)).toBe(0);
    expect(getEffectivePricePerGb(Number.NaN)).toBe(0);
  });
});
