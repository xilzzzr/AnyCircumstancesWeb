// Synthetic previews only; no SMTP or account access. Run after building the site.
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { renderAnyCircumstancesEmail, renderEmergencyEmail } = require('../backend/emails.js');
const folder = new URL('../dist/email-previews/', import.meta.url);
await mkdir(folder, { recursive: true });
const samples = {
  verification: renderAnyCircumstancesEmail({ title: 'Verify your email', preview: 'Confirm your email address to finish setting up your account.', bodyText: 'Thanks for creating your AnyCircumstances account. Confirm your email address to finish setting up your account.', ctaText: 'Verify email', ctaUrl: 'https://example.com/verification-preview', verificationCode: '012345', info: { title: 'Valid for 48 hours', text: 'For security, this link and code expire after 48 hours.' }, securityNotice: "If you didn't create an AnyCircumstances account, you can safely ignore this email." }),
  reset: renderAnyCircumstancesEmail({ title: 'Reset your password', bodyText: 'We received a request to reset the password for your AnyCircumstances account.', ctaText: 'Reset password', ctaUrl: 'https://example.com/reset-preview', securityNotice: "If you didn't request this, you can safely ignore this email. Your password will not change unless you use the link above." }),
  emergency: renderEmergencyEmail({ name: 'Alex', ownerEmail: 'sender@example.com', links: ['https://example.com/shared-file-preview'], missingSetup: true, scheduled: true }),
};
for (const [name, email] of Object.entries(samples)) {
  await writeFile(new URL(`${name}.html`, folder), email.html);
  await writeFile(new URL(`${name}.txt`, folder), email.text);
}
await writeFile(new URL('index.html', folder), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email previews</title><body style="margin:0;padding:24px;background:#050505;color:#e0e5e1;font-family:Arial,sans-serif"><h1>AnyCircumstances email previews</h1><p>Synthetic content. Use the width control to inspect a phone-sized layout.</p><label>Preview width <select id="width"><option value="100%">Desktop</option><option value="375px">Phone — 375px</option><option value="320px">Small phone — 320px</option></select></label>${Object.keys(samples).map(name => `<h2>${name}</h2><a style="color:#bdd5c8" href="${name}.html">Open email</a><iframe title="${name} email preview" src="${name}.html" style="display:block;width:100%;max-width:720px;height:1050px;border:1px solid #40584a;margin-top:16px"></iframe>`).join('')}<script>document.getElementById('width').addEventListener('change',e=>document.querySelectorAll('iframe').forEach(frame=>frame.style.width=e.target.value));</script></body></html>`);
console.log(`Email previews: ${folder.pathname}index.html`);
