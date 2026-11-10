// Keep JSON clients stable while browser navigation always finishes at a clean URL.
function isVerificationBrowserRequest(req) {
  return req.path === '/verify-email/browser' || /text\/html/i.test(req.get('accept') || '');
}
function verificationResultUrl(base, status) {
  const url = new URL(`${String(base).replace(/\/+$/, '')}/email-verified`);
  url.searchParams.set('status', status);
  return url.href;
}
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Opening the emailed link shows a Confirm button; only the button press
// verifies. Email security scanners open links automatically, and must not be
// able to verify an address on behalf of whoever registered it.
function renderConfirmPage(token) {
  const action = `/auth/verify-email/browser?token=${encodeURIComponent(token)}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Confirm your email address | AnyCircumstances</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#0b0b0f;color:#fff}
    .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:100%;max-width:520px;background:#12121a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:22px}
    .title{font-size:20px;font-weight:700;margin:0 0 10px 0}
    .muted{color:rgba(255,255,255,.72);font-size:14px;line-height:1.5}
    .confirm{margin-top:12px;padding:12px 16px;border:0;border-radius:8px;background:#fff;color:#0b0b0f;font:inherit;font-weight:700;cursor:pointer}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <p class="title">Confirm your email address</p>
      <p class="muted">Confirm that this email address belongs to you to finish setting up your AnyCircumstances account.</p>
      <form method="post" action="${escapeHtml(action)}">
        <button class="confirm" type="submit">Confirm email address</button>
      </form>
      <p class="muted">If you didn’t create an account, close this page. Nothing happens unless you confirm.</p>
    </div>
  </div>
</body>
</html>`;
}

function createEmailVerificationHandler({ pool, consumeToken, publicWebBaseUrl, logError }) {
  return async (req, res) => {
    const browser = isVerificationBrowserRequest(req);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const finish = (status, code, payload) => browser
      ? res.redirect(303, verificationResultUrl(publicWebBaseUrl, status))
      : res.status(code).json(payload);
    const token = String(req.query?.token || '');
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) return finish('invalid', 400, { ok: false, error: 'invalid_token' });
    if (browser && req.method === 'GET') {
      return res.status(200).type('html').send(renderConfirmPage(token));
    }
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const out = await consumeToken(conn, token);
      if (!out.ok) {
        await conn.rollback();
        const status = out.reason === 'expired' ? 'expired' : out.reason === 'already_used' ? 'already_verified' : 'invalid';
        return finish(status, 400, { ok: false, error: out.reason });
      }
      await conn.commit();
      return finish('success', 200, { ok: true });
    } catch (error) {
      try { await conn?.rollback(); } catch {}
      logError('verify-email', error);
      return finish('error', 500, { ok: false, error: 'server_error' });
    } finally {
      conn?.release();
    }
  };
}
function verificationBrowserErrors(publicWebBaseUrl) {
  return (req, res, next) => {
    const browser = req.method === 'GET' &&
      (req.path === '/auth/verify-email/browser' ||
        (req.path === '/auth/verify-email' && /text\/html/i.test(req.get('accept') || '')));
    if (browser) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      const send = res.send.bind(res);
      res.send = (body) => {
        if (res.statusCode >= 400 && !res.headersSent) {
          res.removeHeader('Content-Type');
          return res.redirect(303, verificationResultUrl(publicWebBaseUrl, 'error'));
        }
        return send(body);
      };
    }
    next();
  };
}
module.exports = { verificationBrowserErrors, createEmailVerificationHandler, isVerificationBrowserRequest, renderConfirmPage, verificationResultUrl };
