import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmergencyContactsPage } from '@/pages/app/EmergencyContactsPage';
import { Toaster } from '@/components/ui/toaster';

type Contact = {
  id: string; name: string; email: string; relationship: string;
  verified: boolean; assignedFiles: string[]; addedAt: string;
};

const ana: Contact = {
  id: '7', name: 'Ana Ruiz', email: 'ana@example.test', relationship: 'Sister',
  verified: true, assignedFiles: ['users/1/will.pdf'], addedAt: '2026-01-01T00:00:00.000Z',
};

type Body = Record<string, unknown>;
type Handler = (body: Body) => { status?: number; body: unknown };

function mockServer(contacts: Contact[], handlers: Record<string, Handler> = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input);
    const method = init?.method || 'GET';
    if (path === '/files/list') return Response.json({ ok: true, files: [] });
    if (path === '/auth/emergency-contacts' && method === 'GET') return Response.json({ ok: true, contacts });
    const handler = handlers[`${method} ${path}`];
    if (!handler) throw new Error(`unexpected ${method} ${path}`);
    const reply = handler(JSON.parse(String(init?.body || '{}')));
    return Response.json(reply.body, { status: reply.status ?? 200 });
  });
}

function renderPage() {
  return render(<MemoryRouter><EmergencyContactsPage /><Toaster /></MemoryRouter>);
}

async function fillAddForm(name: string, email: string) {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add contact' }))[0]);
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Full name'), { target: { value: name } });
  fireEvent.change(within(dialog).getByLabelText('Email address'), { target: { value: email } });
  fireEvent.change(within(dialog).getByLabelText('Current account password'), { target: { value: 'Password12345' } });
  return dialog;
}

describe('emergency contacts', () => {
  test('explains confirmation, assignment and email-only delivery', async () => {
    mockServer([]);
    renderPage();
    await screen.findByText('No emergency contacts');
    expect(screen.getByText(/valid for 2 days, and you can resend it/)).toBeTruthy();
    expect(screen.getByText(/A contact with no files assigned receives nothing/)).toBeTruthy();
    expect(screen.getByText(/Delivery is by email only/)).toBeTruthy();
  });

  test('a failed invite email is reported as a warning, never as sent', async () => {
    mockServer([], {
      'POST /auth/emergency-contacts': (body) => ({
        status: 201,
        body: { ok: true, contact: { ...ana, id: '8', name: body.name, email: body.email, verified: false, assignedFiles: [] }, email_sent: false },
      }),
    });
    renderPage();
    const dialog = await fillAddForm('Ben Ode', 'ben@example.test');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add contact' }));

    expect(await screen.findByText("Confirmation email couldn't be sent")).toBeTruthy();
    expect(screen.queryByText(/We emailed ben@example.test/)).toBeNull();
    expect(screen.getByText('Not verified')).toBeTruthy();
    expect(screen.getByText("The confirmation email couldn't be sent.")).toBeTruthy();
    expect(screen.getByText('No files assigned, so this contact will receive nothing.')).toBeTruthy();
  });

  test('a sent invite is confirmed only when the server says it was sent', async () => {
    mockServer([], {
      'POST /auth/emergency-contacts': (body) => ({
        status: 201,
        body: { ok: true, contact: { ...ana, id: '9', name: body.name, email: body.email, verified: false }, email_sent: true },
      }),
    });
    renderPage();
    const dialog = await fillAddForm('Cara Lim', 'cara@example.test');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add contact' }));
    expect(await screen.findByText(/We emailed cara@example.test a confirmation link/)).toBeTruthy();
  });

  test('skipping the confirmation email is labelled truthfully and the contact shows as not invited', async () => {
    const posted: Body[] = [];
    mockServer([], {
      'POST /auth/emergency-contacts': (body) => {
        posted.push(body);
        return { status: 201, body: { ok: true, contact: { ...ana, id: '10', name: body.name, email: body.email, verified: false }, email_sent: false } };
      },
    });
    renderPage();
    const dialog = await fillAddForm('Dev Rao', 'dev@example.test');
    const skip = within(dialog).getByRole('checkbox', { name: /Don't send the confirmation email now/ });
    expect(within(dialog).getByText(/won't receive files in an emergency/)).toBeTruthy();
    fireEvent.click(skip);
    fireEvent.click(await screen.findByRole('button', { name: "Yes, don't send it now" }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add contact' }));

    expect(await screen.findByText('Contact added, not verified')).toBeTruthy();
    expect(posted[0].notifyContact).toBe(false);
    expect(screen.getByText('Not invited')).toBeTruthy();
    expect(screen.getByText('No confirmation email has been sent yet.')).toBeTruthy();
  });

  test('changing a verified contact\'s email shows them as not verified and prompts a resend', async () => {
    mockServer([ana], { 'PATCH /auth/emergency-contacts/7': () => ({ body: { ok: true } }) });
    renderPage();
    await screen.findByText('Verified');
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions for Ana Ruiz' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit contact' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Email address'), { target: { value: 'Ana.New@Example.test' } });
    fireEvent.change(within(dialog).getByLabelText('Current account password'), { target: { value: 'Password12345' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Contact updated, needs to verify again')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Verified')).toBeNull());
    expect(screen.getByText('Not verified')).toBeTruthy();
    expect(screen.getByText('ana.new@example.test')).toBeTruthy();
    expect(screen.getByText(/The email address changed/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeTruthy();
  });

  test('a resend whose email fails is reported as a failure', async () => {
    mockServer([{ ...ana, verified: false }], {
      'POST /auth/emergency-contacts/7/resend': () => ({ body: { ok: true, email_sent: false } }),
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Resend confirmation email' }));
    expect(await screen.findByText("Email couldn't be sent")).toBeTruthy();
    expect(screen.queryByText('Confirmation email sent')).toBeNull();
  });
});
