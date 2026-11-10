import React, { StrictMode } from 'react';
import { beforeEach, describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PENDING_PLAN_STORAGE_KEY, readPendingPlan } from '@/lib/pendingPlan';
import { installMemoryLocalStorage } from './memory-storage';

const session = { ok: true, role: 'user', user: { id: '1', email: 'new@example.test' } };

beforeEach(() => { installMemoryLocalStorage(); });

function mockServer(opts: { signedIn: boolean; checkout?: { status: number; body: unknown } }) {
  let authenticated = opts.signedIn;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = String(input);
    if (path === '/auth/login') { authenticated = true; return Response.json({ ok: true }); }
    if (path === '/auth/me') return Response.json(authenticated ? session : { ok: false });
    if (path === '/auth/refresh') return Response.json({ ok: false }, { status: 401 });
    if (path === '/auth/billing/create-checkout-session' && opts.checkout) return Response.json(opts.checkout.body, { status: opts.checkout.status });
    return Response.json({ ok: true, files: [], contacts: [], checkins: [], settings: {}, billing: { status: 'inactive' } });
  });
}

function app(path: string) {
  const router = createMemoryRouter([{ path: '*', element: <AppRoutes /> }], { initialEntries: [path] });
  render(<StrictMode><ErrorBoundary><RouterProvider router={router} /></ErrorBoundary></StrictMode>);
  return router;
}

function savePlan(plan: object) {
  localStorage.setItem(PENDING_PLAN_STORAGE_KEY, JSON.stringify(plan));
}

describe('plan chosen before signup', () => {
  test('signup shows the plan from the URL with an Edit plan link and saves it', async () => {
    mockServer({ signedIn: false });
    app('/signup?storage=25&frequency=weekly&billing=monthly');
    const summary = await screen.findByRole('region', { name: 'Your plan' });
    expect(summary.textContent).toContain('25 GB · weekly check-ins · $14.98/month');
    expect(summary.textContent).toContain('Billed monthly, renews monthly');
    expect(within(summary).getByRole('link', { name: 'Edit plan' }).getAttribute('href')).toBe('/pricing?storage=25&frequency=weekly&billing=monthly');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
    expect(screen.getByText(/pay for this plan after account setup/)).toBeTruthy();
    expect(screen.queryByText(/stored on that device/)).toBeNull();
    await waitFor(() => expect(readPendingPlan()).toEqual({ storageGb: 25, frequency: 'weekly', billing: 'monthly' }));
  });

  test('signup without a plan behaves as before (no summary)', async () => {
    mockServer({ signedIn: false });
    app('/signup');
    await screen.findByRole('button', { name: 'Create account' });
    expect(screen.queryByRole('region', { name: 'Your plan' })).toBeNull();
  });

  test('onboarding shows the saved plan and continues to /app/plan with it preloaded', async () => {
    mockServer({ signedIn: true });
    savePlan({ storageGb: 25, frequency: 'weekly', billing: 'annual', savedAt: Date.now() });
    const router = app('/onboarding');
    const summary = await screen.findByRole('region', { name: 'The plan you chose' });
    expect(summary.textContent).toContain('$149.80/year');
    fireEvent.click(within(summary).getByRole('link', { name: /Continue to checkout/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/plan'));
    expect(router.state.location.search).toBe('?storage=25&frequency=weekly&billing=annual');

    const slider = await screen.findByRole('slider', { name: 'Storage' });
    expect(slider.getAttribute('aria-valuetext')).toBe('25 GB');
    expect(screen.getByRole('radio', { name: /^Weekly/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: /Annual billing/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('$149.80 / year')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  test('plan builder reads the pending plan, keeps it on failure and shows an error', async () => {
    mockServer({ signedIn: true, checkout: { status: 500, body: { ok: false, error: 'stripe_not_configured' } } });
    savePlan({ storageGb: 50, frequency: 'daily', billing: 'monthly', savedAt: Date.now() });
    app('/app/plan');
    const slider = await screen.findByRole('slider', { name: 'Storage' });
    expect(slider.getAttribute('aria-valuetext')).toBe('50 GB');
    expect(screen.getByText('$20.98 / month')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to checkout' }));
    await waitFor(() => expect(document.querySelector('p[role="alert"]')?.textContent).toContain('We couldn’t start checkout'));
    expect(readPendingPlan()).toEqual({ storageGb: 50, frequency: 'daily', billing: 'monthly' });
  });

  test('onboarding without a pending plan behaves as before', async () => {
    mockServer({ signedIn: true });
    app('/onboarding');
    await screen.findByRole('heading', { name: 'Finish setting up your account' });
    expect(screen.queryByRole('region', { name: 'The plan you chose' })).toBeNull();
    expect(screen.getByRole('link', { name: /Choose your protection plan/ }).getAttribute('href')).toBe('/app/plan');
  });
});

describe('email-link verification still reaches PIN setup', () => {
  test('verified page sends the user to sign in and then to /create-pin', async () => {
    mockServer({ signedIn: false });
    const router = app('/email-verified?status=success');
    const link = await screen.findByRole('link', { name: 'Sign in to finish setup' });
    expect(link.getAttribute('href')).toBe('/login?next=%2Fcreate-pin');
    fireEvent.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'new@example.test' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'Password12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/create-pin'));
    await screen.findByRole('heading', { name: 'Create your PIN' });
  });

  test.each([
    ['//evil.example/create-pin'],
    ['https://evil.example/'],
    ['/admin'],
  ])('login ignores unsafe next=%s', async (next) => {
    mockServer({ signedIn: false });
    const router = app(`/login?next=${encodeURIComponent(next)}`);
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'new@example.test' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'Password12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  });
});
