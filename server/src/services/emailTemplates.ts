/**
 * HTML Email Templates for Oil Co-op
 *
 * Printed letters use `wrapLetter()` — full letterhead, date, address block,
 * salutation, and signature. Staff mailings in the workbench print flow use this.
 *
 * Outbound emails use `wrapEmail()` — forest-green banner with the COOP house
 * logo, clean body area, and a simple footer. Template bodies (and admin-edited
 * middle content) are middle-only; the frame is applied at send time.
 */

// ---------------------------------------------------------------------------
// Organization details. Update here only.
// ---------------------------------------------------------------------------
export const ORG = {
  name: "Citizen's Oil Co-op",
  nameFormal: "Citizen's Oil Co-op, Inc",
  tagline: "Heat for Less!",
  addressLines: ["P.O. Box 271718", "West Hartford, CT 06127"],
  phone: "860-561-6011",
  email: "hutson@oilco-op.com",
  website: "oilco-op.com",
  signerName: "Rosemary A. Stanko",
  signerTitle: "President",
  brandGreen: "#14703B",
  brandGreenDark: "#0f5530",
  brandGreenLight: "#ecfdf3",
};

const baseFont =
  "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;";

const buttonStyles = `
  display: inline-block;
  background-color: ${ORG.brandGreen};
  color: #ffffff !important;
  text-decoration: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  margin: 16px 0;
`;

/** Public URL for the COOP house logo (served from /coop-logo.png). */
export function coopLogoUrl(): string {
  const base = (process.env.SITE_URL || process.env.CLIENT_ORIGIN || "https://oilco-op.com").replace(/\/$/, "");
  return `${base}/coop-logo.png`;
}

export type LetterContext = {
  /** Member first name, used for the "Dear {firstName}:" salutation on letters. */
  firstName?: string;
  /** Member full name, shown in the recipient address block on letters. */
  fullName?: string;
  /** Recipient address lines (street, city/state/zip), each on its own row. */
  addressLines?: string[];
  /** Letter date, e.g. "June 26, 2026". Defaults to today. */
  date?: string;
};

