
// dispatch_emergency.js
const { initializeEnvironment } = require("./environment");

initializeEnvironment();

const crypto = require("crypto");
const fs = require("fs");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");
const { emailSender, renderAnyCircumstancesEmail, renderEmergencyEmail } = require("./emails");
const { sendPushToUser } = require("./push_notifications");

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function shareExpiresAt() {
  const requested = Number(process.env.SHARE_LINK_TTL_DAYS || 30);
  const days = Number.isInteger(requested) ? Math.max(1, Math.min(requested, 90)) : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function publicAppBase() {
  return String(
    process.env.PUBLIC_APP_BASE_URL ||
      process.env.PUBLIC_WEB_BASE_URL ||
      "https://anycircumstances.com"
  ).replace(/\/+$/, "");
}

function clampInt(n, lo, hi, defv) {
  const x = Number(n);
  if (!Number.isFinite(x)) return defv;
  return Math.max(lo, Math.min(hi, Math.floor(x)));
}

async function sendGraceReminders(conn, mail) {
  const [rows] = await conn.query(`
    SELECT
      vs.user_id,
      vs.next_due_at,
      COALESCE(vs.grace_period_hours, 24) AS grace_hours,
      COALESCE(vs.reminders, 3) AS reminders,
      u.email AS owner_email
    FROM verification_settings vs
    JOIN users u ON u.id = vs.user_id
    WHERE vs.next_due_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM billing_entitlements be
        WHERE be.user_id = vs.user_id AND be.status = 'active'
          AND (be.current_period_end IS NULL OR be.current_period_end > UTC_TIMESTAMP(3))
      )
      AND NOW() > vs.next_due_at
      AND NOW() <= DATE_ADD(vs.next_due_at, INTERVAL COALESCE(vs.grace_period_hours, 24) HOUR)
      AND u.email IS NOT NULL
      AND u.email <> ''
  `);

  console.log("[dispatcher] grace_users:", rows.length);

  for (const r of rows) {
    const userId = Number(r.user_id);
    const dueAt = new Date(r.next_due_at);
    const graceHours = clampInt(r.grace_hours, 6, 72, 24);
    const reminders = clampInt(r.reminders, 1, 5, 3);
    const ownerEmail = String(r.owner_email || "").trim();
    if (!ownerEmail) continue;

    
const graceMs = graceHours * 60 * 60 * 1000;
const stepMs = Math.max(1, Math.floor(graceMs / reminders));
    const now = Date.now();

    for (let idx = 1; idx <= reminders; idx++) {
      const scheduledAt = idx === 1 ? dueAt.getTime() : (dueAt.getTime() + stepMs * (idx - 1));
      if (now < scheduledAt) break;

      const [ins] = await conn.query(
        "INSERT IGNORE INTO verification_reminder_emails (user_id, due_at, reminder_index) VALUES (?, ?, ?)",
        [userId, dueAt, idx]
      );
      if (!ins || !ins.affectedRows) continue;

      const subject = "AnyCircumstances: Reminder — check-in required";
      const link = publicAppBase() + "/app/check-in";
      const rendered = renderAnyCircumstancesEmail({
        title: "Your check-in is overdue",
        preview: "Check in before your grace period ends.",
        bodyText: "Your check-in is overdue but still within the grace period. Sign in and check in to confirm you are safe.",
        ctaText: "Check in", ctaUrl: link,
        info: { title: "Before your grace period ends", text: "If you do not check in, your emergency contacts may receive access to the information assigned to them." },
        securityNotice: "Sign in to AnyCircumstances to review your check-in schedule."
      });

      try {
        await mail.transporter.sendMail({ from: mail.from, to: ownerEmail, subject, ...rendered });
        console.log("[dispatcher] reminder sent user_id=", userId, "idx=", idx);

        try {
          await sendPushToUser(conn, userId, {
            title: "Check-in reminder",
            body: "Your check-in is overdue but still within the grace period.",
            data: {
              type: "verification_reminder",
              route: "/app/check-in"
            }
          });
        } catch (pushError) {
          console.log(
            "[dispatcher] reminder push failed user_id=",
            userId,
            "idx=",
            idx,
            "msg=",
            String((pushError && pushError.message) || pushError || "").slice(0, 200)
          );
        }
      } catch (e) {
        const code = (e && (e.code || e.responseCode)) || "send_failed";
        const msg = (e && (e.response || e.message)) || "";
        await conn.query(
          "DELETE FROM verification_reminder_emails WHERE user_id = ? AND due_at = ? AND reminder_index = ?",
          [userId, dueAt, idx]
        ).catch(() => null);
        console.log("[dispatcher] reminder failed user_id=", userId, "idx=", idx, "code=", code, "msg=", String(msg).slice(0, 200));
      }

      break;
    }
  }
}



function mailTransport() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  const from = emailSender();

  if (!host || !port || !user || !pass || !from) return { ok: false };

  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  })

  transporter.verify().then(() => console.log("[dispatcher] smtp verify ok")).catch((e) => console.log("[dispatcher] smtp verify fail", e && (e.code || e.responseCode), String((e && (e.response || e.message)) || "").slice(0, 120)));
