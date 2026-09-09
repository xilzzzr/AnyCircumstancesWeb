// Email-safe counterparts of the site's charcoal, soft-white and sage visual system.
// bodyHtml is trusted application markup: escape all interpolated user content.
function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function emailUrl(value) {
  if (!value) return '';
  const url = new URL(String(value));
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported email link protocol');
  return escapeHtml(url.href);
}
function emailSender(env = process.env) {
  const configured = String(env.EMAIL_FROM || env.MAIL_FROM || env.SMTP_FROM || env.SMTP_USER || '').trim();
  const address = configured.match(/<([^<>]+)>/)?.[1] || configured;
  return address ? { name: 'AnyCircumstances', address } : undefined;
}
function htmlToText(html) {
  return String(html || '').replace(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs, '$2 ($1)')
    .replace(/<\/(?:p|li|h[1-6])>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').trim();
}
function emailButton(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td bgcolor="#bdd5c8" style="border-radius:24px;background-image:linear-gradient(115deg,#e0ece5 0%,#adc6b9 65%,#8fab9e 100%);box-shadow:0 6px 24px #050b08"><a href="${emailUrl(url)}" style="display:inline-block;padding:14px 24px;border:1px solid #bdd5c8;border-radius:24px;color:#111513;font-size:16px;font-weight:700;text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;
}
function renderAnyCircumstancesEmail({ title, heading = title, preview = heading, bodyHtml, bodyText, ctaText, ctaUrl, secondaryCta, verificationCode, info, securityNotice, footerNote }) {
  const notice = securityNotice || footerNote;
  const body = bodyHtml || `<p style="margin:0;white-space:pre-line">${escapeHtml(bodyText)}</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><style>:root { color-scheme:dark; supported-color-schemes:dark; } @media (prefers-color-scheme:dark) { .email-card { background-color:#101613 !important; color:#e0e5e1 !important; } }</style><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#f4f5f2">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#050505" style="background-color:#050505;background-image:radial-gradient(ellipse at 80% 0%,#1b2c24 0%,#050505 65%)"><tr><td align="center" style="padding:28px 12px">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-card" bgcolor="#101613" style="max-width:600px;background-color:#101613;background-image:linear-gradient(150deg,#18221c 0%,#101613 45%,#0b100d 100%);border:1px solid #394b40;border-radius:24px;box-shadow:0 24px 64px #000000">
<tr><td bgcolor="#17271f" style="padding:30px 24px;background-color:#17271f;background-image:linear-gradient(120deg,#283e31 0%,#14231b 58%,#0d1511 100%);border-radius:24px 24px 0 0;border-bottom:1px solid #40584a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:20px;letter-spacing:-0.5px;font-weight:600;color:#eef4ef">AnyCircumstances</td><td width="38" align="right" aria-hidden="true"><span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border:1px solid #819c8a;border-radius:50%;font-size:16px;color:#d6e6df">&#9675;</span></td></tr></table>
<p style="margin:12px 0 0;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#b3caba">Prepared for what matters</p>
</td></tr>
<tr><td style="padding:32px 24px;font-size:16px;line-height:1.65;color:#e0e5e1;overflow-wrap:anywhere;word-break:break-word">
<h1 style="margin:0 0 18px;font-size:32px;line-height:1.15;letter-spacing:-0.8px;font-weight:500;color:#f4f5f2">${escapeHtml(heading)}</h1>
${body}
${ctaText && ctaUrl ? emailButton(ctaText, ctaUrl) : ''}
${verificationCode ? `<p style="margin:20px 0 10px">Or enter this verification code:</p><div style="padding:18px;background-color:#1d3026;background-image:linear-gradient(120deg,#2b4535 0%,#14261c 100%);border:1px solid #62796b;border-radius:16px;font-family:monospace;font-size:32px;letter-spacing:6px;text-align:center;color:#f4f5f2">${escapeHtml(verificationCode)}</div>` : ''}
${info ? `<div style="margin-top:24px;padding:18px;background-color:#17231c;background-image:linear-gradient(120deg,#203127,#111b15);border:1px solid #405a49;border-radius:16px"><h2 style="font-size:17px;margin:0 0 8px;color:#d6e6df">${escapeHtml(info.title || 'Please note')}</h2>${escapeHtml(info.text)}</div>` : ''}
${ctaText && ctaUrl ? `<p style="margin:24px 0 8px;font-size:14px;color:#b8c5be">If the button above doesn't work, copy and paste this link into your browser:</p><a href="${emailUrl(ctaUrl)}" style="font-size:14px;color:#d6e6df;word-break:break-all;overflow-wrap:anywhere">${escapeHtml(ctaUrl)}</a>` : ''}
${secondaryCta ? `<p><a href="${emailUrl(secondaryCta.url)}" style="color:#d6e6df">${escapeHtml(secondaryCta.label)}</a></p>` : ''}
${notice ? `<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #39433e;font-size:14px;color:#b8c5be">${escapeHtml(notice)}</p>` : ''}
</td></tr><tr><td bgcolor="#0c120e" style="padding:24px;border-radius:0 0 24px 24px;background-color:#0c120e;border-top:1px solid #39433e;font-size:13px;line-height:1.7;color:#b8c5be"><strong>AnyCircumstances</strong><br>Your information, delivered when it matters.</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  const text = [heading, bodyText || htmlToText(body), ctaText && ctaUrl ? `${ctaText}: ${ctaUrl}` : '', verificationCode ? `Or enter this verification code: ${verificationCode}` : '', info ? `${info.title || 'Please note'}: ${info.text}` : '', secondaryCta ? `${secondaryCta.label}: ${secondaryCta.url}` : '', notice, 'AnyCircumstances', 'Your information, delivered when it matters.'].filter(Boolean).join('\n\n');
  return { html, text };
}
function renderEmergencyEmail({ name, ownerEmail, links, missingSetup, scheduled = false }) {
  const context = scheduled ? 'The account owner missed a required check-in and their grace period has ended.' : 'The account owner triggered emergency access.';
  return renderAnyCircumstancesEmail({
    title: 'Emergency access', preview: 'Important information has been shared with you through AnyCircumstances.',
    bodyHtml: `<p>${escapeHtml(name ? `Hi ${name},` : 'Hi,')}</p><h2 style="font-size:18px;color:#d6e6df">Why you received this</h2><p>${context}</p>${ownerEmail ? `<p><strong>Account:</strong> ${escapeHtml(ownerEmail)}</p>` : ''}<h2 style="font-size:18px;color:#d6e6df">Shared information</h2><p>Open each secure link to access the files assigned to you.</p><ol style="padding-left:24px">${links.map((url, i) => `<li style="margin-bottom:16px"><a href="${emailUrl(url)}" style="color:#d6e6df">Open shared file ${i + 1}</a><br><span style="font-size:13px;word-break:break-all">${escapeHtml(url)}</span></li>`).join('')}</ol>`,
    ctaText: 'Open shared information', ctaUrl: links[0],
    info: missingSetup ? { title: 'Contact setup required', text: 'Your emergency contact setup is incomplete. Open a link to complete setup. Files may not decrypt unless the account owner shared access with you in advance.' } : undefined,
    securityNotice: 'These links provide access to private information. Keep them secure and do not forward this email. If this is unexpected, contact the account owner through a trusted channel.'
  });
}
module.exports = { escapeHtml, emailSender, emailButton, renderAnyCircumstancesEmail, renderEmergencyEmail };
