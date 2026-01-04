const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const router = express.Router();

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  JWT_ACCESS_SECRET,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  COOKIE_SECURE,
  COOKIE_DOMAIN,
  PUBLIC_API_BASE_URL,
  PUBLIC_WEB_BASE_URL,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  EMAIL_FROM
} = process.env;

if (!DB_HOST || !DB_USER || !DB_NAME || !JWT_ACCESS_SECRET) {
  throw new Error("Missing required env vars: DB_HOST, DB_USER, DB_NAME, JWT_ACCESS_SECRET");
}

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT ? Number(DB_PORT) : 3306,
  user: DB_USER,
  password: DB_PASSWORD || "",
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const accessTtlSeconds = ACCESS_TOKEN_TTL_SECONDS ? Number(ACCESS_TOKEN_TTL_SECONDS) : 900;
const refreshTtlDays = REFRESH_TOKEN_TTL_DAYS ? Number(REFRESH_TOKEN_TTL_DAYS) : 30;
const cookieSecure = (COOKIE_SECURE || "").toLowerCase() === "true";
const cookieDomain = COOKIE_DOMAIN || undefined;
const publicApiBaseUrl = PUBLIC_API_BASE_URL || "http://localhost:3001";

function logError(context, err) {
  const meta = {
    context,
    name: err?.name,
    message: err?.message,
    code: err?.code,
    errno: err?.errno,
    sqlState: err?.sqlState
  };
  console.error("[AUTH ERROR]", meta);
  if (err?.stack) console.error(err.stack);
}

let _mailer = null;

function getMailer() {
  const host = String(SMTP_HOST || "").trim();
  const port = SMTP_PORT ? Number(SMTP_PORT) : 0;
  const user = String(SMTP_USER || "").trim();
  const pass = String(SMTP_PASS || "").replace(/\s+/g, "").trim();
  const secure = String(SMTP_SECURE || "").toLowerCase() === "true";

  if (!host || !port || !user || !pass) return null;
  if (_mailer) return _mailer;

  _mailer = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  return _mailer;
}

async function sendVerificationEmail(toEmail, code, verifyUrl) {
  const transporter = getMailer();
  const from = EMAIL_FROM || `UnderAnyCircumstance <${SMTP_USER || "no-reply@localhost"}>`;

  if (!transporter) {
    console.error("[MAILER] Missing SMTP env vars; skipping email send. Use verify_code_dev_only instead.");
    return { ok: false, skipped: true };
  }

  const subject = "Your UnderAnyCircumstance verification code";
  const text =
    `Your verification code is: ${code}\n\n` +
    `You can also verify by opening this link:\n${verifyUrl}\n\n` +
    `If you did not request this, you can ignore this email.\n`;

  const html =
    `<p>Your verification code is:</p>` +
    `<p style="font-size:22px;font-weight:700;letter-spacing:2px">${code}</p>` +
    `<p>You can also verify by opening this link:</p>` +
    `<p><a href="${verifyUrl}">${verifyUrl}</a></p>` +
    `<p>If you did not request this, you can ignore this email.</p>`;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text,
    html
  });

  return { ok: true };
}

function nowUtc() {
  return new Date();
}

function addDays(d, days) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: accessTtlSeconds });
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    domain: cookieDomain,
    path: "/",
    maxAge: maxAgeMs
  };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("access_token", accessToken, cookieOptions(accessTtlSeconds * 1000));
  res.cookie("refresh_token", refreshToken, cookieOptions(refreshTtlDays * 24 * 60 * 60 * 1000));
}

function clearAuthCookies(res) {
  res.clearCookie("access_token", { domain: cookieDomain, path: "/" });
  res.clearCookie("refresh_token", { domain: cookieDomain, path: "/" });
}

function isSixDigitCode(code) {
  return /^\d{6}$/.test(String(code || ""));
}

function genSixDigitCode() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, "0");
}

