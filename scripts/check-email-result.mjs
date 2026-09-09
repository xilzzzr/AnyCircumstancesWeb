// Run after npm run build. Verifies actual compiled route markup without a browser.
import { readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
const files = await readdir(new URL('../dist-ssr/assets/', import.meta.url));
const filename = files.find(name => /^EmailVerifiedPage-.*\.js$/.test(name));
assert.ok(filename, 'Build the app before running this check');
const { EmailVerifiedPage } = await import(new URL(`../dist-ssr/assets/${filename}`, import.meta.url));
for (const [status, heading] of Object.entries({ success: 'Email verified', already_verified: 'Email already verified', expired: 'This verification link has expired', invalid: 'We couldn', error: 'Something went wrong', unexpected: 'We couldn' })) {
  const html = renderToString(React.createElement(MemoryRouter, { initialEntries: [`/email-verified?status=${status}`] }, React.createElement(EmailVerifiedPage)));
  assert.ok(html.includes(heading));
  assert.ok(html.includes('href="/login"'));
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.ok(!html.includes('ok: true'));
  if (!['success', 'already_verified'].includes(status)) assert.ok(html.includes('/verify-email?resend=1'));
}
console.log('Verified all five result states, unknown-state fallback, and sign-in/resend destinations.');
