// dispatch_emergency.js
const { initializeEnvironment } = require("./environment");
initializeEnvironment();

const fs = require("fs");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");
const Stripe = require("stripe");
const { emailSender, renderAnyCircumstancesEmail } = require("./emails");
const { processPendingAccountLifecycleJobs } = require("./account_actions");
const { sendPushToUser } = require("./push_notifications");
const {
  deliverPendingEmergencyDispatches,
  processEmergencyTriggerJobs,
  queueEmergencyDispatch,
} = require("./emergency_delivery");

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

function mailTransport() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "").trim();
  const from = emailSender();

  if (!host || !port || !user || !pass || !from) return { ok: false };
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  return {
    ok: true,
    from,
    transporter: nodemailer.createTransport({ host, port, secure, auth: { user, pass } }),
  };
}

function buildDbPool() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL_CA } = process.env;
  const host = String(DB_HOST || "").trim();
  const user = String(DB_USER || "").trim();
  const database = String(DB_NAME || "").trim();

  if (!host || !user || !database) throw new Error("Missing DB env vars (DB_HOST/DB_USER/DB_NAME).");

  const cfg = {
    connectTimeout: 10000,
    host,
    port: DB_PORT ? Number(DB_PORT) : 3306,
    user,
    password: DB_PASSWORD || "",
    database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  };

  const sslCaPath = String(DB_SSL_CA || "").trim();
  if (sslCaPath) {
    cfg.ssl = { ca: fs.readFileSync(sslCaPath) };
  } else if (host.includes("rds.amazonaws.com")) {
    cfg.ssl = { ca: fs.readFileSync("/etc/ssl/certs/rds-global-bundle.pem") };
  }
  return mysql.createPool(cfg);
}

async function sendGraceReminders(pool, mail) {
  const [rows] = await pool.query(`
    SELECT
      vs.user_id,
      vs.next_due_at,
      COALESCE(vs.grace_period_hours, 24) AS grace_hours,
      COALESCE(vs.reminders, 3) AS reminders,
      u.email AS owner_email
    FROM verification_settings vs
    JOIN users u ON u.id = vs.user_id AND u.status = 'active'
    WHERE vs.next_due_at IS NOT NULL
      AND NOW() > vs.next_due_at
      AND NOW() <= DATE_ADD(vs.next_due_at, INTERVAL COALESCE(vs.grace_period_hours, 24) HOUR)
      AND u.email IS NOT NULL
      AND u.email <> ''
  `);

  for (const row of rows || []) {
    const userId = String(row.user_id);
    const dueAt = new Date(row.next_due_at);
    const graceHours = clampInt(row.grace_hours, 6, 72, 24);
    const reminders = clampInt(row.reminders, 1, 5, 3);
    const ownerEmail = String(row.owner_email || "").trim();
    if (!ownerEmail) continue;

    const graceMs = graceHours * 60 * 60 * 1000;
    const stepMs = Math.max(1, Math.floor(graceMs / reminders));
    const now = Date.now();

    for (let idx = 1; idx <= reminders; idx++) {
      const scheduledAt = idx === 1
        ? dueAt.getTime()
        : dueAt.getTime() + stepMs * (idx - 1);
      if (now < scheduledAt) break;

      await pool.query(
        `INSERT IGNORE INTO verification_reminder_emails
          (user_id, due_at, reminder_index, sent_at, sending_at, attempts, last_error)
         VALUES (?, ?, ?, NULL, NULL, 0, NULL)`,
        [userId, dueAt, idx]
      );

      const [claim] = await pool.query(
        `UPDATE verification_reminder_emails
         SET sending_at = UTC_TIMESTAMP(3), attempts = attempts + 1, last_error = NULL
         WHERE user_id = ? AND due_at = ? AND reminder_index = ?
           AND sent_at IS NULL
           AND attempts < 5
           AND (
             sending_at IS NULL
             OR sending_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE)
           )`,
        [userId, dueAt, idx]
      );
      if (!claim?.affectedRows) continue;

      const rendered = renderAnyCircumstancesEmail({
        title: "Your check-in is overdue",
        preview: "Check in before your grace period ends.",
        bodyText: "Your check-in is overdue but still within the grace period. Sign in and check in to confirm you are safe.",
        ctaText: "Check in",
        ctaUrl: publicAppBase() + "/app/check-in",
        info: {
          title: "Before your grace period ends",
          text: "If you do not check in, your emergency contacts may receive access to the information assigned to them.",
        },
        securityNotice: "Sign in to AnyCircumstances to review your check-in schedule.",
      });

      try {
        await mail.transporter.sendMail({
          from: mail.from,
          to: ownerEmail,
          subject: "AnyCircumstances: Reminder — check-in required",
          ...rendered,
        });
        await pool.query(
          `UPDATE verification_reminder_emails
           SET sent_at = UTC_TIMESTAMP(3), sending_at = NULL, last_error = NULL
           WHERE user_id = ? AND due_at = ? AND reminder_index = ?`,
          [userId, dueAt, idx]
        );

        try {
          const conn = await pool.getConnection();
          try {
            await sendPushToUser(conn, userId, {
              title: "Check-in reminder",
              body: "Your check-in is overdue but still within the grace period.",
              data: { type: "verification_reminder", route: "/app/check-in" },
            });
          } finally {
            conn.release();
          }
        } catch (pushError) {
          console.warn("[dispatcher] reminder push failed", String(pushError?.message || pushError || "").slice(0, 200));
        }
      } catch (error) {
        await pool.query(
          `UPDATE verification_reminder_emails
           SET sending_at = NULL, last_error = ?
           WHERE user_id = ? AND due_at = ? AND reminder_index = ?`,
          [String(error?.message || error || "send_failed").slice(0, 255), userId, dueAt, idx]
        );
      }

      // At most one reminder email per user per dispatcher run.
      break;
    }
  }
}

