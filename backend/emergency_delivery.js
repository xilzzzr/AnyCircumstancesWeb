const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { emailSender, renderEmergencyEmail, emergencyEmailSubject } = require("./emails");

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

let cachedTransporter = null;
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "").trim();
  if (!host || !port || !user || !pass) return null;
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  cachedTransporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return cachedTransporter;
}

function sameInstant(a, b) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

async function insertEmergencyTriggerJob(db, {
  userId,
  reason,
  requestMeta = null,
}) {
  const [result] = await db.query(
    `INSERT INTO emergency_trigger_jobs
      (user_id, reason, request_ip, request_user_agent, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [
      String(userId),
      String(reason || "manual").slice(0, 32),
      requestMeta?.ip ? String(requestMeta.ip).slice(0, 64) : null,
      requestMeta?.userAgent ? String(requestMeta.userAgent).slice(0, 255) : null,
    ]
  );
  return Number(result?.insertId || 0);
}

async function queueEmergencyDispatch(pool, {
  userId,
  dueAt = null,
  reason = "manual",
  requireOverdue = false,
  requestMeta = null,
}) {
  const uid = String(userId);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let dispatchDueAt = dueAt ? new Date(dueAt) : new Date();

    if (requireOverdue) {
      const [settingsRows] = await conn.query(
        `SELECT next_due_at, grace_period_hours
         FROM verification_settings
         WHERE user_id = ?
         LIMIT 1
         FOR UPDATE`,
        [uid]
      );
      const settings = settingsRows?.[0];
      if (!settings?.next_due_at || !sameInstant(settings.next_due_at, dueAt)) {
        await conn.rollback();
        return { ok: true, queued: 0, skipped: "no_longer_due" };
      }
      const graceEndsAt = new Date(settings.next_due_at).getTime() +
        Number(settings.grace_period_hours || 24) * 60 * 60 * 1000;
      if (Date.now() <= graceEndsAt) {
        await conn.rollback();
        return { ok: true, queued: 0, skipped: "within_grace_period" };
      }
      dispatchDueAt = new Date(settings.next_due_at);
    }

    if (requestMeta) {
      await conn.query(
        "INSERT INTO verification_panic_dispatches (user_id, ip, user_agent) VALUES (?, ?, ?)",
        [
          uid,
          String(requestMeta.ip || "").slice(0, 64),
          String(requestMeta.userAgent || "").slice(0, 255),
        ]
      );
    }

    const [contacts] = await conn.query(
      "SELECT id FROM emergency_contacts WHERE user_id = ? AND verified_at IS NOT NULL",
      [uid]
    );
    if (!contacts?.length) {
      await conn.commit();
      return { ok: true, queued: 0, dueAt: dispatchDueAt, skipped: "no_contacts" };
    }

    const [assignments] = await conn.query(
      `SELECT a.contact_id, a.file_id
       FROM emergency_contact_file_assignments a
       JOIN emergency_contacts c ON c.id = a.contact_id
       JOIN files f ON f.id = a.file_id
       WHERE c.user_id = ? AND f.user_id = c.user_id`,
      [uid]
    );

    const byContact = new Map();
    for (const row of assignments || []) {
      const cid = String(row.contact_id);
      const current = byContact.get(cid) || [];
      current.push(String(row.file_id));
      byContact.set(cid, current);
    }

    let queued = 0;
    for (const contact of contacts) {
      const cid = String(contact.id);
      const fileIds = Array.from(new Set(byContact.get(cid) || []));
      if (!fileIds.length) continue;
      const [result] = await conn.query(
        `INSERT IGNORE INTO verification_emergency_contact_dispatches
          (user_id, contact_id, due_at, reason, file_ids_json, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [uid, cid, dispatchDueAt, String(reason).slice(0, 32), JSON.stringify(fileIds)]
      );
      if (result?.affectedRows) queued += 1;
    }

    await conn.commit();
    return { ok: true, queued, dueAt: dispatchDueAt };
  } catch (error) {
    try { await conn.rollback(); } catch {}
    throw error;
  } finally {
    conn.release();
  }
}

