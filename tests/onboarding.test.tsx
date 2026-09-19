import React, { StrictMode, Suspense, lazy } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const session = { ok: true, role: 'user', user: { id: '1', email: 'new@example.test' } };
function mockServer(initial = false, failSession = false) {
  let authenticated = initial;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = String(input);
    if (path === '/auth/verify-email-code') { authenticated = true; return Response.json({ ok: true }); }
    if (path === '/auth/me') return Response.json(authenticated && !failSession ? session : { ok: false });
    if (path === '/auth/refresh') return Response.json({ ok: false }, { status: 401 });
    return Response.json({ ok: true, files: [], contacts: [], checkins: [], settings: {}, billing: { status: 'inactive' } });
  });
}
function app(path: string) {
  const router = createMemoryRouter([{ path: '*', element: <AppRoutes /> }], { initialEntries: [path] });
  render(<StrictMode><ErrorBoundary><RouterProvider router={router} /></ErrorBoundary></StrictMode>);
  return router;
}
async function verify() {
  fireEvent.change(await screen.findByRole('textbox', { name: 'Account email address' }), { target: { value: 'new@example.test' } });
  fireEvent.change(document.querySelector('input[data-input-otp]')!, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
}
async function pin(value: string) {
  await screen.findByRole('heading', { name: value === '123456' ? 'Create your PIN' : 'Create your emergency PIN' });
  await waitFor(() => expect(document.querySelector('input[data-input-otp]')).not.toBeNull());
  fireEvent.change(document.querySelector('input[data-input-otp]')!, { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.change(document.querySelector('input[data-input-otp]')!, { target: { value } });
  const password = document.querySelector('input[type=password]');
  if (password) fireEvent.change(password, { target: { value: 'Password12345' } });
  const submit = screen.getAllByRole('button').find(b => /^(Create|Set|Save|Confirm)/i.test(b.textContent || ''))!;
  fireEvent.click(submit);
}

describe('new account routes', () => {
  test('signup navigates once, verifies a real session, creates both PINs and renders dashboard', async () => {
    const fetchMock = mockServer();
    const router = app('/signup');
    const navigations: string[] = [];
    const unsubscribe = router.subscribe(state => navigations.push(state.location.pathname));
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'new@example.test' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'Password12345' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password12345' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('heading', { name: 'Verify your email' });
    expect(navigations.filter(p => p === '/verify-email')).toHaveLength(1);
    expect(sessionStorage.getItem('pending_verify_email')).toBe('new@example.test');
    await verify();
    await waitFor(() => expect(router.state.location.pathname).toBe('/create-pin'));
    expect(sessionStorage.getItem('pending_verify_email')).toBeNull();
    expect(fetchMock.mock.calls.filter(([p]) => p === '/auth/me')).toHaveLength(2);
    await pin('123456');
    await waitFor(() => expect(router.state.location.pathname).toBe('/create-panic-pin'));
    await pin('654321');
    await screen.findByRole('heading', { name: 'Make your vault ready.' });
    fireEvent.click(screen.getByRole('link', { name: /Go to dashboard/ }));
    await screen.findByRole('heading', { name: /Everything important/ });
    expect(router.state.location.pathname).toBe('/app');
    expect(fetchMock.mock.calls.filter(([p]) => p === '/auth/me')).toHaveLength(2);
    unsubscribe();
  });

  test.each([
    ['/app/plan', /Choose your protection plan/, /plan/i],
    ['/app/verification', /Set up your check-ins/, /Verification Settings/],
    ['/app/emergency-contacts', /Choose your emergency contacts/, /Emergency Contacts/],
    ['/app/upload', /Add your first file/, /Upload Files/],
  ])('onboarding links render %s', async (destination, link, heading) => {
    mockServer(true);
    const router = app('/onboarding');
    fireEvent.click(await screen.findByRole('link', { name: link }));
    await waitFor(() => expect(router.state.location.pathname).toBe(destination));
    await waitFor(() => expect(document.querySelector('#app-main-content')?.textContent?.trim()).toBeTruthy());
    await screen.findByRole('heading', { name: heading });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('failed synchronization does not enter PIN setup', async () => {
    mockServer(false, true);
    const router = app('/verify-email');
    await verify();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  test('context contains a user and derives authentication from the server', async () => {
    mockServer(true);
    function Probe() { const auth = useAuth(); return <output>{JSON.stringify({ role: auth.role, user: auth.user, authenticated: auth.isAuthenticated })}</output>; }
    render(<StrictMode><AuthProvider><Probe /></AuthProvider></StrictMode>);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(JSON.stringify({ role: 'user', user: session.user, authenticated: true })));
  });
});

test('render exceptions show recovery, and Try again retries rendering', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let broken = true;
  function Broken() { if (broken) throw new Error('private diagnostic'); return <h1>Recovered</h1>; }
  render(<ErrorBoundary><Broken /></ErrorBoundary>);
  expect(screen.getByRole('heading').textContent).toContain('Something went wrong');
  expect(screen.getByRole('link', { name: 'Return to dashboard' }).getAttribute('href')).toBe('/app');
  broken = false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByRole('heading').textContent).toBe('Recovered');
});

test('pending lazy route stays visible and rejected import shows manual recovery', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let reject!: (error: Error) => void;
  const Broken = lazy(() => new Promise<never>((_, fail) => { reject = fail; }));
  render(<MemoryRouter><ErrorBoundary><Suspense fallback={<p role="status">Loading page</p>}><Broken /></Suspense></ErrorBoundary></MemoryRouter>);
  expect(screen.getByRole('status').textContent).toBe('Loading page');
  reject(new TypeError('Failed to fetch dynamically imported module'));
  await screen.findByRole('heading', { name: 'This page could not be loaded.' });
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy();
});

test('production recovery does not display exception details', () => {
  vi.stubEnv('DEV', false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Broken() { throw new Error('sensitive-internal-value'); }
  try {
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByRole('alert').textContent).not.toContain('sensitive-internal-value');
  } finally { vi.unstubAllEnvs(); }
});