function escapeHtml(s: string) {
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

/** Builds the letter context (name + address block) from a member-like doc. */
export function letterContextFromMember(m: {
  firstName?: string;
  lastName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}): LetterContext {
  const fullName = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
  const cityStateZip = [
    [m.city, m.state].filter(Boolean).join(", "),
    m.postalCode,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const addressLines = [m.addressLine1, m.addressLine2, cityStateZip]
    .map((l) => (l || "").trim())
    .filter(Boolean);
  return { firstName: m.firstName, fullName, addressLines };
}

/** Printed letter letterhead + date + recipient block + salutation (HTML). */
function letterHeaderHtml(ctx: LetterContext): string {
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
          <div style="font-size: 22px; font-weight: 700; color: #1c1917;">${escapeHtml(ORG.nameFormal)}</div>
          ${ORG.addressLines.map((l) => `<div style="font-size: 12px; color: #57534e;">${escapeHtml(l)}</div>`).join("")}
        </td>
        <td style="vertical-align: top; text-align: right;">
          <div style="font-size: 20px; font-weight: 700; color: #1c1917;">"${ORG.tagline}"</div>
          <div style="font-size: 12px; color: #57534e;">${escapeHtml(ORG.phone)}</div>
          <div style="font-size: 12px; color: #57534e;">${escapeHtml(ORG.email)}</div>
        </td>
      </tr>
    </table>
    <div style="font-size: 13px; color: #1c1917; margin: 24px 0 16px;">${escapeHtml(date)}</div>
    ${recipient ? `<div style="font-size: 13px; color: #1c1917; line-height: 1.5; margin-bottom: 16px;">${recipient}</div>` : ""}
    <div style="font-size: 14px; color: #1c1917; margin-bottom: 16px;">${salutation}</div>
  `;
}

/** The signature block + website footer for printed letters (HTML). */
function letterFooterHtml(): string {
  return `
    <div style="margin-top: 24px; font-size: 14px; color: #1c1917;">
      <div>Sincerely,</div>
      <div style="margin-top: 28px; font-weight: 600;">${escapeHtml(ORG.signerName)}</div>
      <div style="color: #57534e;">${escapeHtml(ORG.signerTitle)}</div>
    </div>
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e7e5e4; text-align: center;">
      <a href="https://${ORG.website}" style="font-size: 13px; color: #c2410c; text-decoration: none;">${escapeHtml(ORG.website)}</a>
    </div>
  `;
}

/** Forest-green banner with COOP house logo for outbound emails. */
function emailBannerHtml(): string {
  const logo = coopLogoUrl();
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${ORG.brandGreen};">
      <tr>
        <td align="center" style="padding: 22px 24px;">
          <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="vertical-align: middle; padding-right: 14px;">
                <img src="${logo}" alt="COOP" width="52" height="52" style="display: block; border: 0; outline: none;" />
              </td>
              <td style="vertical-align: middle;">
                <div style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; line-height: 1.2;">
                  ${escapeHtml(ORG.name)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/** Simple footer for outbound emails. */
function emailFooterHtml(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f4;">
      <tr>
        <td align="center" style="padding: 20px 24px;">
          <div style="font-size: 14px; font-weight: 600; color: #1c1917;">${escapeHtml(ORG.name)}</div>
          <div style="font-size: 13px; color: #78716c; margin-top: 6px; line-height: 1.5;">
            Questions? Call ${escapeHtml(ORG.phone)} or reply to this email.
          </div>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Wraps middle content in the printed letter letterhead + signature/footer.
 * Used for workbench print/preview — not for outbound email.
 */
export function wrapLetter(middleHtml: string, ctx: LetterContext = {}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(ORG.nameFormal)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f4; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px; ${baseFont} line-height: 1.6; color: #1c1917;">
              ${letterHeaderHtml(ctx)}
              <div style="font-size: 14px; color: #1c1917;">
                ${middleHtml}
              </div>
              ${letterFooterHtml()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/** Plain-text counterpart of `wrapLetter`. */
export function wrapLetterText(middleText: string, ctx: LetterContext = {}): string {
  const date = ctx.date || todayLong();
  const headerLines = [
    `${ORG.nameFormal}    "${ORG.tagline}"`,
    ...ORG.addressLines,
    ORG.phone,
    ORG.email,
    "",
    date,
    "",
    ...(ctx.fullName ? [ctx.fullName] : []),
    ...(ctx.addressLines || []),
    "",
    ctx.firstName ? `Dear ${ctx.firstName}:` : "Dear Member:",
    "",
  ];
  const footerLines = [
    "",
    "Sincerely,",
    "",
    "",
    ORG.signerName,
    ORG.signerTitle,
    "",
    ORG.website,
  ];
  return [...headerLines, middleText.trim(), ...footerLines].join("\n");
}

/**
 * Wraps middle content in the email banner + footer and returns a complete
 * HTML email document. Used for all outbound email sends.
 */
export function wrapEmail(middleHtml: string, _ctx: LetterContext = {}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(ORG.name)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f4; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 0;">
              ${emailBannerHtml()}
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 24px; ${baseFont} line-height: 1.6; color: #1c1917; font-size: 14px;">
              ${middleHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 0;">
              ${emailFooterHtml()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/** Plain-text counterpart of `wrapEmail`. */
export function wrapEmailText(middleText: string): string {
  const footerLines = [
    "",
    "---",
    ORG.name,
    `Questions? Call ${ORG.phone} or reply to this email.`,
  ];
  return [ORG.name, "", middleText.trim(), ...footerLines].join("\n");
}

// ---------------------------------------------------------------------------
// Middle-content builders. Each returns ONLY the message body.
// ---------------------------------------------------------------------------

export function welcomeEmailHtml(firstName: string, memberNumber: string, nextBillingDate: string): string {
  return `
    <p style="font-size: 22px; font-weight: 700; color: ${ORG.brandGreen}; margin: 0 0 16px;">Welcome to the Co-op, ${escapeHtml(firstName)}!</p>
    <p style="margin: 0 0 16px;">Thank you for joining Citizen's Oil Co-op. Your membership is now active.</p>
    <table style="background-color: #fafaf9; border-radius: 6px; padding: 16px; margin: 16px 0; width: 100%;">
      <tr><td style="padding: 8px 0;"><strong>Member Number:</strong></td><td style="padding: 8px 0;">${escapeHtml(memberNumber)}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Next Annual Bill:</strong></td><td style="padding: 8px 0;">${escapeHtml(nextBillingDate)}</td></tr>
    </table>
    <p style="margin: 16px 0 8px;"><strong>What happens next?</strong></p>
    <ul style="padding-left: 20px; margin: 0 0 16px;">
      <li>Our staff will assign you to a participating oil company within 1-2 business days.</li>
      <li>Your annual membership renews each June 1st.</li>
    </ul>
    <p style="margin: 0;">If you have any questions, don't hesitate to contact our office.</p>
  `.trim();
}

export function renewalReminderHtml(
  _firstName: string,
  daysUntil: number,
  billingDate: string,
  amount: string,
  isAutoRenew: boolean,
  cardLast4?: string
): string {
  const daysText = daysUntil === 1 ? "tomorrow" : daysUntil === 7 ? "in one week" : `in ${daysUntil} days`;
  return `
    <p>Your annual Oil Co-op membership fee of <strong>${escapeHtml(amount)}</strong> will be billed <strong>${daysText}</strong> on ${escapeHtml(billingDate)}.</p>
    ${isAutoRenew && cardLast4 ? `
      <div style="background-color: ${ORG.brandGreenLight}; border: 1px solid #a7f3d0; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: ${ORG.brandGreenDark};"><strong>Auto-renewal is enabled</strong></p>
        <p style="margin: 8px 0 0; color: ${ORG.brandGreenDark};">Your card ending in ${escapeHtml(cardLast4)} will be charged automatically.</p>
      </div>
    ` : `
      <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #92400e;"><strong>Action Required</strong></p>
        <p style="margin: 8px 0 0; color: #92400e;">Please mail a check to the office or call to pay by card.</p>
      </div>
    `}
    <p>Thank you for your continued membership.</p>
  `.trim();
}

export function paymentSuccessHtml(
  _firstName: string,
  amount: string,
  transactionId: string,
  cardLast4: string,
  billingYear: number
): string {
  return `
    <p>Thank you! Your annual membership payment has been processed successfully.</p>
    <table style="background-color: ${ORG.brandGreenLight}; border-radius: 6px; padding: 16px; margin: 16px 0; width: 100%;">
      <tr><td style="padding: 8px 0;"><strong>Amount:</strong></td><td style="padding: 8px 0;">${escapeHtml(amount)}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Card:</strong></td><td style="padding: 8px 0;">****${escapeHtml(cardLast4)}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Transaction ID:</strong></td><td style="padding: 8px 0;">${escapeHtml(transactionId)}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Billing Year:</strong></td><td style="padding: 8px 0;">${billingYear}</td></tr>
    </table>
    <p>Your membership is active through June 1, ${billingYear + 1}.</p>
  `.trim();
}

export function paymentFailedHtml(_firstName: string, amount: string, reason?: string): string {
  return `
    <p>We were unable to process your annual membership payment of <strong>${escapeHtml(amount)}</strong>.</p>
    ${reason ? `<p style="color: #dc2626;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; color: #991b1b;"><strong>Please update your payment method</strong></p>
      <p style="margin: 8px 0 0; color: #991b1b;">Call our office to update your card on file or arrange an alternative payment method.</p>
    </div>
  `.trim();
}

export function paymentLinkHtml(
  _firstName: string,
  amount: string,
  paymentUrl: string,
  expiresAt: string
): string {
  return `
    <p>Click the button below to pay your annual membership fee of <strong>${escapeHtml(amount)}</strong>.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${paymentUrl}" style="${buttonStyles}">Pay ${escapeHtml(amount)} Now</a>
    </div>
    <p style="font-size: 13px; color: #78716c;">This link expires on ${escapeHtml(expiresAt)}. If you have any issues, please call our office.</p>
    <p style="font-size: 12px; color: #a8a29e; margin-top: 16px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${paymentUrl}" style="color: ${ORG.brandGreen};">${escapeHtml(paymentUrl)}</a>
    </p>
  `.trim();
}

export function oilCompanyAssignedHtml(
  _firstName: string,
  companyName: string,
  companyPhone?: string
): string {
  return `
    <p>Great news! Your Oil Co-op membership has been linked to your heating oil provider:</p>
    <div style="background-color: #fafaf9; border-radius: 6px; padding: 16px; margin: 16px 0; text-align: center;">
      <p style="margin: 0; font-size: 20px; font-weight: 600; color: ${ORG.brandGreen};">${escapeHtml(companyName)}</p>
      ${companyPhone ? `<p style="margin: 8px 0 0; color: #78716c;">${escapeHtml(companyPhone)}</p>` : ""}
    </div>
    <p>You can now enjoy co-op member pricing on your heating oil deliveries. Contact your oil company directly to schedule deliveries.</p>
  `.trim();
}
