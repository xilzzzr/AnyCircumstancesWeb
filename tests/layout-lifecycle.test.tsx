import React, { StrictMode } from 'react';
import { test, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
const { guide } = vi.hoisted(() => ({ guide: { enabled: true } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { email: 'test@example.test' }, vaultLocked: true, logout() {}, lockVault() {} }) }));
vi.mock('@/components/app/QuickGuideDialog', async importOriginal => {
  const original = await importOriginal<typeof import('@/components/app/QuickGuideDialog')>();
  return { QuickGuideDialog: (props: React.ComponentProps<typeof original.QuickGuideDialog>) => guide.enabled ? <original.QuickGuideDialog {...props} /> : null };
});
function mount() {
  return render(<StrictMode><MemoryRouter initialEntries={['/app']}><Routes><Route path="/app" element={<AppLayout />}><Route index element={<Link to="upload">Open upload</Link>} /><Route path="upload" element={<h1>Upload destination</h1>} /></Route></Routes></MemoryRouter></StrictMode>);
}

test.each([true, false])('layout renders and navigates with Quick Guide enabled=%s', async enabled => {
  guide.enabled = enabled;
  const errors = vi.spyOn(console, 'error');
  const listeners = vi.spyOn(Element.prototype, 'addEventListener');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: true, files: [] }));
  mount();
  fireEvent.click(screen.getByRole('link', { name: 'Open upload' }));
  await screen.findByRole('heading', { name: 'Upload destination' });
  expect(screen.queryByRole('dialog')).toBeNull();
  // The closed guide never mounts Embla or registers its non-passive wheel handler.
  expect(listeners.mock.calls.filter(([event, , options]) => event === 'wheel' && typeof options === 'object' && options.passive === false)).toHaveLength(0);
  expect(errors).not.toHaveBeenCalled();
});

test('storage polling waits for both requests, prevents overlap and aborts on unmount', async () => {
  vi.useFakeTimers();
  guide.enabled = false;
  const signals: AbortSignal[] = [];
  let settle!: (value: Response) => void;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    signals.push(init!.signal as AbortSignal);
    // One request fails immediately while its sibling remains pending.
    if (String(input).includes('/files/')) return Promise.reject(new Error('offline'));
    return new Promise(resolve => { settle = resolve; });
  });
  try {
    const view = mount();
    expect(fetchMock).toHaveBeenCalledTimes(4); // StrictMode cleanup + remount
    expect(signals[0].aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(45000); });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await act(async () => { settle(Response.json({ ok: true })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    view.unmount();
    expect(signals.every(signal => signal.aborted)).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  } finally { vi.useRealTimers(); }
});
