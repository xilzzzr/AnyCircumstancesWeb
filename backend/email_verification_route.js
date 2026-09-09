// Keep JSON clients stable while browser navigation always finishes at a clean URL.
function isVerificationBrowserRequest(req) {
  return req.path === '/verify-email/browser' || /text\/html/i.test(req.get('accept') || '');
}
function verificationResultUrl(base, status) {
  const url = new URL(`${String(base).replace(/\/+$/, '')}/email-verified`);
  url.searchParams.set('status', status);
  return url.href;
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
module.exports = { verificationBrowserErrors, createEmailVerificationHandler, isVerificationBrowserRequest, verificationResultUrl };
