const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderAnyCircumstancesEmail, renderEmergencyEmail, emailSender } = require('./emails');
test('layout escapes data and preserves critical actions in both alternatives', () => {
  const out = renderAnyCircumstancesEmail({ title: '<Verify>', bodyText: '<private> & text', preview: 'Confirm your email', ctaText: 'Verify email', ctaUrl: 'https://example.com/verify?token=test&next=ok', verificationCode: '012345', info: { text: '<note>' }, securityNotice: 'Ignore if not requested', secondaryCta: { label: 'Help', url: 'https://example.com/help' } });
  assert.match(out.html, /&lt;Verify&gt;/);
  assert.match(out.html, /&lt;private&gt; &amp; text/);
  assert.match(out.html, /token=test&amp;next=ok/);
  for (const content of ['012345', 'Verify email', 'Ignore if not requested', 'AnyCircumstances', 'Help']) {
    assert.ok(out.html.includes(content)); assert.ok(out.text.includes(content));
  }
  assert.match(out.text, /token=test&next=ok/);
  assert.match(out.html, /max-width:600px/);
  assert.doesNotMatch(out.html, /<img|<script/);
  assert.throws(() => renderAnyCircumstancesEmail({ ctaText: 'Unsafe', ctaUrl: 'javascript:alert(1)' }));
});
test('emergency templates retain every link and explain access without key setup, escaping recipient data', () => {
  for (const scheduled of [true, false]) {
    const links = ['https://example.com/share#token=one', 'https://example.com/share#token=two'];
    const out = renderEmergencyEmail({ name: '<script>alert(1)</script>', ownerEmail: 'owner@example.com', links, missingSetup: true, scheduled });
    for (const link of links) { assert.ok(out.html.includes(link)); assert.ok(out.text.includes(link)); }
    assert.match(out.text, /No contact key setup is required/);
    assert.doesNotMatch(out.text, /Contact setup required|Files may not decrypt/);
    assert.doesNotMatch(out.html, /<script>/);
    assert.match(out.html, /Shared information/);
  }
});
test('sender aliases use a consistent brand without changing configured mailbox', () => {
  assert.deepEqual(emailSender({ MAIL_FROM: 'old <sender@example.com>' }), { name: 'AnyCircumstances', address: 'sender@example.com' });
  assert.equal(emailSender({ EMAIL_FROM: 'primary@example.com', MAIL_FROM: 'other@example.com' }).address, 'primary@example.com');
  assert.equal(emailSender({ SMTP_FROM: 'smtp@example.com' }).address, 'smtp@example.com');
  assert.equal(emailSender({ SMTP_USER: 'fallback@example.com' }).address, 'fallback@example.com');
});
test('all dark email text is white while the light CTA keeps dark lettering', () => {
  const out = renderAnyCircumstancesEmail({ title:'Hello', bodyText:'Message', ctaText:'Open', ctaUrl:'https://example.com', verificationCode:'123456', info:{ text:'Info' }, securityNotice:'Notice' });
  assert.doesNotMatch(out.html, /color:#(?:e0e5e1|f4f5f2|b8c5be|d6e6df|b3caba)/);
  assert.match(out.html, /color:#ffffff/);
  assert.match(out.html, /color:#111513/);
});
test('recipient subjects identify the owner, fall back to email, and strip header controls', () => {
  const { emergencyEmailSubject } = require('./emails');
  assert.match(emergencyEmailSubject('Arina', 'owner@example.com'), /^Arina: emergency information/);
  assert.match(emergencyEmailSubject('', 'owner@example.com'), /^owner@example.com:/);
  assert.doesNotMatch(emergencyEmailSubject('A\r\nBcc: attacker@example.com', ''), /[\r\n]/);
  const out = renderEmergencyEmail({ ownerName:'<Arina>', links:['https://example.com/share'], scheduled:true });
  assert.match(out.html, /&lt;Arina&gt;/);
  assert.match(out.text, /<Arina>/);
});
