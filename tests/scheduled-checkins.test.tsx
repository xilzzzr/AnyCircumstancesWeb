import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VerificationSettingsPage } from '@/pages/app/VerificationSettingsPage';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ lockVault: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
function server(canSchedule: boolean) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (String(input) === '/auth/billing/status') return Response.json({ ok:true, status:'active' });
    const saved = init?.method === 'PUT' ? JSON.parse(String(init.body)) : {};
    return Response.json({ ok:true, canSchedule, settings:{ frequency:canSchedule ? 'daily':'weekly', gracePeriodHours:24, reminders:3, schedule:null, ...saved, nextDueAt:'2026-10-25T14:00:00Z' } });
  });
}
test('daily-tier users can save alternate weeks and multiple times without altering grace period', async () => {
  const fetchMock = server(true);
  render(<MemoryRouter><VerificationSettingsPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('checkbox', { name:'Choose specific days and times' }));
  fireEvent.change(screen.getByLabelText('Repeat'), { target:{ value:'weeks' } });
  fireEvent.change(screen.getByLabelText('Every how many weeks?'), { target:{ value:'2' } });
  fireEvent.click(screen.getByRole('checkbox', { name:'Thu' }));
  fireEvent.click(screen.getByRole('button', { name:'Add another time' }));
  fireEvent.click(screen.getByRole('button', { name:'Save settings' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([,init]) => init?.method === 'PUT')).toBe(true));
  const request = fetchMock.mock.calls.find(([,init]) => init?.method === 'PUT');
  const body = JSON.parse(String(request?.[1]?.body));
  expect(body).toMatchObject({ gracePeriodHours:24, reminders:3, schedule:{ mode:'weeks', interval:2, weekdays:[1,4], times:['09:00','18:00'] } });
});
test('weekly-tier users see the upgrade requirement rather than calendar controls', async () => {
  server(false);
  render(<MemoryRouter><VerificationSettingsPage /></MemoryRouter>);
  await screen.findByText('Upgrade to Daily / scheduled check-in to customize your calendar.');
  expect(screen.queryByRole('checkbox', { name:'Choose specific days and times' })).toBeNull();
});
