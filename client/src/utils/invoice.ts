/**
 * Membership-renewal paper invoices — printable sheets that match the Co-op's
 * mailer. Each sheet is one letter page; the recipient block sits bottom-left so
 * it shows through a #10 double-window envelope after a standard tri-fold.
 *
 * Window offsets are exposed as CSS variables at the top of the print styles
 * (--win-left / --win-top) so they can be nudged after a test print.
 */

export type InvoiceMember = {
  memberNumber: string;
  name1: string;
  name2?: string;
  addressLine1: string;
  addressLine2?: string;
  cityStateZip: string;
  oilCompany: string;
  memberSince: string;
};

export type InvoiceOptions = {
  /** e.g. "2026-2027" — defaults to the season starting the coming June 1. */
  season?: string;
  /** Dollar amounts (whole dollars) for the two checkboxes. */
  memberPrice?: number;
  seniorPrice?: number;
  /** Printed date (defaults to today, M/D/YYYY). */
  dateStr?: string;
};

const RETURN_ADDRESS = [
  "P.O. Box 271718",
  "West Hartford, CT 06127",
  "Phone (860) 561-6011",
  "www.oilco-op.com meredith@oilco-op.com",
];
const RETURN_NAME = "Citizen's Oil Co-op, Inc.";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** The membership season starting the coming (or current) June 1. */
export function currentMembershipSeason(now = new Date()): string {
  const y = now.getFullYear();
  // June (month index 5) or later belongs to the year→year+1 season.
  const start = now.getMonth() >= 5 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export function todayShort(now = new Date()): string {
  return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
}

function invoiceSheetHtml(m: InvoiceMember, o: Required<InvoiceOptions>): string {
  const recipientLines = [m.name1, m.name2, m.addressLine1, m.addressLine2, m.cityStateZip]
    .map((l) => String(l || "").trim())
    .filter(Boolean)
    .map((l) => escapeHtml(l))
    .join("<br>");

  const returnLines = RETURN_ADDRESS.map((l) => escapeHtml(l)).join("<br>");

  return `
  <div class="inv-sheet">
    <div class="inv-box">
      <div class="inv-title">Your ${escapeHtml(o.season)} membership is due.</div>
      <div class="inv-prices">
        <span>&#9744;&nbsp; $${o.memberPrice}.00 Member</span>
        <span>&#9744;&nbsp; $${o.seniorPrice}.00 Senior Citizen</span>
      </div>
      <div class="inv-center">Checks payable: Citizen&#39;s Oil Co-op, or send CC#</div>
      <div class="inv-cc">Renew by CC# ____-____-____-____ &nbsp;&nbsp; Exp. ___/___ &nbsp;&nbsp; CVV: _____</div>
      <div class="inv-center inv-phone">Call us with any questions. 860-561-6011</div>
    </div>

    <div class="inv-meta">
      <div class="inv-meta-left">
        <div class="inv-id"><strong>MEMBER ID:</strong> &nbsp;${escapeHtml(m.memberNumber || "—")}</div>
        <div class="inv-oilco"><strong>OIL COMPANY:</strong> &nbsp;${escapeHtml(m.oilCompany || "—")}</div>
      </div>
      <div class="inv-meta-right">
        <div class="inv-date">${escapeHtml(o.dateStr)}</div>
        <div class="inv-since"><span class="inv-since-label">MEMBER SINCE</span> &nbsp;${escapeHtml(m.memberSince || "—")}</div>
      </div>
    </div>

    <div class="inv-addr">
      <div class="inv-recipient">${recipientLines}</div>
      <div class="inv-return">
        <strong>${escapeHtml(RETURN_NAME)}</strong><br>
        ${returnLines}
      </div>
    </div>
  </div>`;
}

/** Full printable HTML document containing one invoice sheet per member. */
export function buildMembershipInvoiceDocument(members: InvoiceMember[], options: InvoiceOptions = {}): string {
  const o: Required<InvoiceOptions> = {
    season: options.season || currentMembershipSeason(),
    memberPrice: options.memberPrice ?? 35,
    seniorPrice: options.seniorPrice ?? 25,
    dateStr: options.dateStr || todayShort(),
  };

  const sheets = members.length
    ? members.map((m) => invoiceSheetHtml(m, o)).join("\n")
    : `<div class="inv-sheet"><p style="text-align:center;color:#555;">No members to print.</p></div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <title>Membership Invoices (${members.length})</title>
  <style>
    :root { --win-left: 0.55in; --win-top: 0in; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #e5e5e5; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; }

    .inv-sheet {
      background: #fff;
      width: 7.5in;
      min-height: 4.2in;
      margin: 0.35in auto;
      padding: 0.35in 0.5in;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    }

    .inv-box {
      border: 1.5px solid #000;
      border-radius: 16px;
      padding: 12px 20px 14px;
      max-width: 6.4in;
      margin: 0 auto 14px;
    }
    .inv-title { text-align: center; font-size: 16px; font-weight: 700; margin-bottom: 8px; }
    .inv-prices { display: flex; justify-content: center; gap: 48px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
    .inv-center { text-align: center; font-size: 12.5px; margin-bottom: 6px; }
    .inv-cc { text-align: center; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; margin: 8px 0; }
    .inv-phone { font-weight: 600; margin-bottom: 0; }

    .inv-meta { display: flex; justify-content: space-between; align-items: flex-start; margin: 6px 2px 26px; }
    .inv-id { font-size: 14px; }
    .inv-oilco { font-size: 11px; margin-top: 4px; text-transform: uppercase; }
    .inv-meta-right { text-align: right; }
    .inv-date { font-size: 13px; font-weight: 600; }
    .inv-since { font-size: 11px; margin-top: 4px; }
    .inv-since-label { color: #444; }

    .inv-addr { display: flex; justify-content: space-between; align-items: flex-start; }
    .inv-recipient {
      font-size: 13px;
      line-height: 1.35;
      padding-left: var(--win-left);
      margin-top: var(--win-top);
    }
    .inv-return { font-size: 12px; line-height: 1.4; text-align: left; }

    @media print {
      html, body { background: #fff; }
      .inv-sheet {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0.6in 0.75in;
        box-shadow: none;
        page-break-after: always;
      }
      .inv-sheet:last-child { page-break-after: auto; }
      @page { size: letter portrait; margin: 0; }
    }
  </style></head>
  <body>${sheets}</body></html>`;
}
