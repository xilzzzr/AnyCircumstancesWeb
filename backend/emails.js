// backend/emails.js

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderAnyCircumstancesEmail({ title, bodyHtml, ctaText, ctaUrl, footerNote }) {
  const safeTitle = escapeHtml(title);
  const safeCtaText = escapeHtml(ctaText);
  const safeUrl = String(ctaUrl || "");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;border-radius:18px;overflow:hidden;background:#0b1220;">
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#0b1220 0%,#16263b 55%,#0b1220 100%);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#e5e7eb;font-weight:700;">
                      anycircumstances
                    </td>
                    <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;">
                      Secure emergency vault
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:26px 24px;background:#ffffff;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.25;color:#0b1220;font-weight:800;margin:0 0 10px;">
                  ${safeTitle}
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;margin:0 0 18px;">
                  ${bodyHtml || ""}
                </div>

                ${safeUrl && safeCtaText ? `
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0 14px;">
                  <tr>
                    <td style="border-radius:12px;background:#2a9d8f;">
                      <a href="${safeUrl}" style="display:inline-block;padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#ffffff;text-decoration:none;font-weight:700;">
                        ${safeCtaText} →
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b;margin-top:10px;">
                  If the button doesn’t work, paste this into your browser:
                  <div style="word-break:break-all;color:#0f172a;margin-top:6px;">${escapeHtml(safeUrl)}</div>
                </div>
                ` : ""}

                <div style="height:1px;background:#e5e7eb;margin:22px 0;"></div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
                  ${escapeHtml(footerNote || "If you didn’t request this, you can ignore this email.")}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px;background:#f8fafc;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;line-height:1.6;">
                  AnyCircumstances • Client-side file encryption • AES encryption
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    title || "AnyCircumstances",
    "",
    (bodyHtml || "")
      .replace(/<\/li>/g, "\n")
      .replace(/<\/p>/g, "\n")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .trim(),
    "",
    ctaText && ctaUrl ? `${ctaText}: ${ctaUrl}` : "",
    "",
    footerNote || "If you didn’t request this, you can ignore this email."
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

module.exports = {
  escapeHtml,
  renderAnyCircumstancesEmail
};
