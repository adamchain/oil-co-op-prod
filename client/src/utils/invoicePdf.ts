/**
 * Vector PDF of the membership-renewal invoices — three sheets to a letter page,
 * every element placed at exact inch coordinates. Unlike printing the HTML from
 * the browser (which lets the print dialog add margins and scale the page), this
 * produces a fixed-size letter PDF, so the recipient address lands in the same
 * spot every time and shows through a #10 window envelope.
 *
 * The two window knobs (winLeftIn / winTopIn) nudge the recipient block after a
 * test print without touching anything else.
 */
import { jsPDF } from "jspdf";
import {
  type InvoiceMember,
  type InvoiceOptions,
  currentMembershipSeason,
  todayShort,
} from "./invoice";

const RETURN_ADDRESS = [
  "P.O. Box 271718",
  "West Hartford, CT 06127",
  "Phone (860) 561-6011",
  "www.oilco-op.com",
];
const RETURN_NAME = "Citizen's Oil Co-op, Inc.";

// Letter page, all measurements in inches.
const PAGE_W = 8.5;
const PAGE_H = 11;
const PER_PAGE = 3;
const MARGIN_TOP = 0.5;
const SHEET_H = (PAGE_H - MARGIN_TOP * 2) / PER_PAGE;

const BOX_W = 6.5;
const BOX_X = (PAGE_W - BOX_W) / 2;
const BOX_CX = PAGE_W / 2;

// pt → inch helper for baseline advances.
const pt = (n: number) => n / 72;

type Resolved = {
  season: string;
  memberPrice: number;
  seniorPrice: number;
  pastDue: boolean;
  lateFee: number;
  dateStr: string;
  winLeftIn: number;
  winTopIn: number;
};