async function queueNewScheduledEmergencies(pool) {
  const [overdue] = await pool.query(`
    SELECT vs.user_id, vs.next_due_at
    FROM verification_settings vs
    JOIN users u ON u.id = vs.user_id AND u.status = 'active'
    WHERE vs.next_due_at IS NOT NULL
      AND NOW() > DATE_ADD(vs.next_due_at, INTERVAL COALESCE(vs.grace_period_hours, 24) HOUR)
  `);

  for (const row of overdue || []) {
    try {
      await queueEmergencyDispatch(pool, {
        userId: row.user_id,
        dueAt: row.next_due_at,
        reason: "scheduled",
        requireOverdue: true,
      });
    } catch (error) {
      console.error("[dispatcher] queue failed user_id=", row.user_id, String(error?.message || error || "").slice(0, 200));
    }
  }
}

async function main() {
  const pool = buildDbPool();
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  const mail = mailTransport();

  try {
    // Destructive account cleanup must not depend on SMTP health.
    await processPendingAccountLifecycleJobs(pool, stripe, { limit: 20 });

    if (!mail.ok) {
      console.error("[dispatcher] SMTP is not configured; skipping reminders and emergency email delivery.");
      return;
    }

    await sendGraceReminders(pool, mail);

    // Convert durable panic/duress triggers into per-contact release jobs.
    await processEmergencyTriggerJobs(pool, { limit: 100 });

    // Retry previously queued deliveries first. Each contact is independent,
    // so one bad address cannot invalidate links already delivered to others.
    await deliverPendingEmergencyDispatches(pool, { limit: 100 });

    // Candidate selection is intentionally broad. queueEmergencyDispatch locks
    // and re-checks the exact schedule row before creating any release job.
    await queueNewScheduledEmergencies(pool);

    // Deliver newly queued rows and retry any transient failures.
    await deliverPendingEmergencyDispatches(pool, { limit: 100 });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[dispatcher fatal]", error?.stack || error);
  process.exit(1);
});
