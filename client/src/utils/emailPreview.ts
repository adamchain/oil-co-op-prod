/** Client-side preview of the outbound email frame (mirrors server emailTemplates.ts). */

export const EMAIL_ORG = {
  name: "Citizen's Oil Co-op",
  phone: "860-561-6011",
  brandGreen: "#14703B",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Turn plain-text letter body into HTML paragraphs for the email middle. */
export function plainTextToEmailMiddle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "<p style=\"margin:0;color:#78716c;\">(No message body)</p>";
  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 12px;">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Wrap middle HTML in the forest-green email banner + footer for admin previews. */
export function wrapEmailPreview(middleHtml: string): string {
  return `
    <div style="background:#f5f5f4;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#1c1917;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_ORG.brandGreen};">
          <tr>
            <td align="center" style="padding:22px 24px;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">
                    <img src="/coop-logo.png" alt="COOP" width="52" height="52" style="display:block;border:0;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${EMAIL_ORG.name}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <div style="padding:32px 40px 24px;font-size:14px;">${middleHtml}</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;">
          <tr>
            <td align="center" style="padding:20px 24px;">
              <div style="font-size:14px;font-weight:600;">${EMAIL_ORG.name}</div>
              <div style="font-size:13px;color:#78716c;margin-top:6px;">Questions? Call ${EMAIL_ORG.phone} or reply to this email.</div>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}
