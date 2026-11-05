import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SharePage from '@/pages/SharePage';

const token = 'cd'.repeat(32);

function renderShare(hash = `#token=${token}`) {
  window.history.replaceState(null, '', `/share${hash}`);
  return render(<MemoryRouter initialEntries={['/share']}><SharePage /></MemoryRouter>);
}

type Reply = { status?: number; body?: unknown; reject?: boolean };
function mockServer(routes: Record<string, Reply>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const reply = routes[String(input)];
    if (!reply) throw new Error(`unexpected request ${String(input)}`);
    if (reply.reject) throw new TypeError('Failed to fetch');
    return Response.json(reply.body, { status: reply.status ?? 200 });
  });
}

const lookupOk = { body: { ok: true, file: { id: 'users/1/opaque-key', content_type: 'application/pdf' } } };

beforeEach(() => { window.history.replaceState(null, '', '/'); });

describe('emergency share landing', () => {
  test('nothing is redeemed until the recipient presses Open shared file', async () => {
    const fetchMock = mockServer({ '/files/share-lookup': { status: 410, body: { ok: false, error: 'token_already_redeemed' } } });
    renderShare();

    expect(screen.getByRole('heading', { level: 1, name: 'Someone shared important information with you' })).toBeTruthy();
    expect(screen.getByText(/The link works once\. After you open it, you have 20 minutes in this browser/)).toBeTruthy();
    expect(screen.getByText(/on behalf of the account owner/)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.hash).toBe(`#token=${token}`);

    fireEvent.click(screen.getByRole('button', { name: 'Open shared file' }));
    await screen.findByRole('heading', { level: 1, name: 'This link has already been opened' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/files/share-lookup');
    expect(JSON.parse(String(init?.body))).toEqual({ token });
    expect(init?.credentials).toBe('include');
  });

  test.each([
    ['token_already_redeemed', 410, 'This link has already been opened', /For security each link works once\. If you didn't open it, contact the person who set this up or their family through a trusted channel\./, false],
    ['token_expired', 410, 'This link has expired', /no longer be opened/, false],
    ['invalid_token', 404, "This link isn't valid", /Open it again directly from the email/, false],
    ['rate_limited', 429, 'Too many requests right now', /wait a minute/, true],
    ['server_error', 500, "The file couldn't be prepared", /contact@anycircumstances\.com/, true],
  ])('redemption error %s shows a friendly message, never the raw code', async (code, status, title, body, canRetry) => {
    mockServer({ '/files/share-lookup': { status, body: { ok: false, error: code } } });
    renderShare();
    fireEvent.click(screen.getByRole('button', { name: 'Open shared file' }));

    const heading = await screen.findByRole('heading', { level: 1, name: title });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByRole('alert').textContent).toMatch(body);
    expect(document.body.textContent).not.toContain(code);
    expect(Boolean(screen.queryByRole('button', { name: 'Try again' }))).toBe(canRetry);
    // A failed redemption leaves the address untouched.
    expect(window.location.hash).toBe(`#token=${token}`);
  });

  test('network failure during redemption can be retried', async () => {
    const fetchMock = mockServer({ '/files/share-lookup': { reject: true } });
    renderShare();
    fireEvent.click(screen.getByRole('button', { name: 'Open shared file' }));
    await screen.findByRole('heading', { level: 1, name: "We couldn't connect" });
    expect(document.body.textContent).not.toMatch(/network_error|Failed to fetch/);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { level: 1, name: "We couldn't connect" });
    expect(fetchMock.mock.calls.filter(([url]) => url === '/files/share-lookup')).toHaveLength(2);
  });

  test('an expired 20-minute session after redemption is explained, the token is removed, and no retry is offered', async () => {
    const fetchMock = mockServer({
      '/files/share-lookup': lookupOk,
      '/files/share-package': { status: 401, body: { ok: false, error: 'share_session_required' } },
    });
    renderShare();
    fireEvent.click(screen.getByRole('button', { name: 'Open shared file' }));

    await screen.findByRole('heading', { level: 1, name: 'Your access time has ended' }, { timeout: 5000 });
    expect(screen.getByRole('alert').textContent).toMatch(/20 minutes/);
    expect(document.body.textContent).not.toContain('share_session_required');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(window.location.hash).toBe('');
    expect(fetchMock.mock.calls.filter(([url]) => url === '/files/share-lookup')).toHaveLength(1);
  });
});

describe('share page without a token', () => {
  test('only checks for an already-open session and explains a missing link', async () => {
    const fetchMock = mockServer({ '/files/share-lookup': { status: 400, body: { ok: false, error: 'invalid_token' } } });
    renderShare('');
    await screen.findByRole('heading', { level: 1, name: "This link isn't valid" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ token: '' });
    expect(document.body.textContent).not.toContain('invalid_token');
  });

  test('offers Download + decrypt when this browser still has an open session', async () => {
    mockServer({ '/files/share-lookup': lookupOk, '/files/share-package': { body: { ok: true, files: [{ id: 'users/1/opaque-key', name: 'Letter', content_type: 'application/pdf', size_bytes: 64 }] } } });
    renderShare('');
    await screen.findByRole('heading', { level: 1, name: 'Your shared file' });
    expect(screen.getByRole('button', { name: 'Download + decrypt' })).toBeTruthy();
  });
});
