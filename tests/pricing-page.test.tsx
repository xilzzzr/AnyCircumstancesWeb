import React from 'react';
import { beforeEach, describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { PricingPage } from '@/pages/public/PricingPage';
import { PENDING_PLAN_STORAGE_KEY, readPendingPlan } from '@/lib/pendingPlan';
import { installMemoryLocalStorage } from './memory-storage';

beforeEach(() => { installMemoryLocalStorage(); });

function SignupProbe() {
  const location = useLocation();
  return <h1>Signup{location.search}</h1>;
}

function mockFetch(opts: { signedIn: boolean; checkout?: { status: number; body: unknown } }) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = String(input);
    if (path === '/auth/me') {
      return Response.json(opts.signedIn ? { ok: true, role: 'user', user: { id: '1', email: 'a@example.test' } } : { ok: false });
    }
    if (path === '/auth/refresh') return Response.json({ ok: false }, { status: 401 });
    if (path === '/auth/billing/create-checkout-session' && opts.checkout) {
      return Response.json(opts.checkout.body, { status: opts.checkout.status });
    }
    return Response.json({ ok: false, error: 'unexpected' }, { status: 500 });
  });
}

function renderPricing(path = '/pricing') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/signup" element={<SignupProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('pricing page', () => {
  test('logged-out primary button reads "Create an account to continue" and keeps the plan through signup', async () => {
    const fetchMock = mockFetch({ signedIn: false });
    renderPricing('/pricing?storage=25&frequency=weekly&billing=annual');

    await waitFor(() => expect(fetchMock.mock.calls.some(([p]) => p === '/auth/refresh')).toBe(true));
    const button = await screen.findByRole('button', { name: 'Create an account to continue' });

    // Selection restored from the URL.
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Storage' }).getAttribute('aria-valuetext')).toBe('25 GB'));
    expect(screen.getByRole('radio', { name: /^Weekly/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /^Annual/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radiogroup', { name: 'Check-in frequency' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Billing' })).toBeTruthy();

    const live = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(within(live).getByText('$149.80 per year')).toBeTruthy();
    expect(screen.getByText(/≈ \$0\.52 per GB/)).toBeTruthy();

    // Unimplemented features are not purchasable.
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Planned — not available yet')).toBeTruthy();
    const termsLinks = screen.getAllByRole('link', { name: 'Terms' });
    expect(termsLinks.length).toBeGreaterThan(0);
    for (const link of termsLinks) expect(link.getAttribute('href')).toBe('/terms');
    expect(screen.getAllByText(/Cancelling ends your plan immediately and permanently deletes your stored files/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/no free plan or trial/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Cancel anytime/i)).toBeNull();

    fireEvent.click(button);
    await screen.findByRole('heading', { name: 'Signup?storage=25&frequency=weekly&billing=annual' });
    expect(readPendingPlan()).toEqual({ storageGb: 25, frequency: 'weekly', billing: 'annual' });
    expect(fetchMock.mock.calls.some(([p]) => p === '/auth/billing/create-checkout-session')).toBe(false);
  });

  test('defaults to 5 GB monthly with the true per-GB rate', async () => {
    mockFetch({ signedIn: false });
    renderPricing();
    expect(screen.getByRole('slider', { name: 'Storage' }).getAttribute('aria-valuetext')).toBe('5 GB');
    for (const group of ['Check-in frequency', 'Billing']) {
      const radios = within(screen.getByRole('radiogroup', { name: group }));
      expect(radios.getByRole('radio', { name: /^Monthly/ }).getAttribute('aria-checked')).toBe('true');
    }
    expect(within(document.querySelector('[aria-live="polite"]') as HTMLElement).getByText('$4.99 per month')).toBeTruthy();
    expect(screen.getByText(/≈ \$1\.00 per GB/)).toBeTruthy();
    await screen.findByRole('button', { name: 'Create an account to continue' });
  });

  test('logged-in users see "Continue to checkout" and a visible error when checkout fails', async () => {
    mockFetch({ signedIn: true, checkout: { status: 500, body: { ok: false, error: 'stripe_not_configured' } } });
    localStorage.setItem(PENDING_PLAN_STORAGE_KEY, JSON.stringify({ storageGb: 25, frequency: 'weekly', billing: 'monthly' }));
    renderPricing();
    const button = await screen.findByRole('button', { name: 'Continue to checkout' });
    fireEvent.click(button);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('We couldn’t start checkout');
    // Pending plan is only cleared once checkout actually starts.
    expect(readPendingPlan()).not.toBeNull();
  });

  test('an already-active subscription points to Billing', async () => {
    mockFetch({ signedIn: true, checkout: { status: 409, body: { ok: false, error: 'subscription_already_active' } } });
    renderPricing();
    fireEvent.click(await screen.findByRole('button', { name: 'Continue to checkout' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('link', { name: 'Go to Billing' }).getAttribute('href')).toBe('/app/billing');
  });
});