;

  return { ok: true, transporter, from };
}

function buildDbPool() {
  const {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
    DB_SSL_CA
  } = process.env;

  const host = String(DB_HOST || "").trim();
  const user = String(DB_USER || "").trim();
  const database = String(DB_NAME || "").trim();

  if (!host || !user || !database) {
    console.error("Missing DB env vars (DB_HOST/DB_USER/DB_NAME).");
    process.exit(1);
  }

  const cfg = {
    connectTimeout: 10000,
    host,
    port: DB_PORT ? Number(DB_PORT) : 3306,
    user,
    password: DB_PASSWORD || "",
    database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  };

  const sslCaPath = String(DB_SSL_CA || "").trim();
  if (sslCaPath) {
    cfg.ssl = { ca: fs.readFileSync(sslCaPath) };
  } else if (host.includes("rds.amazonaws.com")) {
    cfg.ssl = { ca: fs.readFileSync("/etc/ssl/certs/rds-global-bundle.pem") };
  }

  return mysql.createPool(cfg);
}

async function claimScheduledDispatch(pool, userId, dueAt) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [settings] = await conn.query(
      `SELECT vs.next_due_at, vs.grace_period_hours,
              (UTC_TIMESTAMP(3) > DATE_ADD(vs.next_due_at, INTERVAL vs.grace_period_hours HOUR)) AS still_overdue,
              EXISTS(
                SELECT 1 FROM billing_entitlements be
                WHERE be.user_id = vs.user_id AND be.status = 'active'
                  AND (be.current_period_end IS NULL OR be.current_period_end > UTC_TIMESTAMP(3))
              ) AS has_active
       FROM verification_settings vs
       WHERE vs.user_id = ? FOR UPDATE`,
      [userId]
    );
    const current = settings?.[0];
    if (!current || !current.still_overdue || !current.has_active ||
        new Date(current.next_due_at).getTime() !== new Date(dueAt).getTime()) {
      await conn.rollback();
      return false;
    }

    await conn.query(
      "INSERT IGNORE INTO verification_emergency_dispatches (user_id, due_at) VALUES (?, ?)",
      [userId, dueAt]
    );

    const [contacts] = await conn.query(
      "SELECT id, email, name FROM emergency_contacts WHERE user_id = ? AND verified_at IS NOT NULL",
      [userId]
    );
    const [assignments] = await conn.query(
      `SELECT a.contact_id, a.file_id
       FROM emergency_contact_file_assignments a
       JOIN emergency_contacts ec ON ec.id = a.contact_id
       JOIN files f ON f.id = a.file_id
       WHERE ec.user_id = ? AND f.user_id = ec.user_id`,
      [userId]
    );
    const filesByContact = new Map();
    for (const row of assignments || []) {
      const contactId = Number(row.contact_id);
      const list = filesByContact.get(contactId) || [];
      list.push(String(row.file_id));
      filesByContact.set(contactId, list);
    }

    for (const contact of contacts || []) {
      const contactId = Number(contact.id);
      const fileIds = filesByContact.get(contactId) || [];
      if (!fileIds.length) continue;
      await conn.query(
        `INSERT IGNORE INTO emergency_delivery_attempts
          (user_id, due_at, contact_id, recipient_email, recipient_name, file_ids_json, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [
          userId,
          dueAt,
          contactId,
          String(contact.email),
          String(contact.name || ""),
          JSON.stringify(fileIds),
        ]
      );
    }

    await conn.commit();
    return true;
  } catch (error) {
    try { await conn.rollback(); } catch {}
    throw error;
  } finally {
    conn.release();
  }
}

async function deliverScheduledAttempts(pool, mail, userId, dueAt) {
  const [jobs] = await pool.query(
    `SELECT id, contact_id, recipient_email, recipient_name, file_ids_json, attempt_count
     FROM emergency_delivery_attempts
     WHERE user_id = ? AND due_at = ? AND status <> 'delivered'
     ORDER BY id`,
    [userId, dueAt]
  );
  if (!jobs.length) return;

  const [ownerRows] = await pool.query("SELECT email FROM users WHERE id = ? LIMIT 1", [userId]);
  const ownerEmail = String(ownerRows?.[0]?.email || "");

  for (const job of jobs) {
    const rawIds = typeof job.file_ids_json === "string" ? JSON.parse(job.file_ids_json) : job.file_ids_json;
    const fileIds = Array.isArray(rawIds) ? rawIds.map(String) : [];
    if (!fileIds.length) {
      await pool.query(
        "UPDATE emergency_delivery_attempts SET status = 'failed_permanent', last_error = 'no_files', attempt_count = attempt_count + 1 WHERE id = ?",
        [job.id]
      );
      continue;
    }

    const placeholders = fileIds.map(() => "?").join(",");
    const [validFiles] = await pool.query(
      `SELECT f.id
       FROM files f
       JOIN emergency_contacts ec ON ec.id = ? AND ec.user_id = f.user_id
       WHERE f.id IN (${placeholders}) AND f.user_id = ?`,
      [job.contact_id, ...fileIds, userId]
    );
    const validIds = (validFiles || []).map((row) => String(row.id));
    if (!validIds.length) {
      await pool.query(
        "UPDATE emergency_delivery_attempts SET status = 'failed_permanent', last_error = 'files_or_contact_removed', attempt_count = attempt_count + 1 WHERE id = ?",
        [job.id]
      );
      continue;
    }

    const tx = await pool.getConnection();
    const links = [];
    const tokenHashes = [];
    try {
      await tx.beginTransaction();
      for (const fileId of validIds) {
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = sha256Hex(token);
        await tx.query(
          "INSERT INTO contact_file_share_tokens (contact_id, file_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
          [job.contact_id, fileId, tokenHash, shareExpiresAt()]
        );
        tokenHashes.push(tokenHash);
        links.push(publicAppBase() + "/share#token=" + encodeURIComponent(token));
      }
      await tx.query(
        "UPDATE emergency_delivery_attempts SET status = 'sending', attempt_count = attempt_count + 1, last_error = NULL WHERE id = ?",
        [job.id]
      );
      await tx.commit();
    } catch (error) {
      try { await tx.rollback(); } catch {}
      tx.release();
      throw error;
    }
    tx.release();

    const rendered = renderEmergencyEmail({
      name: String(job.recipient_name || ""),
      ownerEmail,
      links,
      scheduled: true,
    });
    try {
      await mail.transporter.sendMail({
        from: mail.from,
        to: String(job.recipient_email),
        subject: "AnyCircumstances: Emergency access link",
        ...rendered,
      });
      await pool.query(
        "UPDATE emergency_delivery_attempts SET status = 'delivered', delivered_at = UTC_TIMESTAMP(3), last_error = NULL WHERE id = ?",
        [job.id]
      );
      console.log("[dispatcher] delivered scheduled emergency job_id=", job.id, "files=", validIds.length);
    } catch (error) {
      if (tokenHashes.length) {
        const marks = tokenHashes.map(() => "?").join(",");
        await pool.query(
          `DELETE FROM contact_file_share_tokens WHERE token_hash IN (${marks})`,
          tokenHashes
        ).catch(() => null);
      }
      const msg = String((error && (error.response || error.message)) || "send_failed").slice(0, 240);
      await pool.query(
        "UPDATE emergency_delivery_attempts SET status = 'retry', last_error = ? WHERE id = ?",
        [msg, job.id]
      );
      console.log("[dispatcher] scheduled emergency retry job_id=", job.id, "msg=", msg);
    }
  }
}

async function main() {
  const pool = buildDbPool();

  const mail = mailTransport();
  if (!mail.ok) {
    console.error("Missing SMTP env vars; cannot email. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS and MAIL_FROM/EMAIL_FROM.");
    process.exit(1);
  }

  const conn = await pool.getConnection();
  try {
    await sendGraceReminders(conn, mail);

    const [overdue] = await conn.query(
      `SELECT vs.user_id, vs.next_due_at
       FROM verification_settings vs
       WHERE vs.next_due_at IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM billing_entitlements be
           WHERE be.user_id = vs.user_id AND be.status = 'active'
             AND (be.current_period_end IS NULL OR be.current_period_end > UTC_TIMESTAMP(3))
         )
         AND UTC_TIMESTAMP(3) > DATE_ADD(vs.next_due_at, INTERVAL vs.grace_period_hours HOUR)`
    );
    console.log("[dispatcher] overdue_users:", overdue.length);
    for (const row of overdue) {
      const userId = Number(row.user_id);
      const dueAt = row.next_due_at;
      const claimed = await claimScheduledDispatch(pool, userId, dueAt);
      if (claimed) await deliverScheduledAttempts(pool, mail, userId, dueAt);
    }

    // Retry previously claimed deliveries even if the user subsequently checks in.
    // The lock/claim above defines the release ordering; successful check-ins that
    // commit before the claim prevent it, while a claim that commits first is durable.
    const [pending] = await conn.query(
      `SELECT DISTINCT user_id, due_at
       FROM emergency_delivery_attempts
       WHERE status IN ('pending', 'sending', 'retry')
       ORDER BY due_at
       LIMIT 100`
    );
    for (const row of pending) {
      await deliverScheduledAttempts(pool, mail, Number(row.user_id), row.due_at);
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[dispatcher fatal]", e && (e.stack || e));
  process.exit(1);
});
