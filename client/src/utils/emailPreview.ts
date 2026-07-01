/**
 * Client-side preview frames for admin email + letter templates.
 * Mirrors server/src/services/emailTemplates.ts (wrapEmail / wrapLetter).
 */

export const EMAIL_ORG = {
  name: "Citizen's Oil Co-op",
  phone: "860-561-6011",
  brandGreen: "#14703B",
};

/** Editable email header/footer design (Admin → Email Templates designer). */
export type EmailBranding = {
  headerBgColor: string;
  headerTextColor: string;
  headerTitle: string;
  headerShowLogo: boolean;
  footerBgColor: string;
  footerTitleColor: string;
  footerTextColor: string;
  footerTitle: string;
  footerText: string;
};

export const DEFAULT_EMAIL_BRANDING: EmailBranding = {
  headerBgColor: EMAIL_ORG.brandGreen,
  headerTextColor: "#ffffff",
  headerTitle: EMAIL_ORG.name,
  headerShowLogo: true,
  footerBgColor: "#f5f5f4",
  footerTitleColor: "#1c1917",
  footerTextColor: "#78716c",
  footerTitle: EMAIL_ORG.name,
  footerText: `Questions? Call ${EMAIL_ORG.phone} or reply to this email.`,
};

export const LETTER_ORG = {
  nameFormal: "Citizen's Oil Co-op, Inc",
  tagline: "Heat for Less!",
  addressLines: ["P.O. Box 271718", "West Hartford, CT 06127"],
  phone: "860-561-6011",
  email: "hutson@oilco-op.com",
  website: "oilco-op.com",
  signerName: "Rosemary A. Stanko",
  signerTitle: "President",
};

export type LetterPreviewContext = {
  firstName?: string;
  fullName?: string;
  addressLines?: string[];
  date?: string;
};

const baseFont =
  "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function todayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Banner with COOP house logo (email templates header). */
