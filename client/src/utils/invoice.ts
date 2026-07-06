/**
 * Membership-renewal paper invoices — printable sheets that match the Co-op's
 * mailer. Sheets are laid out THREE to a letter page and the recipient block
 * sits so it shows through a #10 window envelope after folding, matching the
 * Approach mail-merge the office prints today.
 *
 * Two variants: the regular renewal and a PAST DUE notice, which adds a $10
 * late fee to each price and swaps in the past-due heading.
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
  /** Base dollar amounts (whole dollars) before any late fee. */
  memberPrice?: number;
  seniorPrice?: number;
  /** Past-due notice: adds the late fee to each price and shows the past-due heading. */
  pastDue?: boolean;
  /** Late fee added to each price on past-due notices (whole dollars). */
  lateFee?: number;
  /** Printed date (defaults to today, M/D/YYYY). */
  dateStr?: string;
  /** PDF only: nudge the recipient block right/down (inches) to align with the #10 window. */
  winLeftIn?: number;
  winTopIn?: number;
};

const RETURN_ADDRESS = [
  "P.O. Box 271718",
  "West Hartford, CT 06127",
  "Phone (860) 561-6011",
  "www.oilco-op.com",
];
const RETURN_NAME = "Citizen's Oil Co-op, Inc.";

/** Sheets printed on a single letter page. */
const PER_PAGE = 3;

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

type ResolvedOptions = Required<Omit<InvoiceOptions, "winLeftIn" | "winTopIn">>;

function invoiceSheetHtml(m: InvoiceMember, o: ResolvedOptions): string {
  const recipientLines = [m.name1, m.name2, m.addressLine1, m.addressLine2, m.cityStateZip]
    .map((l) => String(l || "").trim())
    .filter(Boolean)
    .map((l) => escapeHtml(l))
    .join("<br>");

  const returnLines = RETURN_ADDRESS.map((l) => escapeHtml(l)).join("<br>");

  const title = o.pastDue
    ? `${escapeHtml(o.season)} membership renewal - PAST DUE`
    : `${escapeHtml(o.season)} membership renewal`;
  const subtitle = o.pastDue
    ? `<div class="inv-subtitle">Included is a $${o.lateFee}.00 late fee.</div>`
    : "";

  return `
  <div class="inv-sheet">
    <div class="inv-box">
      <div class="inv-title">${title}</div>
      ${subtitle}
      <div class="inv-prices">
        <span>&#9744;&nbsp; $${o.memberPrice}.00 Member</span>
        <span>&#9744;&nbsp; $${o.seniorPrice}.00 Senior Citizen</span>
      </div>
      <div class="inv-center">Checks payable: Citizen&#39;s Oil Co-op, Inc. or go to oilco-op.com. Thank you.</div>
      <div class="inv-center inv-note">Please email meredith@oilco-op.com if you are no longer using the Co-op.</div>
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

/** Group sheets into letter pages of PER_PAGE each. */
function paginate(sheets: string[]): string {
  const pages: string[] = [];
  for (let i = 0; i < sheets.length; i += PER_PAGE) {
    pages.push(`<div class="inv-page">${sheets.slice(i, i + PER_PAGE).join("\n")}</div>`);
  }
  return pages.join("\n");
}

/** Full printable HTML document, three invoice sheets per letter page. */
export function buildMembershipInvoiceDocument(members: InvoiceMember[], options: InvoiceOptions = {}): string {
  const baseMember = options.memberPrice ?? 35;
  const baseSenior = options.seniorPrice ?? 25;
  const lateFee = options.lateFee ?? 10;
  const pastDue = options.pastDue ?? false;
  const o: ResolvedOptions = {
    season: options.season || currentMembershipSeason(),
    memberPrice: baseMember + (pastDue ? lateFee : 0),
    seniorPrice: baseSenior + (pastDue ? lateFee : 0),
    pastDue,
    lateFee,
    dateStr: options.dateStr || todayShort(),
  };

  const body = members.length
    ? paginate(members.map((m) => invoiceSheetHtml(m, o)))
    : `<div class="inv-page"><div class="inv-sheet"><p style="text-align:center;color:#555;">No members to print.</p></div></div>`;

  const titleLabel = pastDue ? "Past-Due Invoices" : "Membership Invoices";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <title>${titleLabel} (${members.length})</title>
  <style>
    :root { --win-left: 0.55in; --win-top: 0in; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #e5e5e5; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; }

    .inv-page {
      background: #fff;
      width: 8.5in;
      margin: 0.25in auto;
      padding: 0.4in 0.5in;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    }

    .inv-sheet {
      height: 3.35in;
      padding: 0.1in 0.25in 0;
      overflow: hidden;
    }

    .inv-box {
      border: 1.5px solid #000;
      border-radius: 16px;
      padding: 10px 20px 12px;
      max-width: 6.4in;
      margin: 0 auto 14px;
    }
    .inv-title { text-align: center; font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .inv-subtitle { text-align: center; font-size: 13px; margin-bottom: 8px; }
    .inv-prices { display: flex; justify-content: center; gap: 48px; font-size: 13px; font-weight: 600; margin: 8px 0; }
    .inv-center { text-align: center; font-size: 12.5px; margin-bottom: 6px; }
    .inv-note { margin-bottom: 0; }

    .inv-meta { display: flex; justify-content: space-between; align-items: flex-start; margin: 6px 2px 22px; }
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
      .inv-page {
        width: auto;
        margin: 0;
        padding: 0.5in 0.6in;
        box-shadow: none;
        page-break-after: always;
      }
      .inv-page:last-child { page-break-after: auto; }
      @page { size: letter portrait; margin: 0; }
    }
  </style></head>
  <body>${body}</body></html>`;
}
