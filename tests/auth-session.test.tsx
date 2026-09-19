import React, { StrictMode } from 'react';
import { test, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function Probe() {
  const { role, user, isAuthenticated, loading } = useAuth();
  return <output>{JSON.stringify({ role, user, isAuthenticated, loading })}</output>;
}

test('StrictMode session checks share one refresh-token rotation', async () => {
  let resolveRefresh!: (value: Response) => void;
  let meCalls = 0;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    if (input === '/auth/refresh') return new Promise(resolve => { resolveRefresh = resolve; });
    expect(input).toBe('/auth/me');
    meCalls++;
    return Response.json(meCalls === 1 ? { ok: false } : { ok: true, role: 'user', user: { id: '1', email: 'new@example.test' } });
  });
  render(<StrictMode><AuthProvider><Probe /></AuthProvider></StrictMode>);
  await waitFor(() => expect(resolveRefresh).toBeTypeOf('function'));
  expect(fetchMock.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(1);
  await act(async () => resolveRefresh(Response.json({ ok: true })));
  await waitFor(() => expect(JSON.parse(screen.getByRole('status').textContent!).isAuthenticated).toBe(true));
  expect(meCalls).toBe(2);
});

test('legacy email session response still populates a user', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: true, role: 'user', email: 'legacy@example.test' }));
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(JSON.parse(screen.getByRole('status').textContent!)).toEqual({ role: 'user', user: { email: 'legacy@example.test' }, isAuthenticated: true, loading: false }));
});
