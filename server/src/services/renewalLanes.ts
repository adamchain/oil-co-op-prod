import { annualFeeCentsFor } from "../utils/membershipFees.js";

/**
 * Who belongs on the renewal lists.
 *
 * Active members are people using the co-op: an oil or propane account that is
 * still in service, or a membership that was paid in the last renewal or this
 * one. Lifetime members stay in that count and are not charged.
 *
 * Auto-renew is the slice with a payment method on file (a card saved here, or
 * a card that was charged for both the prior June and the current June).
 * Everyone else in the active book is the manual lane.
 *
 * After June 1, auto-renew splits into paid vs payment failed, and the manual
 * lane that has not paid is on hold.
 */

export type RenewalCycle = {
  currentBillingYear: number;
  priorBillingYear: number;
  nextRenewalYear: number;
};

export function renewalCycle(now = new Date()): RenewalCycle {
  const y = now.getUTCFullYear();
  const passed = now.getUTCMonth() > 5 || (now.getUTCMonth() === 5 && now.getUTCDate() >= 1);
  const currentBillingYear = passed ? y : y - 1;
  return {
    currentBillingYear,
    priorBillingYear: currentBillingYear - 1,
    nextRenewalYear: currentBillingYear + 1,
  };
}

export type LaneMember = {
  role?: string;
  status?: string;
  paymentMethod?: string;
  autoRenew?: boolean;
  lifetimeAnnualFeeWaived?: boolean;
  primaryMemberId?: unknown;
  authnetPaymentProfileId?: string;
  stripeDefaultPaymentMethodId?: string;
  createdAt?: Date | string | null;
  membershipPlan?: string;
  legacyProfile?: Record<string, unknown> | null;
};

export type RenewalClass = {
  activeService: boolean;
  lifetime: boolean;
  /** Card on file for the upcoming June 1. */
  autoRenew: boolean;
  manual: boolean;
  paidCurrent: boolean;
  /** Had a card going into the June 1 that already passed, and has not paid. */
  paymentFailed: boolean;
  /** Manual lane, and has not paid the June 1 that already passed. */
  onHold: boolean;
};

const CARD_METHOD = /AUTH|CREDIT|PAYPAL|CARD|VISA|MASTER/;

function text(v: unknown): string {
  return String(v ?? "").trim();
}

function yes(v: unknown): boolean {
  if (v === true) return true;
  const s = text(v).toLowerCase();
  return s === "y" || s === "yes" || s === "true" || s === "1" || s === "x";
}

function billingYear(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(text(v));
  if (!Number.isFinite(n) || n < 1990 || n > 2100) return null;
  return n;
}

function isCardMethod(method: unknown): boolean {
  const s = text(method).toUpperCase();
  return s.length > 0 && CARD_METHOD.test(s);
}

function paymentYears(lp: Record<string, unknown>, cardOnly: boolean): Set<number> {
  const rows = Array.isArray(lp.paymentsHistory) ? lp.paymentsHistory : [];
  const years = new Set<number>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { billingYear?: unknown; paymentMethod?: unknown };
    const year = billingYear(rec.billingYear);
    if (year == null) continue;
    if (cardOnly && !isCardMethod(rec.paymentMethod)) continue;
    years.add(year);
  }
  return years;
}

function maxDeliveryYear(lp: Record<string, unknown>): number {
  const rows = Array.isArray(lp.deliveryHistoryRows) ? lp.deliveryHistoryRows : [];
  let max = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const year = billingYear((row as { deliveryYear?: unknown }).deliveryYear);
    if (year != null && year > max) max = year;
  }
  return max;
}

function hasVaultedCard(m: LaneMember): boolean {
  return Boolean(text(m.authnetPaymentProfileId) || text(m.stripeDefaultPaymentMethodId));
}

/** A saved card with auto-renew turned off is an opt-out. Imported records default autoRenew to false and have no vault, so that default is not an opt-out. */
function optedOutOfAutoRenew(m: LaneMember): boolean {
  return m.autoRenew === false && hasVaultedCard(m);
}

function isLifetime(m: LaneMember, lp: Record<string, unknown>): boolean {
  return Boolean(m.lifetimeAnnualFeeWaived || yes(lp.waiveFeeLifetime) || m.primaryMemberId);
}

export function isActiveServiceMember(m: LaneMember, cycle: RenewalCycle = renewalCycle()): boolean {
  if (m.role && m.role !== "member") return false;
  const lp = (m.legacyProfile || {}) as Record<string, unknown>;
  const workbench = text(lp.workbenchMemberStatus).toUpperCase();
  if (m.status === "cancelled" || workbench === "CANCELLED") return false;

  const payYears = paymentYears(lp, false);
  const paidRecently = [...payYears].some((y) => y >= cycle.priorBillingYear);
  const deliveredRecently = maxDeliveryYear(lp) >= cycle.priorBillingYear;
  const oilActive = text(lp.oilWorkbenchStatus).toUpperCase() === "ACTIVE";
  const propaneActive = text(lp.propaneStatus).toUpperCase() === "ACTIVE";
  const fuelId = Boolean(text(lp.oilId) || text(lp.propaneId));
  if (paidRecently || deliveredRecently || oilActive || propaneActive) return true;
  if (isLifetime(m, lp) && fuelId) return true;

  // Bulk imports share one createdAt, so only real signups use the join date.
  if (m.status === "active" && !text(lp.importSource) && m.createdAt) {
    const created = new Date(m.createdAt);
    const seasonStart = Date.UTC(cycle.priorBillingYear, 5, 1);
    if (!Number.isNaN(created.getTime()) && created.getTime() >= seasonStart) return true;
  }
  return false;
}

export function classifyRenewalMember(m: LaneMember, cycle: RenewalCycle = renewalCycle()): RenewalClass {
  const empty: RenewalClass = {
    activeService: false,
    lifetime: false,
    autoRenew: false,
    manual: false,
    paidCurrent: false,
    paymentFailed: false,
    onHold: false,
  };
  if (!isActiveServiceMember(m, cycle)) return empty;

  const lp = (m.legacyProfile || {}) as Record<string, unknown>;
  const lifetime = isLifetime(m, lp);
  if (lifetime) return { ...empty, activeService: true, lifetime: true };

  const cardYears = paymentYears(lp, true);
  const payYears = paymentYears(lp, false);
  const optedOut = optedOutOfAutoRenew(m);
  const vaulted = hasVaultedCard(m) && !optedOut;
  const cardBothSeasons = cardYears.has(cycle.priorBillingYear) && cardYears.has(cycle.currentBillingYear);
  const onFile = vaulted || cardBothSeasons;
  const wasAuto = !optedOut && (hasVaultedCard(m) || cardYears.has(cycle.priorBillingYear));
  const paidCurrent = payYears.has(cycle.currentBillingYear);

  return {
    activeService: true,
    lifetime: false,
    autoRenew: onFile,
    manual: !onFile,
    paidCurrent,
    paymentFailed: !paidCurrent && wasAuto,
    onHold: !paidCurrent && !wasAuto,
  };
}

export function renewalAmountCents(m: LaneMember): number {
  const lp = { ...((m.legacyProfile || {}) as Record<string, unknown>) };
  if (lp.seniorMember !== true && (yes(lp.seniorFlag) || yes(lp.SENIOR))) lp.seniorMember = true;
  if (lp.lowVolume !== true && yes(lp.lowVolume)) lp.lowVolume = true;
  return annualFeeCentsFor({ membershipPlan: m.membershipPlan, legacyProfile: lp });
}
