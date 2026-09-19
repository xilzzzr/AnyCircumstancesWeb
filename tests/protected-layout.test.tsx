import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedAppLayout from '@/routes/ProtectedAppLayout';
const { auth } = vi.hoisted(() => ({ auth: { role: 'user', user: null as null | { id: string }, isAuthenticated: false, loading: false } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/layouts/AppLayout', () => ({ AppLayout: () => <h1>Application shell</h1> }));
function mount() {
  render(<MemoryRouter initialEntries={['/app']}><Routes><Route path="/app" element={<ProtectedAppLayout />} /><Route path="/login" element={<h1>Sign in</h1>} /></Routes></MemoryRouter>);
}
test('role=user with no user cannot enter application', () => {
  Object.assign(auth, { user: null, isAuthenticated: false, loading: false });
  mount(); expect(screen.getByRole('heading').textContent).toBe('Sign in');
});
test('authenticated session renders application', () => {
  Object.assign(auth, { user: { id: '1' }, isAuthenticated: true, loading: false });
  mount(); expect(screen.getByRole('heading').textContent).toBe('Application shell');
});
test('loading session shows account loading UI', () => {
  auth.loading = true; mount(); expect(screen.getByRole('status').textContent).toBe('Loading your account…');
});
