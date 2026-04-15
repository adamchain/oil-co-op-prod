import { useState } from "react";

type TemplateKey =
  | "welcome"
  | "renewalReminder"
  | "paymentSuccess"
  | "paymentFailed"
  | "paymentLink"
  | "oilCompanyAssigned";

interface TemplateInfo {
  name: string;
  description: string;
  subject: string;
  variables: string[];
}

const templates: Record<TemplateKey, TemplateInfo> = {
  welcome: {
    name: "Welcome Email",
    description: "Sent when a new member signs up",
    subject: "Welcome to Citizen's Oil Co-op",
    variables: ["firstName", "memberNumber", "nextBillingDate"],
  },
  renewalReminder: {
    name: "Renewal Reminder",
    description: "Sent 30, 7, and 1 day(s) before annual billing",
    subject: "Annual membership renewal - {daysUntil} days",
    variables: ["firstName", "daysUntil", "billingDate", "amount", "isAutoRenew", "cardLast4"],
  },
  paymentSuccess: {
    name: "Payment Success",
    description: "Sent after successful payment",
    subject: "Payment received - Oil Co-op membership",
    variables: ["firstName", "amount", "transactionId", "cardLast4", "billingYear"],
  },
  paymentFailed: {
    name: "Payment Failed",
    description: "Sent when auto-charge fails",
    subject: "Payment failed - Action required",
    variables: ["firstName", "amount", "reason"],
  },
  paymentLink: {
    name: "Payment Link",
    description: "Manual payment link sent by admin",
    subject: "Pay your Oil Co-op membership - {amount}",
    variables: ["firstName", "amount", "paymentUrl", "expiresAt"],
  },
  oilCompanyAssigned: {
    name: "Oil Company Assigned",
    description: "Sent when admin assigns oil company",
    subject: "Your oil company has been assigned",
    variables: ["firstName", "companyName", "companyPhone"],
  },
};

// Sample data for previews
const sampleData = {
  firstName: "John",
  lastName: "Smith",
  memberNumber: "M-2024-0042",
  nextBillingDate: "June 1, 2025",
  daysUntil: 7,
  billingDate: "June 1, 2025",
  amount: "$120.00",
  isAutoRenew: true,
  cardLast4: "4242",
  transactionId: "TXN-123456789",
  billingYear: 2025,
  reason: "Card declined - insufficient funds",
  paymentUrl: "https://oilcoop.example.com/pay/abc123xyz",
  expiresAt: "May 15, 2025",
  companyName: "ABC Heating Oil Co.",
  companyPhone: "(555) 123-4567",
};

