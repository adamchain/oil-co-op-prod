export const MEMBERSHIP_PLANS = ["standard", "senior", "lowVolume"] as const;
export type MembershipPlanId = (typeof MEMBERSHIP_PLANS)[number];

export const MEMBERSHIP_PLAN_META: Record<
  MembershipPlanId,
  { id: MembershipPlanId; label: string; annualCents: number }
> = {
  standard: { id: "standard", label: "Standard membership", annualCents: 3500 },
  senior: { id: "senior", label: "Senior membership (55+)", annualCents: 2500 },
  lowVolume: { id: "lowVolume", label: "Low volume membership", annualCents: 2000 },
};

export function isMembershipPlanId(v: unknown): v is MembershipPlanId {
  return v === "standard" || v === "senior" || v === "lowVolume";
}

export function planFlags(plan: MembershipPlanId) {
  return {
    membershipPlan: plan,
    standardMembership: plan === "standard",
    seniorMember: plan === "senior",
    lowVolume: plan === "lowVolume",
  };
}

/** June 1 starts the membership year. Before that date, the current year is the previous June. */
export function currentBillingYear(now = new Date()): number {
  const y = now.getUTCFullYear();
  const passed = now.getUTCMonth() > 5 || (now.getUTCMonth() === 5 && now.getUTCDate() >= 1);
  return passed ? y : y - 1;
}

const PAID_MEMBERSHIP_STATUS = new Set(["succeeded", "waived", "paid", "mock"]);

export function membershipPaidForYear(
  billing: Array<{ billingYear?: number; status?: string; kind?: string }>,
  year: number
): boolean {
  return billing.some((row) => {
    if (row.billingYear !== year) return false;
    if (row.kind === "registration") return false;
    return PAID_MEMBERSHIP_STATUS.has(String(row.status || ""));
  });
}

export function resolveMembershipPlan(input: {
  membershipPlan?: unknown;
  legacyProfile?: unknown;
}): MembershipPlanId {
  const lp =
    input.legacyProfile && typeof input.legacyProfile === "object"
      ? (input.legacyProfile as Record<string, unknown>)
      : {};
  if (lp.seniorMember === true) return "senior";
  if (lp.lowVolume === true) return "lowVolume";
  if (lp.standardMembership === true) return "standard";
  if (isMembershipPlanId(lp.membershipPlan)) return lp.membershipPlan;
  if (isMembershipPlanId(input.membershipPlan)) return input.membershipPlan;
  return "standard";
}

export function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
