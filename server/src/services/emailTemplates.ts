/**
 * HTML Email Templates for Oil Co-op
 *
 * These templates use a simple wrapper with inline styles for maximum
 * email client compatibility.
 */

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #1c1917;
`;

const buttonStyles = `
  display: inline-block;
  background-color: #c2410c;
  color: #ffffff !important;
  text-decoration: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  margin: 16px 0;
`;

function wrapHtml(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Oil Co-op</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f4;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#f5f5f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f4; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #c2410c; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; ${baseStyles}">Citizen's Oil Co-op</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px; ${baseStyles}">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background-color: #fafaf9; padding: 24px; text-align: center; border-top: 1px solid #e7e5e4;">
              <p style="margin: 0; font-size: 12px; color: #78716c;">
                Citizen's Oil Co-op<br>
                Questions? Call our office or reply to this email.
              </p>
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

export function welcomeEmailHtml(firstName: string, memberNumber: string, nextBillingDate: string): string {
  return wrapHtml(`
    <h2 style="margin: 0 0 16px; color: #c2410c;">Welcome to the Co-op, ${firstName}!</h2>
    <p>Thank you for joining Citizen's Oil Co-op. Your membership is now active.</p>
    <table style="background-color: #fafaf9; border-radius: 6px; padding: 16px; margin: 16px 0; width: 100%;">
      <tr><td style="padding: 8px 0;"><strong>Member Number:</strong></td><td style="padding: 8px 0;">${memberNumber}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Next Annual Bill:</strong></td><td style="padding: 8px 0;">${nextBillingDate}</td></tr>
    </table>
    <p><strong>What happens next?</strong></p>
    <ul style="padding-left: 20px;">
      <li>Our staff will assign you to a participating oil company within 1-2 business days.</li>
      <li>You'll receive a confirmation email once your oil company is set up.</li>
      <li>Your annual membership renews each June 1st.</li>
    </ul>
    <p>If you have any questions, don't hesitate to contact our office.</p>
  `, `Welcome to Citizens Oil Co-op! Your member number is ${memberNumber}.`);
}

export function renewalReminderHtml(
  firstName: string,
  daysUntil: number,
  billingDate: string,
  amount: string,
  isAutoRenew: boolean,
  cardLast4?: string
): string {
  const daysText = daysUntil === 1 ? "tomorrow" : daysUntil === 7 ? "in one week" : `in ${daysUntil} days`;

  return wrapHtml(`
    <h2 style="margin: 0 0 16px; color: #c2410c;">Membership Renewal Reminder</h2>
    <p>Hello ${firstName},</p>
    <p>Your annual Oil Co-op membership fee of <strong>${amount}</strong> will be billed <strong>${daysText}</strong> on ${billingDate}.</p>
    ${isAutoRenew && cardLast4 ? `
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #065f46;"><strong>✓ Auto-renewal is enabled</strong></p>
        <p style="margin: 8px 0 0; color: #065f46;">Your card ending in ${cardLast4} will be charged automatically.</p>
      </div>
    ` : `
      <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #92400e;"><strong>Action Required</strong></p>
        <p style="margin: 8px 0 0; color: #92400e;">Please mail a check to the office or call to pay by card.</p>
      </div>
    `}
    <p>Thank you for your continued membership!</p>
  `, `Your Oil Co-op membership renews ${daysText}.`);
}

export function paymentSuccessHtml(
  firstName: string,
  amount: string,
  transactionId: string,
  cardLast4: string,
  billingYear: number
): string {
  return wrapHtml(`
    <h2 style="margin: 0 0 16px; color: #059669;">Payment Received</h2>
    <p>Hello ${firstName},</p>
    <p>Thank you! Your annual membership payment has been processed successfully.</p>
    <table style="background-color: #ecfdf5; border-radius: 6px; padding: 16px; margin: 16px 0; width: 100%;">
      <tr><td style="padding: 8px 0;"><strong>Amount:</strong></td><td style="padding: 8px 0;">${amount}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Card:</strong></td><td style="padding: 8px 0;">****${cardLast4}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Transaction ID:</strong></td><td style="padding: 8px 0;">${transactionId}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Billing Year:</strong></td><td style="padding: 8px 0;">${billingYear}</td></tr>
    </table>
    <p>Your membership is active through June 1, ${billingYear + 1}.</p>
  `, `Payment received - $${amount} for ${billingYear} membership.`);
}

export function paymentFailedHtml(firstName: string, amount: string, reason?: string): string {
  return wrapHtml(`
    <h2 style="margin: 0 0 16px; color: #dc2626;">Payment Failed</h2>
    <p>Hello ${firstName},</p>
    <p>We were unable to process your annual membership payment of <strong>${amount}</strong>.</p>
    ${reason ? `<p style="color: #dc2626;"><strong>Reason:</strong> ${reason}</p>` : ""}
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; color: #991b1b;"><strong>Please update your payment method</strong></p>
      <p style="margin: 8px 0 0; color: #991b1b;">Call our office to update your card on file or arrange an alternative payment method.</p>
    </div>
    <p>Your membership may be suspended if payment is not received within 30 days.</p>
  `, `Action required: Your Oil Co-op payment failed.`);
}

export function paymentLinkHtml(
  firstName: string,
  amount: string,
  paymentUrl: string,
  expiresAt: string
): string {
  return wrapHtml(`
    <h2 style="margin: 0 0 16px; color: #c2410c;">Payment Link</h2>
    <p>Hello ${firstName},</p>
    <p>Click the button below to pay your annual membership fee of <strong>${amount}</strong>.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${paymentUrl}" style="${buttonStyles}">Pay ${amount} Now</a>
    </div>
    <p style="font-size: 14px; color: #78716c;">This link expires on ${expiresAt}. If you have any issues, please call our office.</p>
    <p style="font-size: 12px; color: #a8a29e; margin-top: 24px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${paymentUrl}" style="color: #c2410c;">${paymentUrl}</a>
    </p>
  `, `Pay your Oil Co-op membership: ${amount}`);
}

export function oilCompanyAssignedHtml(
  firstName: string,
  companyName: string,
  companyPhone?: string
): string {
  return wrapHtml(`
    <h2 style="margin: 0 0 16px; color: #c2410c;">Oil Company Assigned</h2>
    <p>Hello ${firstName},</p>
    <p>Great news! Your Oil Co-op membership has been linked to your heating oil provider:</p>
    <div style="background-color: #fafaf9; border-radius: 6px; padding: 16px; margin: 16px 0; text-align: center;">
      <p style="margin: 0; font-size: 20px; font-weight: 600; color: #c2410c;">${companyName}</p>
      ${companyPhone ? `<p style="margin: 8px 0 0; color: #78716c;">${companyPhone}</p>` : ""}
    </div>
    <p>You can now enjoy co-op member pricing on your heating oil deliveries. Contact your oil company directly to schedule deliveries.</p>
  `, `Your oil company has been assigned: ${companyName}`);
}