// Generate preview HTML for each template type
function generatePreviewHtml(templateKey: TemplateKey): string {
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

  const wrapHtml = (content: string): string => `
    <div style="background-color: #f5f5f4; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
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
    </div>
  `;

  switch (templateKey) {
    case "welcome":
      return wrapHtml(`
        <h2 style="margin: 0 0 16px; color: #c2410c;">Welcome to the Co-op, ${sampleData.firstName}!</h2>
        <p>Thank you for joining Citizen's Oil Co-op. Your membership is now active.</p>
        <table style="background-color: #fafaf9; border-radius: 6px; padding: 16px; margin: 16px 0; width: 100%;">
          <tr><td style="padding: 8px 0;"><strong>Member Number:</strong></td><td style="padding: 8px 0;">${sampleData.memberNumber}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Next Annual Bill:</strong></td><td style="padding: 8px 0;">${sampleData.nextBillingDate}</td></tr>
        </table>
        <p><strong>What happens next?</strong></p>
        <ul style="padding-left: 20px;">
          <li>Our staff will assign you to a participating oil company within 1-2 business days.</li>
          <li>You'll receive a confirmation email once your oil company is set up.</li>
          <li>Your annual membership renews each June 1st.</li>
        </ul>
        <p>If you have any questions, don't hesitate to contact our office.</p>
      `);

    case "renewalReminder":
      return wrapHtml(`
        <h2 style="margin: 0 0 16px; color: #c2410c;">Membership Renewal Reminder</h2>
        <p>Hello ${sampleData.firstName},</p>
        <p>Your annual Oil Co-op membership fee of <strong>${sampleData.amount}</strong> will be billed <strong>in one week</strong> on ${sampleData.billingDate}.</p>
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #065f46;"><strong>✓ Auto-renewal is enabled</strong></p>
          <p style="margin: 8px 0 0; color: #065f46;">Your card ending in ${sampleData.cardLast4} will be charged automatically.</p>
        </div>
        <p>Thank you for your continued membership!</p>
      `);

    case "paymentSuccess":
      return wrapHtml(`
        <h2 style="margin: 0 0 16px; color: #059669;">Payment Received</h2>
        <p>Hello ${sampleData.firstName},</p>
        <p>Thank you! Your annual membership payment has been processed successfully.</p>
        <table style="background-color: #ecfdf5; border-radius: 6px; padding: 16px; margin: 16px 0; width: 100%;">
          <tr><td style="padding: 8px 0;"><strong>Amount:</strong></td><td style="padding: 8px 0;">${sampleData.amount}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Card:</strong></td><td style="padding: 8px 0;">****${sampleData.cardLast4}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Transaction ID:</strong></td><td style="padding: 8px 0;">${sampleData.transactionId}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Billing Year:</strong></td><td style="padding: 8px 0;">${sampleData.billingYear}</td></tr>
        </table>
        <p>Your membership is active through June 1, ${sampleData.billingYear + 1}.</p>
      `);

    case "paymentFailed":
      return wrapHtml(`
        <h2 style="margin: 0 0 16px; color: #dc2626;">Payment Failed</h2>
        <p>Hello ${sampleData.firstName},</p>
        <p>We were unable to process your annual membership payment of <strong>${sampleData.amount}</strong>.</p>
        <p style="color: #dc2626;"><strong>Reason:</strong> ${sampleData.reason}</p>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #991b1b;"><strong>Please update your payment method</strong></p>
          <p style="margin: 8px 0 0; color: #991b1b;">Call our office to update your card on file or arrange an alternative payment method.</p>
        </div>
        <p>Your membership may be suspended if payment is not received within 30 days.</p>
      `);

    case "paymentLink":
      return wrapHtml(`
        <h2 style="margin: 0 0 16px; color: #c2410c;">Payment Link</h2>
        <p>Hello ${sampleData.firstName},</p>
        <p>Click the button below to pay your annual membership fee of <strong>${sampleData.amount}</strong>.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="#" style="${buttonStyles}">Pay ${sampleData.amount} Now</a>
        </div>
        <p style="font-size: 14px; color: #78716c;">This link expires on ${sampleData.expiresAt}. If you have any issues, please call our office.</p>
        <p style="font-size: 12px; color: #a8a29e; margin-top: 24px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="#" style="color: #c2410c;">${sampleData.paymentUrl}</a>
        </p>
      `);

    case "oilCompanyAssigned":
      return wrapHtml(`
        <h2 style="margin: 0 0 16px; color: #c2410c;">Oil Company Assigned</h2>
        <p>Hello ${sampleData.firstName},</p>
        <p>Great news! Your Oil Co-op membership has been linked to your heating oil provider:</p>
        <div style="background-color: #fafaf9; border-radius: 6px; padding: 16px; margin: 16px 0; text-align: center;">
          <p style="margin: 0; font-size: 20px; font-weight: 600; color: #c2410c;">${sampleData.companyName}</p>
          <p style="margin: 8px 0 0; color: #78716c;">${sampleData.companyPhone}</p>
        </div>
        <p>You can now enjoy co-op member pricing on your heating oil deliveries. Contact your oil company directly to schedule deliveries.</p>
      `);

    default:
      return "";
  }
}

export default function AdminEmailTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>("welcome");

  const templateKeys = Object.keys(templates) as TemplateKey[];
  const currentTemplate = templates[selectedTemplate];

  return (
    <div className="admin-page">
      <h2>Email Templates</h2>
      <p style={{ color: "#78716c", marginBottom: "1.5rem" }}>
        Preview and reference for all automated email notifications sent by the system.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem" }}>
        {/* Template List */}
        <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem", borderBottom: "1px solid #e7e5e4", background: "#fafaf9" }}>
            <strong>Templates</strong>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {templateKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedTemplate(key)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "0.75rem 1rem",
                  textAlign: "left",
                  border: "none",
                  borderBottom: "1px solid #e7e5e4",
                  background: selectedTemplate === key ? "#fff7ed" : "transparent",
                  borderLeft: selectedTemplate === key ? "3px solid #c2410c" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontWeight: 500, color: selectedTemplate === key ? "#c2410c" : "#1c1917" }}>
                  {templates[key].name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#78716c", marginTop: "0.25rem" }}>
                  {templates[key].description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Template Preview */}
        <div>
          {/* Template Info */}
          <div className="admin-card" style={{ marginBottom: "1rem" }}>
            <h3 style={{ margin: "0 0 0.5rem" }}>{currentTemplate.name}</h3>
            <p style={{ color: "#78716c", margin: "0 0 1rem" }}>{currentTemplate.description}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#78716c", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Subject Line
                </label>
                <div style={{ marginTop: "0.25rem", padding: "0.5rem 0.75rem", background: "#fafaf9", borderRadius: "4px", fontFamily: "monospace", fontSize: "0.875rem" }}>
                  {currentTemplate.subject}
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#78716c", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Variables Used
                </label>
                <div style={{ marginTop: "0.25rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                  {currentTemplate.variables.map((v) => (
                    <span
                      key={v}
                      style={{
                        padding: "0.125rem 0.5rem",
                        background: "#e7e5e4",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontFamily: "monospace",
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e7e5e4", background: "#fafaf9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong>Preview</strong>
              <span style={{ fontSize: "0.75rem", color: "#78716c" }}>Sample data shown</span>
            </div>
            <div
              style={{ maxHeight: "600px", overflow: "auto" }}
              dangerouslySetInnerHTML={{ __html: generatePreviewHtml(selectedTemplate) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
