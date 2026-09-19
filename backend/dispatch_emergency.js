
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
      `
      SELECT
        vs.user_id,
        vs.next_due_at,
        vs.grace_period_hours
      FROM verification_settings vs
      WHERE
        vs.next_due_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM billing_entitlements be
          WHERE be.user_id = vs.user_id AND be.status = 'active'
            AND (be.current_period_end IS NULL OR be.current_period_end > UTC_TIMESTAMP(3))
        )
        AND NOW() > DATE_ADD(vs.next_due_at, INTERVAL vs.grace_period_hours HOUR)
      `
    );

    console.log("[dispatcher] overdue_users:", overdue.length);

    for (const u of overdue) {
      const userId = Number(u.user_id);
      const dueAt = u.next_due_at;

      const [already] = await conn.query(
        "SELECT 1 FROM verification_emergency_dispatches WHERE user_id = ? AND due_at = ? LIMIT 1",
        [userId, dueAt]
      );
      if (already && already.length) {
        console.log("[dispatcher] skip already dispatched user_id=", userId, "due_at=", dueAt);
        continue;
      }

      const [contacts] = await conn.query(
        "SELECT id, email, name, verified_at, public_key FROM emergency_contacts WHERE user_id = ? AND verified_at IS NOT NULL",
        [userId]
      );
      const [assignments] = await conn.query(
	        `
	        SELECT a.contact_id, a.file_id
	        FROM emergency_contact_file_assignments a
	        JOIN emergency_contacts c ON c.id = a.contact_id
	        JOIN files f ON f.id = a.file_id
	        WHERE c.user_id = ? AND f.user_id = c.user_id
	        `,
	        [userId]
	      );

      if (!contacts.length || !assignments.length) {
        console.log("[dispatcher] no contacts/assignments for user_id=", userId, "contacts=", contacts.length, "assignments=", assignments.length);
        continue;
      }

      const filesByContact = new Map();
      for (const a of assignments) {
        const cid = Number(a.contact_id);
        const arr = filesByContact.get(cid) || [];
        arr.push(String(a.file_id));
        filesByContact.set(cid, arr);
      }

      let emailedContacts = 0;
      let linksCreated = 0;

      for (const c of contacts) {
        const contactId = Number(c.id);
        const email = String(c.email);
        const name = String(c.name || "");
        const list = filesByContact.get(contactId) || [];
        if (!list.length) continue;

        const missingSetup = !c.public_key;

        const links = [];
        for (const fileId of list) {
          const token = crypto.randomBytes(32).toString("hex");
          const tokenHash = sha256Hex(token);

          await conn.query(
        "INSERT INTO contact_file_share_tokens (contact_id, file_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
        [contactId, fileId, tokenHash, shareExpiresAt()]
      );
links.push(publicAppBase() + "/share#token=" + encodeURIComponent(token));
          linksCreated += 1;
        }

        const subject = "AnyCircumstances: Emergency access link";
        const rendered = renderEmergencyEmail({ name, links, missingSetup, scheduled: true });

        try {
          await mail.transporter.sendMail({
            from: mail.from,
            to: email,
            subject,
            ...rendered
          });

          emailedContacts += 1;
          console.log("[dispatcher] emailed contact_id=", contactId, "files=", links.length);
        } catch (e) {
          const code = (e && (e.code || e.responseCode)) || "send_failed";
          const msg = (e && (e.response || e.message)) || "";
          console.log("[dispatcher] email failed contact_id=", contactId, "code=", code, "msg=", String(msg).slice(0, 200));
        }
      }

      if (emailedContacts > 0 && linksCreated > 0) {
        await conn.query(
          "INSERT INTO verification_emergency_dispatches (user_id, due_at) VALUES (?, ?)",
          [userId, dueAt]
        );
        console.log("[dispatcher] marked dispatched user_id=", userId, "due_at=", dueAt, "emailedContacts=", emailedContacts, "linksCreated=", linksCreated);
      } else {
        console.log("[dispatcher] did not dispatch user_id=", userId, "due_at=", dueAt, "emailedContacts=", emailedContacts, "linksCreated=", linksCreated);
      }
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