async function createShareLinks(pool, contactId, userId, fileIds) {
  if (!fileIds.length) return { links: [], tokenHashes: [] };
  const placeholders = fileIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT id FROM files WHERE user_id = ? AND id IN (${placeholders})`,
    [String(userId), ...fileIds]
  );
  const validIds = new Set((rows || []).map((row) => String(row.id)));
  const links = [];
  const tokenHashes = [];

  for (const fileId of fileIds) {
    if (!validIds.has(String(fileId))) continue;
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    await pool.query(
      "INSERT INTO contact_file_share_tokens (contact_id, file_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      [String(contactId), String(fileId), tokenHash, shareExpiresAt()]
    );
    tokenHashes.push(tokenHash);
    links.push(publicAppBase() + "/share#token=" + encodeURIComponent(token));
  }
  return { links, tokenHashes };
}

async function revokeUnsentShareLinks(pool, contactId, tokenHashes) {
  if (!tokenHashes?.length) return;
  const placeholders = tokenHashes.map(() => "?").join(",");
  await pool.query(
    `DELETE FROM contact_file_share_tokens
     WHERE contact_id = ? AND used_at IS NULL AND token_hash IN (${placeholders})`,
    [String(contactId), ...tokenHashes]
  );
}

async function maybeMarkDispatchComplete(pool, userId, dueAt) {
  const [rows] = await pool.query(
    `SELECT
       SUM(status = 'delivered') AS delivered_count,
       COUNT(*) AS total_count
     FROM verification_emergency_contact_dispatches
     WHERE user_id = ? AND due_at = ?`,
    [String(userId), dueAt]
  );
  const row = rows?.[0];
  if (!row || !Number(row.total_count) || Number(row.delivered_count) !== Number(row.total_count)) return;
  await pool.query(
    "INSERT IGNORE INTO verification_emergency_dispatches (user_id, due_at) VALUES (?, ?)",
    [String(userId), dueAt]
  );
}

async function processEmergencyTriggerJobs(pool, { jobId = null, userId = null, limit = 50 } = {}) {
  const params = [];
  const where = [
    "(status IN ('pending','failed') OR (status='processing' AND updated_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE)))",
    "attempts < 10",
  ];
  if (jobId !== null) {
    where.push("id = ?");
    params.push(Number(jobId));
  }
  if (userId !== null) {
    where.push("user_id = ?");
    params.push(String(userId));
  }
  params.push(Math.max(1, Math.min(200, Number(limit) || 50)));

  const [jobs] = await pool.query(
    `SELECT id, user_id, reason, request_ip, request_user_agent, created_at
     FROM emergency_trigger_jobs
     WHERE ${where.join(" AND ")}
     ORDER BY created_at, id
     LIMIT ?`,
    params
  );

  let completed = 0;
  let failed = 0;
  let queued = 0;

  for (const job of jobs || []) {
    const [claim] = await pool.query(
      `UPDATE emergency_trigger_jobs
       SET status='processing', attempts=attempts+1, last_error=NULL
       WHERE id = ?
         AND attempts < 10
         AND (
           status IN ('pending','failed')
           OR (status='processing' AND updated_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE))
         )`,
      [job.id]
    );
    if (!claim?.affectedRows) continue;

    try {
      const out = await queueEmergencyDispatch(pool, {
        userId: job.user_id,
        dueAt: job.created_at,
        reason: job.reason,
        requireOverdue: false,
        requestMeta: {
          ip: job.request_ip,
          userAgent: job.request_user_agent,
        },
      });
      queued += Number(out?.queued || 0);

      await pool.query(
        "UPDATE emergency_trigger_jobs SET status='completed', last_error=NULL WHERE id = ? AND status='processing'",
        [job.id]
      );
      completed += 1;
    } catch (error) {
      await pool.query(
        `UPDATE emergency_trigger_jobs
         SET status='failed', last_error=?
         WHERE id = ? AND status='processing'`,
        [String(error?.message || error || "trigger_failed").slice(0, 255), job.id]
      );
      failed += 1;
    }
  }

  return { completed, failed, queued };
}

async function deliverPendingEmergencyDispatches(pool, { userId = null, dueAt = null, limit = 50 } = {}) {
  const params = [];
  const where = [
    "(d.status IN ('pending','failed') OR (d.status = 'processing' AND d.updated_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE)))",
    "d.attempts < 5",
  ];
  if (userId !== null) {
    where.push("d.user_id = ?");
    params.push(String(userId));
  }
  if (dueAt !== null) {
    where.push("d.due_at = ?");
    params.push(new Date(dueAt));
  }
  params.push(Math.max(1, Math.min(200, Number(limit) || 50)));

  const [dispatches] = await pool.query(
    `SELECT d.id, d.user_id, d.contact_id, d.due_at, d.reason, d.file_ids_json,
            c.email, c.name, c.public_key, u.email AS owner_email, u.display_name AS owner_name
     FROM verification_emergency_contact_dispatches d
     JOIN users u ON u.id = d.user_id
     JOIN emergency_contacts c
       ON c.id = d.contact_id
      AND c.user_id = d.user_id
      AND c.verified_at IS NOT NULL
     WHERE ${where.join(" AND ")}
     ORDER BY d.created_at, d.id
     LIMIT ?`,
    params
  );

  const transporter = getTransporter();
  const from = emailSender();
  if (!transporter || !from) {
    return { ok: false, error: "mailer_not_configured", delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;

  for (const dispatch of dispatches || []) {
    const [claim] = await pool.query(
      `UPDATE verification_emergency_contact_dispatches
       SET status='processing', attempts=attempts+1, last_error=NULL
       WHERE id = ?
         AND attempts < 5
         AND (
           status IN ('pending','failed')
           OR (status='processing' AND updated_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE))
         )`,
      [dispatch.id]
    );
    if (!claim?.affectedRows) continue;

    let fileIds;
    try {
      fileIds = typeof dispatch.file_ids_json === "string"
        ? JSON.parse(dispatch.file_ids_json)
        : dispatch.file_ids_json;
      if (!Array.isArray(fileIds)) throw new Error("invalid_file_list");
      fileIds = fileIds.map(String).slice(0, 100);
    } catch {
      await pool.query(
        "UPDATE verification_emergency_contact_dispatches SET status='failed', last_error='invalid_file_list' WHERE id = ? AND status='processing'",
        [dispatch.id]
      );
      failed += 1;
      continue;
    }

    let created = { links: [], tokenHashes: [] };
    try {
      created = await createShareLinks(pool, dispatch.contact_id, dispatch.user_id, fileIds);
      if (!created.links.length) throw new Error("no_available_files");

      const rendered = renderEmergencyEmail({
        name: String(dispatch.name || ""),
        ownerName: String(dispatch.owner_name || ""),
        ownerEmail: String(dispatch.owner_email || ""),
        links: created.links,
        scheduled: String(dispatch.reason || "") === "scheduled",
      });

      await transporter.sendMail({
        from,
        to: String(dispatch.email),
        subject: emergencyEmailSubject(dispatch.owner_name, dispatch.owner_email),
        text: rendered.text,
        html: rendered.html,
      });

      await pool.query(
        `UPDATE verification_emergency_contact_dispatches
         SET status='delivered', delivered_at=UTC_TIMESTAMP(3), last_error=NULL
         WHERE id = ? AND status='processing'`,
        [dispatch.id]
      );
      delivered += 1;
      await maybeMarkDispatchComplete(pool, dispatch.user_id, dispatch.due_at);
    } catch (error) {
      await revokeUnsentShareLinks(pool, dispatch.contact_id, created.tokenHashes).catch(() => null);
      await pool.query(
        `UPDATE verification_emergency_contact_dispatches
         SET status='failed', last_error=?
         WHERE id = ? AND status='processing'`,
        [String(error?.message || error || "send_failed").slice(0, 255), dispatch.id]
      );
      failed += 1;
    }
  }

  return { ok: failed === 0, delivered, failed };
}

async function queueAndDeliverEmergency(pool, options) {
  const jobId = await insertEmergencyTriggerJob(pool, {
    userId: options.userId,
    reason: options.reason || "manual",
    requestMeta: options.requestMeta || null,
  });
  if (!jobId) throw new Error("emergency_trigger_job_not_created");

  const trigger = await processEmergencyTriggerJobs(pool, {
    jobId,
    limit: 1,
  });
  const delivery = await deliverPendingEmergencyDispatches(pool, {
    userId: options.userId,
    limit: 50,
  });

  return {
    ok: trigger.failed === 0 && delivery.failed === 0,
    triggerJobId: jobId,
    queued: trigger.queued,
    delivered: delivery.delivered,
    failed: trigger.failed + delivery.failed,
  };
}

module.exports = {
  deliverPendingEmergencyDispatches,
  insertEmergencyTriggerJob,
  processEmergencyTriggerJobs,
  queueAndDeliverEmergency,
  queueEmergencyDispatch,
};