function drawSheet(doc: jsPDF, m: InvoiceMember, o: Resolved, sheetTop: number) {
  // ---- Box + its contents ----
  const boxTop = sheetTop + 0.12;
  const pad = 0.16;
  let y = boxTop + pad + pt(12.5);

  const draw: Array<() => void> = [];

  // Title
  draw.push(() => {
    doc.setFont("helvetica", "bold").setFontSize(12.5);
    const title = o.pastDue
      ? `${o.season} membership renewal - PAST DUE`
      : `${o.season} membership renewal`;
    doc.text(title, BOX_CX, titleY, { align: "center" });
  });
  const titleY = y;
  y += pt(14);

  // Subtitle (past due only)
  let subtitleY = 0;
  if (o.pastDue) {
    y += pt(2);
    subtitleY = y;
    draw.push(() => {
      doc.setFont("helvetica", "normal").setFontSize(10);
      doc.text(`Included is a $${o.lateFee}.00 late fee.`, BOX_CX, subtitleY, { align: "center" });
    });
    y += pt(13);
  }

  // Prices row with checkboxes
  y += pt(6);
  const priceY = y;
  draw.push(() => {
    doc.setFont("helvetica", "bold").setFontSize(10.5);
    const cb = 0.12;
    // Member (left column)
    doc.rect(1.95, priceY - cb, cb, cb);
    doc.text(`$${o.memberPrice}.00 Member`, 2.18, priceY, { align: "left" });
    // Senior (right column)
    doc.rect(4.55, priceY - cb, cb, cb);
    doc.text(`$${o.seniorPrice}.00 Senior Citizen`, 4.78, priceY, { align: "left" });
  });
  y += pt(15);

  // Checks-payable line
  const checksY = y;
  draw.push(() => {
    doc.setFont("helvetica", "normal").setFontSize(9.5);
    doc.text(
      "Checks payable: Citizen's Oil Co-op, Inc. or go to oilco-op.com. Thank you.",
      BOX_CX,
      checksY,
      { align: "center" }
    );
  });
  y += pt(13);

  // "No longer using the Co-op" line
  const emailY = y;
  draw.push(() => {
    doc.setFont("helvetica", "normal").setFontSize(9.5);
    doc.text(
      "Please email meredith@oilco-op.com if you are no longer using the Co-op.",
      BOX_CX,
      emailY,
      { align: "center" }
    );
  });
  y += pt(2);

  const boxBottom = y + pad;
  // Draw the rounded box behind the text first, then the text on top.
  doc.setDrawColor(0).setLineWidth(0.012);
  doc.roundedRect(BOX_X, boxTop, BOX_W, boxBottom - boxTop, 0.13, 0.13, "S");
  draw.forEach((fn) => fn());

  // ---- Meta row: MEMBER ID / OIL COMPANY (left), date / MEMBER SINCE (right) ----
  const metaLeftX = 0.9;
  const metaRightX = PAGE_W - 0.9;
  const metaY = boxBottom + 0.3;

  doc.setTextColor(0);
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("MEMBER ID:", metaLeftX, metaY);
  const idLabelW = doc.getTextWidth("MEMBER ID: ");
  doc.setFont("helvetica", "normal");
  doc.text(m.memberNumber || "—", metaLeftX + idLabelW + 0.05, metaY);

  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("OIL COMPANY:", metaLeftX, metaY + 0.2);
  const ocLabelW = doc.getTextWidth("OIL COMPANY: ");
  doc.setFont("helvetica", "normal");
  doc.text((m.oilCompany || "—").toUpperCase(), metaLeftX + ocLabelW + 0.05, metaY + 0.2);

  doc.setFont("helvetica", "bold").setFontSize(10.5);
  doc.text(o.dateStr, metaRightX, metaY, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  doc.setTextColor(60);
  const sinceLabel = "MEMBER SINCE  ";
  doc.text(sinceLabel + (m.memberSince || "—"), metaRightX, metaY + 0.18, { align: "right" });
  doc.setTextColor(0);

  // ---- Address blocks ----
  const addrY = metaY + 0.62;

  // Recipient — this is the block that must show through the #10 window.
  const recipient = [m.name1, m.name2, m.addressLine1, m.addressLine2, m.cityStateZip]
    .map((l) => String(l || "").trim())
    .filter(Boolean);
  doc.setFont("helvetica", "normal").setFontSize(10.5);
  recipient.forEach((line, i) => {
    doc.text(line, metaLeftX + o.winLeftIn, addrY + o.winTopIn + i * 0.185);
  });

  // Return address (right side, printed on the face — not in the window).
  const retX = 5.0;
  doc.setFont("helvetica", "bold").setFontSize(9.5);
  doc.text(RETURN_NAME, retX, addrY);
  doc.setFont("helvetica", "normal");
  RETURN_ADDRESS.forEach((line, i) => {
    doc.text(line, retX, addrY + 0.17 + i * 0.17);
  });
}

function resolve(options: InvoiceOptions): Resolved {
  const baseMember = options.memberPrice ?? 35;
  const baseSenior = options.seniorPrice ?? 25;
  const lateFee = options.lateFee ?? 10;
  const pastDue = options.pastDue ?? false;
  return {
    season: options.season || currentMembershipSeason(),
    memberPrice: baseMember + (pastDue ? lateFee : 0),
    seniorPrice: baseSenior + (pastDue ? lateFee : 0),
    pastDue,
    lateFee,
    dateStr: options.dateStr || todayShort(),
    // Window nudge knobs — offsets from the base recipient position, in inches.
    winLeftIn: options.winLeftIn ?? 0,
    winTopIn: options.winTopIn ?? 0,
  };
}

/** Build the invoice PDF (three sheets per letter page). */
export function buildMembershipInvoicePdf(members: InvoiceMember[], options: InvoiceOptions = {}): jsPDF {
  const o = resolve(options);
  const doc = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });

  const list = members.length ? members : [];
  list.forEach((m, i) => {
    const slot = i % PER_PAGE;
    if (i > 0 && slot === 0) doc.addPage();
    drawSheet(doc, m, o, MARGIN_TOP + slot * SHEET_H);
  });

  if (list.length === 0) {
    doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(90);
    doc.text("No members to print.", PAGE_W / 2, PAGE_H / 2, { align: "center" });
  }
  return doc;
}

/** Build and trigger a download of the invoice PDF. */
export function downloadMembershipInvoicePdf(members: InvoiceMember[], options: InvoiceOptions = {}): void {
  const o = resolve(options);
  const doc = buildMembershipInvoicePdf(members, options);
  const stamp = o.dateStr.replace(/\//g, "-");
  const kind = o.pastDue ? "past-due" : "renewal";
  doc.save(`membership-${kind}-invoices-${stamp}.pdf`);
}