function emailBannerHtml(branding: EmailBranding = DEFAULT_EMAIL_BRANDING): string {
  // The COOP house logo is forest green, so it sits on a white chip — on a green
  // header a bare logo blends in and only its white strokes show ("white lines").
  const logoCell = branding.headerShowLogo
    ? `<td style="vertical-align: middle; padding-right: 14px;">
                <table cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px;">
                  <tr><td style="padding: 8px; line-height: 0;">
                    <img src="/coop-logo.png" alt="COOP" width="44" height="44" style="display: block; border: 0; outline: none;" />
                  </td></tr>
                </table>
              </td>`
    : "";
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${branding.headerBgColor};">
      <tr>
        <td align="center" style="padding: 22px 24px;">
          <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              ${logoCell}
              <td style="vertical-align: middle;">
                <div style="font-size: 24px; font-weight: 700; color: ${branding.headerTextColor}; letter-spacing: -0.02em; line-height: 1.2;">
                  ${escapeHtml(branding.headerTitle)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/** Simple footer for outbound emails (email templates footer). */
function emailFooterHtml(branding: EmailBranding = DEFAULT_EMAIL_BRANDING): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${branding.footerBgColor};">
      <tr>
        <td align="center" style="padding: 20px 24px;">
          <div style="font-size: 14px; font-weight: 600; color: ${branding.footerTitleColor};">${escapeHtml(branding.footerTitle)}</div>
          <div style="font-size: 13px; color: ${branding.footerTextColor}; margin-top: 6px; line-height: 1.5;">
            ${escapeHtml(branding.footerText)}
          </div>
        </td>
      </tr>
    </table>
  `;
}

/** Printed letter letterhead + date + recipient block + salutation. */
function letterHeaderHtml(ctx: LetterPreviewContext): string {
  const date = ctx.date || todayLong();
  const recipient = [ctx.fullName, ...(ctx.addressLines || [])]
    .filter(Boolean)
    .map((l) => `${escapeHtml(l!)}<br>`)
    .join("");
  const salutation = ctx.firstName ? `Dear ${escapeHtml(ctx.firstName)}:` : "Dear Member:";

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom: 2px solid #1c1917; padding-bottom: 8px;">
      <tr>
        <td style="vertical-align: top;">
          <div style="font-size: 22px; font-weight: 700; color: #1c1917;">${escapeHtml(LETTER_ORG.nameFormal)}</div>
          ${LETTER_ORG.addressLines.map((l) => `<div style="font-size: 12px; color: #57534e;">${escapeHtml(l)}</div>`).join("")}
        </td>
        <td style="vertical-align: top; text-align: right;">
          <div style="font-size: 20px; font-weight: 700; color: #1c1917;">"${escapeHtml(LETTER_ORG.tagline)}"</div>
          <div style="font-size: 12px; color: #57534e;">${escapeHtml(LETTER_ORG.phone)}</div>
          <div style="font-size: 12px; color: #57534e;">${escapeHtml(LETTER_ORG.email)}</div>
        </td>
      </tr>
    </table>
    <div style="font-size: 13px; color: #1c1917; margin: 24px 0 16px;">${escapeHtml(date)}</div>
    ${recipient ? `<div style="font-size: 13px; color: #1c1917; line-height: 1.5; margin-bottom: 16px;">${recipient}</div>` : ""}
    <div style="font-size: 14px; color: #1c1917; margin-bottom: 16px;">${salutation}</div>
  `;
}

/** Signature block + website footer for printed letters. */
function letterFooterHtml(): string {
  return `
    <div style="margin-top: 24px; font-size: 14px; color: #1c1917;">
      <div>Sincerely,</div>
      <div style="margin-top: 28px; font-weight: 600;">${escapeHtml(LETTER_ORG.signerName)}</div>
      <div style="color: #57534e;">${escapeHtml(LETTER_ORG.signerTitle)}</div>
    </div>
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e7e5e4; text-align: center;">
      <a href="https://${LETTER_ORG.website}" style="font-size: 13px; color: #c2410c; text-decoration: none;">${escapeHtml(LETTER_ORG.website)}</a>
    </div>
  `;
}

/** Build a popup/print document that won't override email table layout styles. */
export function previewPopupDocument(
  title: string,
  bodyHtml: string,
  kind: "email" | "letter" | "document",
  blackAndWhite = false
): string {
  const safeTitle = escapeHtml(title);
  const bwStyles =
    blackAndWhite && kind === "letter"
      ? `*{color:#000 !important;border-color:#000 !important;background-color:#fff !important;box-shadow:none !important}img,svg{filter:grayscale(100%) !important}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}`
      : "";

  if (kind === "document") {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.4}h1{margin-top:0;font-size:20px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #ddd;padding:6px;font-size:12px;text-align:left}th{background:#f6f6f6}pre{white-space:pre-wrap;font-family:inherit}${bwStyles}</style></head><body>${bodyHtml}</body></html>`;
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${safeTitle}</title><style>
    body { margin: 0; padding: 0; background: #f5f5f4; }
    table { border-collapse: collapse; }
    img { border: 0; display: block; max-width: 100%; height: auto; }
    ${bwStyles}
  </style></head><body>${bodyHtml}</body></html>`;
}

/** Turn plain-text letter body into HTML paragraphs for the email or letter middle. */
export function plainTextToEmailMiddle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '<p style="margin:0;color:#78716c;">(No message body)</p>';
  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 12px;">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Wrap middle HTML in the forest-green email banner + footer (Email Templates page + Mailings email preview). */
export function wrapEmailPreview(
  middleHtml: string,
  branding: EmailBranding = DEFAULT_EMAIL_BRANDING
): string {
  return `
    <div style="background:#f5f5f4;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);${baseFont}line-height:1.6;color:#1c1917;">
        ${emailBannerHtml(branding)}
        <div style="padding:32px 40px 24px;font-size:14px;">${middleHtml}</div>
        ${emailFooterHtml(branding)}
      </div>
    </div>
  `;
}

/** Wrap middle HTML in the official letterhead + signature (Mailings letter preview / print). */
export function wrapLetterPreview(middleHtml: string, ctx: LetterPreviewContext = {}): string {
  return `
    <div style="background:#f5f5f4;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:40px;${baseFont}line-height:1.6;color:#1c1917;">
        ${letterHeaderHtml(ctx)}
        <div style="font-size:14px;color:#1c1917;">${middleHtml}</div>
        ${letterFooterHtml()}
      </div>
    </div>
  `;
}

/** Build letter context from workbench member fields. */
export function letterContextFromMember(input: {
  firstName?: string;
  lastName?: string;
  address?: string;
  cityStateZip?: string;
}): LetterPreviewContext {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  const addressLines = [input.address, input.cityStateZip]
    .map((l) => (l || "").trim())
    .filter((l) => l && l !== "—");
  return { firstName: input.firstName, fullName: fullName || undefined, addressLines };
}
