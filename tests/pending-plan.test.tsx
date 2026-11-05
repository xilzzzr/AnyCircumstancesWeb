import { beforeEach, describe, test, expect, vi } from 'vitest';
import { installMemoryLocalStorage } from './memory-storage';
import {
  DEFAULT_PLAN,
  PENDING_PLAN_STORAGE_KEY,
  clearPendingPlan,
  normalizePlan,
  normalizeStorageGb,
  planFromSearchParams,
  planToSearchParams,
  pricingHrefForPlan,
  readPendingPlan,
  savePendingPlan,
} from '@/lib/pendingPlan';
import { planSummaryParts } from '@/lib/planSummary';

beforeEach(() => { installMemoryLocalStorage(); });

describe('pending plan storage', () => {
  test('save, read and clear round-trip', () => {
    expect(readPendingPlan()).toBeNull();
    expect(savePendingPlan({ storageGb: 25, frequency: 'weekly', billing: 'annual' })).toBe(true);
    expect(readPendingPlan()).toEqual({ storageGb: 25, frequency: 'weekly', billing: 'annual' });
    clearPendingPlan();
    expect(readPendingPlan()).toBeNull();
    expect(localStorage.getItem(PENDING_PLAN_STORAGE_KEY)).toBeNull();
  });

  test('refuses to save an invalid plan', () => {
    expect(savePendingPlan({ storageGb: 7, frequency: 'weekly', billing: 'monthly' })).toBe(false);
    expect(localStorage.getItem(PENDING_PLAN_STORAGE_KEY)).toBeNull();
  });

  test('reads the legacy pendingCheckout shape written by the old pricing page', () => {
    localStorage.setItem(PENDING_PLAN_STORAGE_KEY, JSON.stringify({ storageGb: 50, checkInFrequency: 'daily', billingInterval: 'monthly', addons: [] }));
    expect(readPendingPlan()).toEqual({ storageGb: 50, frequency: 'daily', billing: 'monthly' });
  });

  test('drops corrupt, invalid and expired entries', () => {
    localStorage.setItem(PENDING_PLAN_STORAGE_KEY, '{not json');
    expect(readPendingPlan()).toBeNull();
    expect(localStorage.getItem(PENDING_PLAN_STORAGE_KEY)).toBeNull();

    localStorage.setItem(PENDING_PLAN_STORAGE_KEY, JSON.stringify({ storageGb: 25, frequency: 'hourly', billing: 'monthly' }));
    expect(readPendingPlan()).toBeNull();

    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    localStorage.setItem(PENDING_PLAN_STORAGE_KEY, JSON.stringify({ storageGb: 25, frequency: 'weekly', billing: 'monthly', savedAt: old }));
    expect(readPendingPlan()).toBeNull();
  });

  test('never throws when storage is unavailable', () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked, clear: blocked, key: blocked, length: 0 });
    expect(savePendingPlan({ storageGb: 25, frequency: 'weekly', billing: 'monthly' })).toBe(false);
    expect(readPendingPlan()).toBeNull();
    expect(() => clearPendingPlan()).not.toThrow();

    // Missing storage entirely (as in some embedded browsers) is also handled.
    vi.stubGlobal('localStorage', undefined);
    expect(savePendingPlan({ storageGb: 25, frequency: 'weekly', billing: 'monthly' })).toBe(false);
    expect(readPendingPlan()).toBeNull();
    expect(() => clearPendingPlan()).not.toThrow();
  });
});

describe('plan query strings', () => {
  test('builds and parses ?storage=&frequency=&billing=', () => {
    const plan = { storageGb: 25, frequency: 'weekly' as const, billing: 'annual' as const };
    expect(planToSearchParams(plan)).toBe('storage=25&frequency=weekly&billing=annual');
    expect(pricingHrefForPlan(plan)).toBe('/pricing?storage=25&frequency=weekly&billing=annual');
    expect(planFromSearchParams('?storage=25&frequency=weekly&billing=annual')).toEqual(plan);
    expect(planFromSearchParams(new URLSearchParams(planToSearchParams(plan)))).toEqual(plan);
  });

  test('returns null without plan params and fills defaults for bad or missing values', () => {
    expect(planFromSearchParams('')).toBeNull();
    expect(planFromSearchParams('?returnTo=/app')).toBeNull();
    expect(planFromSearchParams('?storage=100')).toEqual({ ...DEFAULT_PLAN, storageGb: 100 });
    expect(planFromSearchParams('?storage=33&frequency=hourly&billing=weekly')).toEqual(DEFAULT_PLAN);
  });

  test('accepts only 5-200 GB in 5 GB steps', () => {
    expect(normalizeStorageGb('25')).toBe(25);
    expect(normalizeStorageGb(5)).toBe(5);
    expect(normalizeStorageGb(200)).toBe(200);
    for (const bad of [0, 4, 7, 25.5, 205, -5, 'abc', '', null, undefined]) expect(normalizeStorageGb(bad)).toBeNull();
    expect(normalizePlan(null)).toBeNull();
  });
});

describe('plan summary text', () => {
  test('monthly and annual wording with the yearly charge', () => {
    expect(planSummaryParts({ storageGb: 25, frequency: 'weekly', billing: 'monthly' }).line).toBe('25 GB · weekly check-ins · $14.98/month, billed monthly');
    const annual = planSummaryParts({ storageGb: 25, frequency: 'weekly', billing: 'annual' });
    expect(annual.line).toBe('25 GB · weekly check-ins · $149.80/year, billed annually');
    expect(annual.billing).toContain('10 × $14.98');
  });
});
