// A redeemed link only opens other files from its own release batch and contact.
async function authorizedPackageFile(pool, share, requestedFileId) {
  const target = String(requestedFileId || share.file_id);
  if (target === String(share.file_id)) return target;
  if (!share.delivery_group_id) return null;
  const [rows] = await pool.query(
    `SELECT t.file_id FROM contact_file_share_tokens t
     JOIN emergency_contacts c ON c.id=t.contact_id
     JOIN files f ON f.id=t.file_id AND f.user_id=c.user_id
     WHERE t.contact_id=? AND t.delivery_group_id=? AND t.file_id=? AND t.expires_at >= UTC_TIMESTAMP(3) LIMIT 1`,
    [String(share.contact_id), String(share.delivery_group_id), target],
  );
  return rows?.length ? target : null;
}
function registerPackageRoutes(
  router,
  { asyncHandler, getPool, getShareSession },
) {
  router.post(
    "/share-package",
    asyncHandler(async (req, res) => {
      res.set("Cache-Control", "no-store");
      const session = getShareSession(req);
      if (!session)
        return res
          .status(401)
          .json({ ok: false, error: "share_session_required" });
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT t.contact_id, t.file_id, t.delivery_group_id, t.expires_at, t.used_at
       FROM contact_file_share_tokens t
       JOIN emergency_contacts c ON c.id=t.contact_id
       JOIN files f ON f.id=t.file_id AND f.user_id=c.user_id
       WHERE t.id=? AND t.contact_id=? AND t.file_id=? LIMIT 1`,
        [
          String(session.tid || ""),
          String(session.cid || ""),
          String(session.fid || ""),
        ],
      );
      const share = rows?.[0];
      if (!share?.used_at)
        return res
          .status(404)
          .json({ ok: false, error: "invalid_share_session" });
      if (new Date(share.expires_at).getTime() < Date.now())
        return res.status(410).json({ ok: false, error: "token_expired" });
      const [files] = await pool.query(
        `SELECT DISTINCT f.id, f.content_type, f.size_bytes, e.meta_json
       FROM contact_file_share_tokens t
       JOIN emergency_contacts c ON c.id=t.contact_id
       JOIN files f ON f.id=t.file_id AND f.user_id=c.user_id
       LEFT JOIN file_key_envelopes e ON e.file_id=f.id AND e.recipient_type='user' AND e.recipient_id=f.user_id
       WHERE t.contact_id=? AND t.expires_at >= UTC_TIMESTAMP(3) AND
         ((? IS NOT NULL AND t.delivery_group_id=?) OR (? IS NULL AND t.file_id=?))
       LIMIT 100`,
        [
          String(share.contact_id),
          share.delivery_group_id,
          share.delivery_group_id,
          share.delivery_group_id,
          String(share.file_id),
        ],
      );
      return res.json({
        ok: true,
        files: files.map((file) => {
          const meta = require("./vault_documents").parseMeta(file.meta_json);
          return {
            id: String(file.id),
            name: String(meta.original_name || "File"),
            content_type: String(file.content_type),
            size_bytes: Number(file.size_bytes || 0),
          };
        }),
      });
    }),
  );
}
module.exports = { authorizedPackageFile, registerPackageRoutes };
