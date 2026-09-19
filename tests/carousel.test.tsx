import React, { StrictMode } from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QuickGuideDialog } from '@/components/app/QuickGuideDialog';
import { Carousel } from '@/components/ui/carousel';
const { api, counts } = vi.hoisted(() => {
  const counts = new Map<string, Set<unknown>>();
  let selected = 0;
  const api = {
    selectedScrollSnap: () => selected,
    scrollTo(index: number) { selected = index; counts.get("select")?.forEach(listener => (listener as () => void)()); },
    canScrollPrev: () => false, canScrollNext: () => false,
    on(event: string, listener: unknown) { if (!counts.has(event)) counts.set(event, new Set()); counts.get(event)!.add(listener); },
    off(event: string, listener: unknown) { counts.get(event)!.delete(listener); },
  };
  return { api, counts };
});
vi.mock('embla-carousel-react', () => ({ default: () => [() => {}, api] }));
test('StrictMode carousel detaches select and reInit subscriptions', () => {
  const view = render(<StrictMode><Carousel><p>Slide</p></Carousel></StrictMode>);
  expect(counts.get('select')!.size).toBe(1);
  expect(counts.get('reInit')!.size).toBe(1);
  view.unmount();
  expect(counts.get('select')!.size).toBe(0);
  expect(counts.get('reInit')!.size).toBe(0);
});


test('guide detaches wheel and selection handlers when closed', async () => {
  const add = vi.spyOn(Element.prototype, 'addEventListener');
  const remove = vi.spyOn(Element.prototype, 'removeEventListener');
  const view = render(<StrictMode><MemoryRouter><QuickGuideDialog open onOpenChange={() => {}} /></MemoryRouter></StrictMode>);
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(counts.get('select')!.size).toBe(2);
  expect(counts.get('reInit')!.size).toBe(2);
  const wheels = add.mock.calls.filter(([event, , options]) => event === 'wheel' && typeof options === 'object' && options.passive === false);
  expect(wheels.length).toBeGreaterThan(0);
  view.rerender(<StrictMode><MemoryRouter><QuickGuideDialog open={false} onOpenChange={() => {}} /></MemoryRouter></StrictMode>);
  await waitFor(() => expect(counts.get('reInit')!.size).toBe(0));
  expect(counts.get('select')!.size).toBe(0);
  for (const [, listener] of wheels) expect(remove.mock.calls.some(([event, removed]) => event === 'wheel' && listener === removed)).toBe(true);
});

test.each([
  [1, 'Upload your first file', '/app/upload'],
  [2, 'Upload files', '/app/upload'],
  [3, 'Add contacts', '/app/emergency-contacts'],
  [4, 'Check in now', '/app/check-in'],
  [5, 'Set your grace period', '/app/verification'],
])('guide page %s navigates to its destination', (page, cta, destination) => {
  function Location() { return <output aria-label="Current route">{useLocation().pathname}</output>; }
  render(<MemoryRouter><QuickGuideDialog open onOpenChange={() => {}} /><Location /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: `Go to page ${page}` }));
  fireEvent.click(screen.getByRole('button', { name: cta }));
  expect(screen.getByRole('status', { name: 'Current route', hidden: true }).textContent).toBe(destination);
});