async function getUserByEmail(email) {
  const [rows] = await pool.query(
    "SELECT id, email, password_hash, email_verified_at, status FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

async function getUserById(userId) {
  const [rows] = await pool.query(
    "SELECT id, email, email_verified_at, status FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  return rows[0] || null;
}

async function createEmailVerificationCode(conn, userId) {
  // Keep only one active code per user
  await conn.query(
    "DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL",
    [userId]
  );

  const expiresAt = addDays(nowUtc(), 2);

  for (let i = 0; i < 10; i++) {
    const code = genSixDigitCode();
    const tokenHash = sha256Hex(code);

    try {
      await conn.query(
        "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        [userId, tokenHash, expiresAt]
      );
      return code;
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) continue;
      throw e;
    }
  }

  throw new Error("Failed to generate unique verification code");
}

async function consumeEmailVerificationForUser(conn, userId, code) {
  const tokenHash = sha256Hex(code);

  const [rows] = await conn.query(
    "SELECT id, expires_at, used_at FROM email_verification_tokens WHERE user_id = ? AND token_hash = ? LIMIT 1",
    [userId, tokenHash]
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid_code" };
  if (row.used_at) return { ok: false, reason: "already_used" };
  if (new Date(row.expires_at).getTime() < nowUtc().getTime()) return { ok: false, reason: "expired" };

  await conn.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?", [row.id]);
  await conn.query(
    "UPDATE users SET email_verified_at = NOW() WHERE id = ? AND email_verified_at IS NULL",
    [userId]
  );

  return { ok: true };
}

async function consumeEmailVerificationByTokenOnly(conn, rawToken) {
  const tokenHash = sha256Hex(rawToken);

  const [rows] = await conn.query(
    "SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ? LIMIT 1",
    [tokenHash]
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid_token" };
  if (row.used_at) return { ok: false, reason: "already_used" };
  if (new Date(row.expires_at).getTime() < nowUtc().getTime()) return { ok: false, reason: "expired" };

  await conn.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?", [row.id]);
  await conn.query(
    "UPDATE users SET email_verified_at = NOW() WHERE id = ? AND email_verified_at IS NULL",
    [row.user_id]
  );

  return { ok: true };
}

async function issueRefreshToken(conn, userId) {
  const raw = crypto.randomBytes(48).toString("base64url");
  const tokenHash = sha256Hex(raw);
  const expiresAt = addDays(nowUtc(), refreshTtlDays);
  await conn.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, tokenHash, expiresAt]
  );
  return raw;
}

async function revokeRefreshToken(conn, raw) {
  const tokenHash = sha256Hex(raw);
  await conn.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL",
    [tokenHash]
  );
}

async function rotateRefreshToken(conn, raw) {
  const tokenHash = sha256Hex(raw);
  const [rows] = await conn.query(
    "SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ? LIMIT 1",
    [tokenHash]
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid_refresh" };
  if (row.revoked_at) return { ok: false, reason: "revoked_refresh" };
  if (new Date(row.expires_at).getTime() < nowUtc().getTime()) return { ok: false, reason: "expired_refresh" };

  await conn.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL", [row.id]);
  const newRaw = await issueRefreshToken(conn, row.user_id);
  return { ok: true, userId: row.user_id, newRefresh: newRaw };
}

router.post("/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!validateEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (password.length < 10) return res.status(400).json({ ok: false, error: "weak_password" });

    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ ok: false, error: "email_in_use" });

    const passwordHash = await bcrypt.hash(password, 12);

    const conn = await pool.getConnection();
    let verifyCode = "";
    let verifyUrl = "";
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        "INSERT INTO users (email, password_hash, status, created_at) VALUES (?, ?, 'active', NOW())",
        [email, passwordHash]
      );

      const userId = result.insertId;
      verifyCode = await createEmailVerificationCode(conn, userId);
      verifyUrl = `${publicApiBaseUrl}/auth/verify-email?token=${encodeURIComponent(verifyCode)}`;

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }

    let emailSent = false;
    try {
      const out = await sendVerificationEmail(email, verifyCode, verifyUrl);
      emailSent = !!out?.ok;
    } catch (e) {
      logError("sendVerificationEmail(register)", e);
      emailSent = false;
    }

    return res.status(201).json({
      ok: true,
      needs_email_verification: true,
      email_sent: emailSent,
      verify_code_dev_only: verifyCode,
      verify_url_dev_only: verifyUrl
    });
  } catch (e) {
    logError("register", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Verify via link (token is now the 6-digit code)
router.get("/verify-email", async (req, res) => {
  try {
    const token = String(req.query?.token || "");
    if (!token || !isSixDigitCode(token)) return res.status(400).json({ ok: false, error: "invalid_code" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const out = await consumeEmailVerificationByTokenOnly(conn, token);
      if (!out.ok) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: out.reason });
      }

      await conn.commit();
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    logError("verify-email", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Verify via code entry (frontend will call this)
router.post("/verify-email-code", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "");

    if (!validateEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (!isSixDigitCode(code)) return res.status(400).json({ ok: false, error: "invalid_code" });

    const user = await getUserByEmail(email);
    if (!user) return res.status(400).json({ ok: false, error: "invalid_code" });
    if (user.email_verified_at) return res.json({ ok: true });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const out = await consumeEmailVerificationForUser(conn, user.id, code);
      if (!out.ok) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: out.reason });
      }

      await conn.commit();
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    logError("verify-email-code", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!validateEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (!password) return res.status(400).json({ ok: false, error: "missing_password" });

    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ ok: false, error: "invalid_credentials" });
    if (user.status !== "active") return res.status(403).json({ ok: false, error: "account_disabled" });
    if (!user.email_verified_at) return res.status(403).json({ ok: false, error: "email_not_verified" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: "invalid_credentials" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const refresh = await issueRefreshToken(conn, user.id);
      const access = signAccessToken({ sub: String(user.id), email: user.email });

      await conn.commit();

      setAuthCookies(res, access, refresh);
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    logError("login", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/set-pin", async (req, res) => {
  try {
    const access = req.cookies?.access_token ? String(req.cookies.access_token) : "";
    if (!access) return res.status(401).json({ ok: false, error: "not_authenticated" });

    let payload;
    try {
      payload = jwt.verify(access, JWT_ACCESS_SECRET);
    } catch {
      return res.status(401).json({ ok: false, error: "invalid_session" });
    }

    const userId = payload?.sub ? String(payload.sub) : "";
    if (!userId) return res.status(401).json({ ok: false, error: "invalid_session" });

    const pin = String(req.body?.pin || "");
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ ok: false, error: "invalid_pin" });

    const pinHash = await bcrypt.hash(pin, 12);

    await pool.query("UPDATE users SET pin_hash = ? WHERE id = ? LIMIT 1", [pinHash, userId]);

    return res.json({ ok: true });
  } catch (e) {
    logError("set-pin", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const raw = req.cookies?.refresh_token ? String(req.cookies.refresh_token) : "";
    if (!raw) return res.status(401).json({ ok: false, error: "missing_refresh" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const rotated = await rotateRefreshToken(conn, raw);
      if (!rotated.ok) {
        await conn.rollback();
        clearAuthCookies(res);
        return res.status(401).json({ ok: false, error: rotated.reason });
      }

      const user = await getUserById(rotated.userId);
      if (!user || user.status !== "active" || !user.email_verified_at) {
        await conn.rollback();
        clearAuthCookies(res);
        return res.status(401).json({ ok: false, error: "invalid_user" });
      }

      const access = signAccessToken({ sub: String(user.id), email: user.email });

      await conn.commit();

      setAuthCookies(res, access, rotated.newRefresh);
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    logError("refresh", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const raw = req.cookies?.refresh_token ? String(req.cookies.refresh_token) : "";
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (raw) await revokeRefreshToken(conn, raw);
      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      logError("logout-tx", e);
    } finally {
      conn.release();
    }
    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch (e) {
    logError("logout", e);
    clearAuthCookies(res);
    return res.json({ ok: true });
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validateEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });

    const user = await getUserByEmail(email);
    if (!user) return res.json({ ok: true, email_sent: true });
    if (user.email_verified_at) return res.json({ ok: true, email_sent: true });
    if (user.status !== "active") return res.json({ ok: true, email_sent: true });

    const conn = await pool.getConnection();
    let verifyCode = "";
    let verifyUrl = "";
    try {
      await conn.beginTransaction();

      verifyCode = await createEmailVerificationCode(conn, user.id);
      verifyUrl = `${publicApiBaseUrl}/auth/verify-email?token=${encodeURIComponent(verifyCode)}`;

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }

    let emailSent = false;
    try {
      const out = await sendVerificationEmail(email, verifyCode, verifyUrl);
      emailSent = !!out?.ok;
    } catch (e) {
      logError("sendVerificationEmail(resend)", e);
      emailSent = false;
    }

    return res.json({ ok: true, email_sent: emailSent, verify_code_dev_only: verifyCode, verify_url_dev_only: verifyUrl });
  } catch (e) {
    logError("resend-verification", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

function getUserIdFromAccessCookie(req) {
  const access = req.cookies?.access_token ? String(req.cookies.access_token) : "";
  if (!access) return null;

  try {
    const payload = jwt.verify(access, JWT_ACCESS_SECRET);
    const userId = payload?.sub ? String(payload.sub) : null;
    return userId || null;
  } catch {
    return null;
  }
}

async function createEmergencyContactVerificationCode(conn, contactId) {
  await conn.query(
    "DELETE FROM emergency_contact_verification_tokens WHERE contact_id = ? AND used_at IS NULL",
    [contactId]
  );

  const expiresAt = addDays(nowUtc(), 2);

  for (let i = 0; i < 10; i++) {
    const code = genSixDigitCode();
    const tokenHash = sha256Hex(code);
    try {
      await conn.query(
        "INSERT INTO emergency_contact_verification_tokens (contact_id, token_hash, expires_at) VALUES (?, ?, ?)",
        [contactId, tokenHash, expiresAt]
      );
      return code;
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) continue;
      throw e;
    }
  }

  throw new Error("Failed to generate unique emergency contact verification code");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getEmergencyContactContext(contactId) {
  if (!contactId) return null;
  const [rows] = await pool.query(
    "SELECT ec.name AS contact_name, u.email AS owner_email FROM emergency_contacts ec JOIN users u ON u.id = ec.user_id WHERE ec.id = ? LIMIT 1",
    [contactId]
  );
  return rows[0] || null;
}

function renderEmergencyContactVerifyHtml(opts) {
  const ok = !!opts?.ok;
  const reason = String(opts?.reason || "");
  const ownerEmail = String(opts?.ownerEmail || "");
  const contactName = String(opts?.contactName || "");

  let title = "Confirming…";
  let finalTitle = "Confirmed";
  let finalText = "You’re verified as an emergency contact.";
  let finalSub = ownerEmail ? `For ${ownerEmail}` : "";

  if (!ok) {
    finalTitle = "Could not confirm";
    finalSub = "";
    if (reason === "expired") finalText = "This confirmation link expired. Ask the account owner to resend the invite.";
    else if (reason === "already_used") finalText = "This link was already used. You’re probably already confirmed.";
    else finalText = "This confirmation link is invalid. Ask the account owner to resend the invite.";
  }

  const safeFinalTitle = escapeHtml(finalTitle);
  const safeFinalText = escapeHtml(finalText);
  const safeFinalSub = escapeHtml(finalSub);
  const safeContact = contactName ? escapeHtml(contactName) : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>UnderAnyCircumstance</title>
  <style>
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#0b0b0f;color:#fff}
    .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:100%;max-width:520px;background:#12121a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:22px}
    .brand{display:flex;align-items:center;gap:10px;margin-bottom:16px;color:rgba(255,255,255,.9)}
    .dot{width:10px;height:10px;border-radius:999px;background:#7c3aed}
    .title{font-size:20px;font-weight:700;margin:0 0 6px 0}
    .sub{margin:0 0 16px 0;color:rgba(255,255,255,.72)}
    .row{display:flex;align-items:center;gap:12px;margin-top:18px}
    .spinner{width:20px;height:20px;border-radius:999px;border:2px solid rgba(255,255,255,.22);border-top-color:#7c3aed;animation:spin 1s linear infinite}
    .check{width:22px;height:22px;border-radius:999px;background:rgba(34,197,94,.18);display:flex;align-items:center;justify-content:center}
    .check svg{width:14px;height:14px}
    .btn{display:inline-block;margin-top:16px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.08);color:#fff;text-decoration:none}
    .muted{color:rgba(255,255,255,.6);font-size:13px;margin-top:12px}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="brand"><span class="dot"></span><span>UnderAnyCircumstance</span></div>
      <p class="title" id="t">${escapeHtml(title)}</p>
      <p class="sub" id="s">${safeContact ? `For ${safeContact}` : `Please wait…`}</p>
      <div class="row" id="loadingRow">
        <div class="spinner"></div>
        <div style="color:rgba(255,255,255,.8)">Verifying your email…</div>
      </div>
      <div id="final" style="display:none">
        <div class="row">
          ${ok ? `<div class="check"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>` : `<div class="check" style="background:rgba(239,68,68,.18)"><svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/></svg></div>`}
          <div>
            <div style="font-weight:700">${safeFinalTitle}</div>
            <div style="color:rgba(255,255,255,.72);font-size:13px">${safeFinalSub}</div>
          </div>
        </div>
        <p class="muted">${safeFinalText}</p>
        <a class="btn" href="${escapeHtml(publicWebBaseUrl)}">Go to site</a>
      </div>
    </div>
  </div>
  <script>
    setTimeout(function(){
      document.getElementById('loadingRow').style.display = 'none';
      document.getElementById('t').textContent = ${JSON.stringify(finalTitle)};
      document.getElementById('s').textContent = ${JSON.stringify(finalSub || "")};
      document.getElementById('final').style.display = 'block';
    }, 2000);
  </script>
</body>
</html>`;
}

async function consumeEmergencyContactVerificationByToken(conn, code) {
  const tokenHash = sha256Hex(code);

  const [rows] = await conn.query(
    "SELECT id, contact_id, expires_at, used_at FROM emergency_contact_verification_tokens WHERE token_hash = ? LIMIT 1",
    [tokenHash]
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid_code", contactId: null };

  const contactId = row.contact_id;

  if (row.used_at) return { ok: false, reason: "already_used", contactId };
  if (new Date(row.expires_at).getTime() < nowUtc().getTime()) return { ok: false, reason: "expired", contactId };

  await conn.query("UPDATE emergency_contact_verification_tokens SET used_at = NOW() WHERE id = ?", [row.id]);
  await conn.query(
    "UPDATE emergency_contacts SET verified_at = NOW() WHERE id = ? AND verified_at IS NULL",
    [contactId]
  );

  return { ok: true, contactId };
}

async function sendEmergencyContactInviteEmail(toEmail, contactName, ownerEmail, verifyUrl) {
  const transporter = getMailer();
  const from = EMAIL_FROM || `UnderAnyCircumstance <${SMTP_USER || "no-reply@localhost"}>`;

  if (!transporter) {
    console.error("[MAILER] Missing SMTP env vars; skipping emergency contact invite email.");
    return { ok: false, skipped: true };
  }

  const safeOwner = String(ownerEmail || "").trim() || "someone you know";
  const safeName = String(contactName || "").trim();

  const subject = `Confirm you’re an emergency contact for ${safeOwner}`;

  const introLine = safeName ? `Hi ${safeName},` : "Hi,";
  const text =
    `${introLine}\n\n` +
    `${safeOwner} added you as an emergency contact in UnderAnyCircumstance.\n\n` +
    `What this means:\n` +
    `- You are not taking on any responsibility for them.\n` +
    `- If they miss scheduled check-ins and the grace period expires, you may receive a secure email with links to files they assigned to you.\n` +
    `- You do not need an account.\n\n` +
    `To confirm you agree to be listed as their emergency contact, click:\n` +
    `${verifyUrl}\n\n` +
    `If you weren’t expecting this, you can ignore this email.\n`;

  const html =
    `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5;color:#111">` +
      `<p style="margin:0 0 12px 0">${escapeHtml(introLine)}</p>` +
      `<p style="margin:0 0 12px 0"><b>${escapeHtml(safeOwner)}</b> added you as an emergency contact in <b>UnderAnyCircumstance</b>.</p>` +
      `<p style="margin:16px 0 8px 0"><b>What this means</b></p>` +
      `<ul style="margin:0 0 16px 18px;padding:0">` +
        `<li>You are not taking on any responsibility for them.</li>` +
        `<li>If they miss scheduled check-ins and the grace period expires, you may receive a secure email with links to files they assigned to you.</li>` +
        `<li>You do not need an account.</li>` +
      `</ul>` +
      `<p style="margin:0 0 14px 0">To confirm you agree to be listed as their emergency contact, click:</p>` +
      `<p style="margin:0 0 18px 0">` +
        `<a href="${verifyUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px">Confirm emergency contact</a>` +
      `</p>` +
      `<p style="margin:0;color:#555;font-size:13px">If you weren’t expecting this, you can ignore this email.</p>` +
    `</div>`;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text,
    html
  });

  return { ok: true };
}

function toContactDto(row, assignedFiles) {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    relationship: row.relationship || "",
    verified: !!row.verified_at,
    assignedFiles: assignedFiles || [],
    addedAt: new Date(row.created_at).toISOString()
  };
}

router.get("/emergency-contacts", async (req, res) => {
  try {
    const userId = getUserIdFromAccessCookie(req);
    if (!userId) return res.status(401).json({ ok: false, error: "not_authenticated" });

    const [contacts] = await pool.query(
      "SELECT id, name, email, relationship, verified_at, created_at FROM emergency_contacts WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const ids = contacts.map((c) => c.id);
    const map = new Map();
    for (const c of contacts) map.set(String(c.id), []);

    if (ids.length > 0) {
      const [assignments] = await pool.query(
        `SELECT contact_id, file_id FROM emergency_contact_file_assignments WHERE contact_id IN (${ids.map(() => "?").join(",")})`,
        ids
      );
      for (const a of assignments) {
        const key = String(a.contact_id);
        const arr = map.get(key) || [];
        arr.push(String(a.file_id));
        map.set(key, arr);
      }
    }

    return res.json({
      ok: true,
      contacts: contacts.map((c) => toContactDto(c, map.get(String(c.id)) || []))
    });
  } catch (e) {
    logError("emergency-contacts:list", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/emergency-contacts", async (req, res) => {
  try {
    const userId = getUserIdFromAccessCookie(req);
    if (!userId) return res.status(401).json({ ok: false, error: "not_authenticated" });

    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const relationship = String(req.body?.relationship || "").trim();
    const fileIds = Array.isArray(req.body?.assignedFiles) ? req.body.assignedFiles : [];

    if (!name) return res.status(400).json({ ok: false, error: "missing_name" });
    if (!validateEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });

    for (const f of fileIds) {
      const s = String(f || "");
      if (!s || s.length > 512) return res.status(400).json({ ok: false, error: "invalid_file_id" });
    }

    const conn = await pool.getConnection();
    let contactId = 0;
    let verifyCode = "";
    let verifyUrl = "";
    let ownerEmail = "";

    try {
      await conn.beginTransaction();

      const [urows] = await conn.query("SELECT email FROM users WHERE id = ? LIMIT 1", [userId]);
      ownerEmail = urows?.[0]?.email ? String(urows[0].email) : "your account";

      const [result] = await conn.query(
        "INSERT INTO emergency_contacts (user_id, name, email, relationship) VALUES (?, ?, ?, ?)",
        [userId, name, email, relationship || null]
      );

      contactId = result.insertId;

      await conn.query("DELETE FROM emergency_contact_file_assignments WHERE contact_id = ?", [contactId]);
      if (fileIds.length > 0) {
        const values = fileIds.map((fid) => [contactId, String(fid)]);
        await conn.query(
          "INSERT INTO emergency_contact_file_assignments (contact_id, file_id) VALUES ?",
          [values]
        );
      }

      verifyCode = await createEmergencyContactVerificationCode(conn, contactId);
      verifyUrl = `${publicApiBaseUrl}/auth/emergency-contacts/verify?token=${encodeURIComponent(verifyCode)}`;

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
        return res.status(409).json({ ok: false, error: "contact_exists" });
      }
      throw e;
    } finally {
      conn.release();
    }

    let emailSent = false;
    try {
      const out = await sendEmergencyContactInviteEmail(email, name, ownerEmail, verifyUrl);
      emailSent = !!out?.ok;
    } catch (e) {
      logError("emergency-contacts:send-invite", e);
      emailSent = false;
    }

    return res.status(201).json({
      ok: true,
      contact: {
        id: String(contactId),
        name,
        email,
        relationship: relationship || "",
        verified: false,
        assignedFiles: fileIds.map((x) => String(x)),
        addedAt: new Date().toISOString()
      },
      email_sent: emailSent,
      verify_code_dev_only: verifyCode,
      verify_url_dev_only: verifyUrl
    });
  } catch (e) {
    logError("emergency-contacts:create", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.patch("/emergency-contacts/:id", async (req, res) => {
  try {
    const userId = getUserIdFromAccessCookie(req);
    if (!userId) return res.status(401).json({ ok: false, error: "not_authenticated" });

    const contactId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(contactId)) return res.status(400).json({ ok: false, error: "invalid_contact_id" });

    const name = String(req.body?.name || "").trim();
    const emailRaw = req.body?.email;
    const relationship = String(req.body?.relationship || "").trim();

    if (!name) return res.status(400).json({ ok: false, error: "missing_name" });
    const email = emailRaw !== undefined ? normalizeEmail(emailRaw) : null;
    if (email !== null && !validateEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });

    try {
      const [result] = await pool.query(
        "UPDATE emergency_contacts SET name = ?, email = COALESCE(?, email), relationship = ? WHERE id = ? AND user_id = ? LIMIT 1",
        [name, email, relationship || null, contactId, userId]
      );

      if (!result.affectedRows) return res.status(404).json({ ok: false, error: "not_found" });

      return res.json({ ok: true });
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
        return res.status(409).json({ ok: false, error: "contact_exists" });
      }
      throw e;
    }
  } catch (e) {
    logError("emergency-contacts:edit", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.delete("/emergency-contacts/:id", async (req, res) => {
  try {
    const userId = getUserIdFromAccessCookie(req);
    if (!userId) return res.status(401).json({ ok: false, error: "not_authenticated" });

    const contactId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(contactId)) return res.status(400).json({ ok: false, error: "invalid_contact_id" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        "SELECT id FROM emergency_contacts WHERE id = ? AND user_id = ? LIMIT 1",
        [contactId, userId]
      );
      if (!rows[0]) {
        await conn.rollback();
        return res.status(404).json({ ok: false, error: "not_found" });
      }

      await conn.query("DELETE FROM emergency_contact_file_assignments WHERE contact_id = ?", [contactId]);
      await conn.query("DELETE FROM emergency_contact_verification_tokens WHERE contact_id = ?", [contactId]);
      await conn.query("DELETE FROM emergency_contacts WHERE id = ? AND user_id = ? LIMIT 1", [contactId, userId]);

      await conn.commit();
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    logError("emergency-contacts:delete", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.put("/emergency-contacts/:id/files", async (req, res) => {
  try {
    const userId = getUserIdFromAccessCookie(req);
    if (!userId) return res.status(401).json({ ok: false, error: "not_authenticated" });

    const contactId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(contactId)) return res.status(400).json({ ok: false, error: "invalid_contact_id" });

    const fileIds = Array.isArray(req.body?.fileIds) ? req.body.fileIds : [];
    for (const f of fileIds) {
      const s = String(f || "");
      if (!s || s.length > 512) return res.status(400).json({ ok: false, error: "invalid_file_id" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        "SELECT id FROM emergency_contacts WHERE id = ? AND user_id = ? LIMIT 1",
        [contactId, userId]
      );
      if (!rows[0]) {
        await conn.rollback();
        return res.status(404).json({ ok: false, error: "not_found" });
      }

      await conn.query("DELETE FROM emergency_contact_file_assignments WHERE contact_id = ?", [contactId]);

      if (fileIds.length > 0) {
        const values = fileIds.map((fid) => [contactId, String(fid)]);
        await conn.query(
          "INSERT INTO emergency_contact_file_assignments (contact_id, file_id) VALUES ?",
          [values]
        );
      }

      await conn.commit();
      return res.json({ ok: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    logError("emergency-contacts:files", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/emergency-contacts/:id/resend", async (req, res) => {
  try {
    const userId = getUserIdFromAccessCookie(req);
    if (!userId) return res.status(401).json({ ok: false, error: "not_authenticated" });

    const contactId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(contactId)) return res.status(400).json({ ok: false, error: "invalid_contact_id" });

    const conn = await pool.getConnection();
    let contactEmail = "";
    let ownerEmail = "";
    let verifyCode = "";
    let verifyUrl = "";

    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        "SELECT email, verified_at FROM emergency_contacts WHERE id = ? AND user_id = ? LIMIT 1",
        [contactId, userId]
      );
      if (!rows[0]) {
        await conn.rollback();
        return res.status(404).json({ ok: false, error: "not_found" });
      }

      if (rows[0].verified_at) {
        await conn.commit();
        return res.json({ ok: true, email_sent: true });
      }

      contactEmail = String(rows[0].email);

      const [urows] = await conn.query("SELECT email FROM users WHERE id = ? LIMIT 1", [userId]);
      ownerEmail = urows?.[0]?.email ? String(urows[0].email) : "your account";

      verifyCode = await createEmergencyContactVerificationCode(conn, contactId);
      verifyUrl = `${publicApiBaseUrl}/auth/emergency-contacts/verify?token=${encodeURIComponent(verifyCode)}`;

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }

    let emailSent = false;
    try {
      const out = await sendEmergencyContactInviteEmail(contactEmail, "", ownerEmail, verifyUrl);
      emailSent = !!out?.ok;
    } catch (e) {
      logError("emergency-contacts:resend-email", e);
      emailSent = false;
    }

    return res.json({
      ok: true,
      email_sent: emailSent,
      verify_code_dev_only: verifyCode,
      verify_url_dev_only: verifyUrl
    });
  } catch (e) {
    logError("emergency-contacts:resend", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/emergency-contacts/verify", async (req, res) => {
  try {
    const token = String(req.query?.token || "");
    const accept = String(req.headers?.accept || "");
    const wantsHtml = accept.includes("text/html");

    if (!token || !isSixDigitCode(token)) {
      if (wantsHtml) {
        const html = renderEmergencyContactVerifyHtml({ ok: false, reason: "invalid_code" });
        return res.status(400).set("Content-Type", "text/html; charset=utf-8").send(html);
      }
      return res.status(400).json({ ok: false, error: "invalid_code" });
    }

    const conn = await pool.getConnection();
    let out = null;

    try {
      await conn.beginTransaction();

      out = await consumeEmergencyContactVerificationByToken(conn, token);
      if (!out.ok) {
        await conn.rollback();
      } else {
        await conn.commit();
      }
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      conn.release();
    }

    if (!out.ok) {
      if (wantsHtml) {
        const ctx = await getEmergencyContactContext(out.contactId);
        const html = renderEmergencyContactVerifyHtml({
          ok: false,
          reason: out.reason,
          ownerEmail: ctx?.owner_email || "",
          contactName: ctx?.contact_name || ""
        });
        return res.status(400).set("Content-Type", "text/html; charset=utf-8").send(html);
      }
      return res.status(400).json({ ok: false, error: out.reason });
    }

    if (wantsHtml) {
      const ctx = await getEmergencyContactContext(out.contactId);
      const html = renderEmergencyContactVerifyHtml({
        ok: true,
        ownerEmail: ctx?.owner_email || "",
        contactName: ctx?.contact_name || ""
      });
      return res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    }

    return res.json({ ok: true });
  } catch (e) {
    logError("emergency-contacts:verify", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

function daysForFrequency(freq) {
  if (freq === "daily") return 1;
  if (freq === "weekly") return 7;
  return 30;
}

function isValidFrequency(freq) {
  return freq === "daily" || freq === "weekly" || freq === "monthly";
}

function isValidGraceHours(n) {
  return Number.isInteger(n) && n >= 6 && n <= 72 && n % 6 === 0;
}

function isValidReminders(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

function requireUserId(req, res) {
  const userId = getUserIdFromAccessCookie(req);
  if (!userId) {
    res.status(401).json({ ok: false, error: "not_authenticated" });
    return null;
  }
  return userId;
}

const publicWebBaseUrl = PUBLIC_WEB_BASE_URL || "http://localhost:8080";

router.post("/password-reset/request", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validateEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });

    const user = await getUserByEmail(email);

    if (!user || user.status !== "active" || !user.email_verified_at) {
      return res.json({ ok: true, email_sent: true });
    }

    const conn = await pool.getConnection();
    let rawToken = "";
    let resetUrl = "";
    try {
      await conn.beginTransaction();

      rawToken = await createPasswordResetToken(conn, user.id);
      resetUrl = `${publicWebBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }

    let emailSent = false;
    try {
      const out = await sendPasswordResetEmail(email, resetUrl);
      emailSent = !!out?.ok;
    } catch (e) {
      logError("sendPasswordResetEmail(request)", e);
      emailSent = false;
    }

    return res.json({
      ok: true,
      email_sent: emailSent,
      reset_token_dev_only: rawToken,
      reset_url_dev_only: resetUrl
    });
  } catch (e) {
    logError("password-reset:request", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/password-reset/confirm", async (req, res) => {
  try {
    const token = String(req.body?.token || "");
    const newPassword = String(req.body?.password || "");

    if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    if (newPassword.length < 10) {
      return res.status(400).json({ ok: false, error: "weak_password" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const out = await consumePasswordResetToken(conn, token, newPassword);
      if (!out.ok) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: out.reason });
      }

      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }

    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch (e) {
    logError("password-reset:confirm", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

function addHours(d, hours) {
  const x = new Date(d.getTime());
  x.setUTCHours(x.getUTCHours() + hours);
  return x;
}

function genResetToken() {
  return crypto.randomBytes(48).toString("base64url");
}

async function createPasswordResetToken(conn, userId) {
  await conn.query(
    "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
    [userId]
  );

  const expiresAt = addHours(nowUtc(), 2);

  for (let i = 0; i < 10; i++) {
    const raw = genResetToken();
    const tokenHash = sha256Hex(raw);

    try {
      await conn.query(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        [userId, tokenHash, expiresAt]
      );
      return raw;
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) continue;
      throw e;
    }
  }

  throw new Error("Failed to generate unique password reset token");
}

async function consumePasswordResetToken(conn, rawToken, newPassword) {
  const tokenHash = sha256Hex(rawToken);

  const [rows] = await conn.query(
    "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1",
    [tokenHash]
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid_token" };
  if (row.used_at) return { ok: false, reason: "already_used" };
  if (new Date(row.expires_at).getTime() < nowUtc().getTime()) return { ok: false, reason: "expired" };

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await conn.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [row.id]);
  await conn.query("UPDATE users SET password_hash = ? WHERE id = ? LIMIT 1", [passwordHash, row.user_id]);
  await conn.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", [row.user_id]);

  return { ok: true, userId: row.user_id };
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  const transporter = getMailer();
  const from = EMAIL_FROM || `UnderAnyCircumstance <${SMTP_USER || "no-reply@localhost"}>`;

  if (!transporter) {
    console.error("[MAILER] Missing SMTP env vars; skipping password reset email.");
    return { ok: false, skipped: true };
  }

  const subject = "Reset your UnderAnyCircumstance password";
  const text =
    `Reset your password by opening this link:\n\n` +
    `${resetUrl}\n\n` +
    `If you did not request this, you can ignore this email.\n`;

  const html =
    `<p>Reset your password by opening this link:</p>` +
    `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
    `<p>If you did not request this, you can ignore this email.</p>`;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text,
    html
  });

  return { ok: true };
}

async function getVerificationSettingsRow(userId) {
  const [rows] = await pool.query(
    "SELECT user_id, frequency, grace_period_hours, reminders, last_checkin_at, next_due_at FROM verification_settings WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return rows[0] || null;
}

function settingsDto(row) {
  return {
    frequency: row.frequency,
    gracePeriodHours: Number(row.grace_period_hours),
    reminders: Number(row.reminders),
    lastCheckinAt: row.last_checkin_at ? new Date(row.last_checkin_at).toISOString() : null,
    nextDueAt: row.next_due_at ? new Date(row.next_due_at).toISOString() : null
  };
}

router.get("/verification-settings", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const row = await getVerificationSettingsRow(userId);
    if (!row) {
      return res.json({
        ok: true,
        settings: {
          frequency: "weekly",
          gracePeriodHours: 24,
          reminders: 3,
          lastCheckinAt: null,
          nextDueAt: null
        }
      });
    }

    return res.json({ ok: true, settings: settingsDto(row) });
  } catch (e) {
    logError("verification-settings:get", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.put("/verification-settings", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const frequency = String(req.body?.frequency || "");
    const gracePeriodHours = Number(req.body?.gracePeriodHours);
    const reminders = Number(req.body?.reminders);

    if (!isValidFrequency(frequency)) return res.status(400).json({ ok: false, error: "invalid_frequency" });
    if (!isValidGraceHours(gracePeriodHours)) return res.status(400).json({ ok: false, error: "invalid_grace_period" });
    if (!isValidReminders(reminders)) return res.status(400).json({ ok: false, error: "invalid_reminders" });

    const days = daysForFrequency(frequency);
    const existing = await getVerificationSettingsRow(userId);

    const last = existing?.last_checkin_at ? new Date(existing.last_checkin_at) : nowUtc();
    const nextDue = addDays(last, days);

    await pool.query(
      "INSERT INTO verification_settings (user_id, frequency, grace_period_hours, reminders, last_checkin_at, next_due_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE frequency = VALUES(frequency), grace_period_hours = VALUES(grace_period_hours), reminders = VALUES(reminders), last_checkin_at = COALESCE(verification_settings.last_checkin_at, VALUES(last_checkin_at)), next_due_at = VALUES(next_due_at)",
      [userId, frequency, gracePeriodHours, reminders, last, nextDue]
    );

    const saved = await getVerificationSettingsRow(userId);
    return res.json({ ok: true, settings: saved ? settingsDto(saved) : null });
  } catch (e) {
    logError("verification-settings:put", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/verification-check-in", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const pin = String(req.body?.pin || "");
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ ok: false, error: "invalid_pin" });

    const [urows] = await pool.query("SELECT pin_hash FROM users WHERE id = ? LIMIT 1", [userId]);
    const pinHash = urows?.[0]?.pin_hash ? String(urows[0].pin_hash) : "";

    if (!pinHash) return res.status(400).json({ ok: false, error: "pin_not_set" });

    const ok = await bcrypt.compare(pin, pinHash);
    if (!ok) return res.status(401).json({ ok: false, error: "invalid_pin" });

    const row = await getVerificationSettingsRow(userId);

    const frequency = row?.frequency || "weekly";
    const gracePeriodHours = row ? Number(row.grace_period_hours) : 24;
    const reminders = row ? Number(row.reminders) : 3;

    const now = nowUtc();
    const nextDue = addDays(now, daysForFrequency(frequency));

    await pool.query("INSERT INTO verification_checkins (user_id, method) VALUES (?, 'manual')", [userId]);

    await pool.query(
      "INSERT INTO verification_settings (user_id, frequency, grace_period_hours, reminders, last_checkin_at, next_due_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_checkin_at = VALUES(last_checkin_at), next_due_at = VALUES(next_due_at)",
      [userId, frequency, gracePeriodHours, reminders, now, nextDue]
    );

    const saved = await getVerificationSettingsRow(userId);
    return res.json({ ok: true, settings: saved ? settingsDto(saved) : null });
  } catch (e) {
    logError("verification-check-in:post", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/verification-checkins", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    let limit = Number(req.query?.limit);
    if (!Number.isFinite(limit)) limit = 50;
    limit = Math.max(1, Math.min(200, Math.floor(limit)));

    const [rows] = await pool.query(
      "SELECT id, checked_in_at, method FROM verification_checkins WHERE user_id = ? ORDER BY checked_in_at DESC LIMIT ?",
      [userId, limit]
    );

    return res.json({
      ok: true,
      checkins: rows.map((r) => ({
        id: String(r.id),
        checkedInAt: new Date(r.checked_in_at).toISOString(),
        method: r.method === "email_link" ? "email_link" : "manual"
      }))
    });
  } catch (e) {
    logError("verification-checkins:get", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/verification-status", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const row = await getVerificationSettingsRow(userId);
    if (!row || !row.next_due_at) {
      return res.json({
        ok: true,
        status: {
          state: "not_configured",
          nextDueAt: null,
          graceEndsAt: null
        }
      });
    }

    const nextDueAt = new Date(row.next_due_at);
    const graceEndsAt = new Date(nextDueAt.getTime() + Number(row.grace_period_hours) * 60 * 60 * 1000);
    const now = nowUtc();

    let state = "ok";
    if (now.getTime() > graceEndsAt.getTime()) state = "expired";
    else if (now.getTime() > nextDueAt.getTime()) state = "overdue";

    return res.json({
      ok: true,
      status: {
        state,
        nextDueAt: nextDueAt.toISOString(),
        graceEndsAt: graceEndsAt.toISOString()
      }
    });
  } catch (e) {
    logError("verification-status:get", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

const BILLING_PLANS = {
  starter: { id: "starter", name: "Starter", priceMonthlyUsd: 4.99, storageLimitMb: 5000, overageRateUsdPerGb: 0.75 },
  plus: { id: "plus", name: "Plus", priceMonthlyUsd: 12.99, storageLimitMb: 20000, overageRateUsdPerGb: 0.65 },
  commercial: { id: "commercial", name: "Commercial", priceMonthlyUsd: 75, storageLimitMb: 200000, overageRateUsdPerGb: 0.4 }
};

function isPlanId(x) {
  return x === "starter" || x === "plus" || x === "commercial";
}

async function getOrCreateSubscription(userId) {
  const [rows] = await pool.query(
    "SELECT user_id, plan_id, status FROM billing_subscriptions WHERE user_id = ? LIMIT 1",
    [userId]
  );

  if (rows[0]) {
    return {
      userId: String(rows[0].user_id),
      planId: String(rows[0].plan_id),
      status: String(rows[0].status)
    };
  }

  await pool.query(
    "INSERT INTO billing_subscriptions (user_id, plan_id, status) VALUES (?, 'starter', 'active')",
    [userId]
  );

  return { userId: String(userId), planId: "starter", status: "active" };
}

async function listInvoices(userId, limit) {
  const lim = Number.isFinite(limit) ? Math.max(1, Math.min(200, Number(limit))) : 50;

  const [rows] = await pool.query(
    "SELECT id, invoice_date, description, amount_cents, status, invoice_url FROM billing_invoices WHERE user_id = ? ORDER BY invoice_date DESC LIMIT ?",
    [userId, lim]
  );

  return rows.map((r) => ({
    id: String(r.id),
    date: new Date(r.invoice_date).toISOString(),
    description: String(r.description),
    amount: Number(r.amount_cents) / 100,
    status: String(r.status),
    invoiceUrl: r.invoice_url ? String(r.invoice_url) : null
  }));
}

router.get("/billing/summary", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const sub = await getOrCreateSubscription(userId);
    const plan = BILLING_PLANS[sub.planId] || BILLING_PLANS.starter;
    const invoices = await listInvoices(userId, Number(req.query?.limit));

    return res.json({
      ok: true,
      subscription: sub,
      plan,
      invoices
    });
  } catch (e) {
    logError("billing:summary", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/billing/choose-plan", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const planId = String(req.body?.planId || "");
    if (!isPlanId(planId)) return res.status(400).json({ ok: false, error: "invalid_plan" });

    await pool.query(
      "INSERT INTO billing_subscriptions (user_id, plan_id, status) VALUES (?, ?, 'active') ON DUPLICATE KEY UPDATE plan_id = VALUES(plan_id), status = 'active'",
      [userId, planId]
    );

    const sub = await getOrCreateSubscription(userId);
    const plan = BILLING_PLANS[sub.planId] || BILLING_PLANS.starter;
    const invoices = await listInvoices(userId, Number(req.query?.limit));

    return res.json({
      ok: true,
      subscription: sub,
      plan,
      invoices
    });
  } catch (e) {
    logError("billing:choose-plan", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/billing/invoices", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const invoices = await listInvoices(userId, Number(req.query?.limit));
    return res.json({ ok: true, invoices });
  } catch (e) {
    logError("billing:invoices", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});


module.exports = { authRouter: router, authPool: pool };