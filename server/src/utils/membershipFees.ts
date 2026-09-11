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

/** One-time application / processing fee charged at join. */
export const APPLICATION_FEE_CENTS = 1000;

export function isMembershipPlanId(v: unknown): v is MembershipPlanId {
  return v === "standard" || v === "senior" || v === "lowVolume";
}

export function planFlags(plan: MembershipPlanId): {
  membershipPlan: MembershipPlanId;
  standardMembership: boolean;
  seniorMember: boolean;
  lowVolume: boolean;
} {
  return {
    membershipPlan: plan,
    standardMembership: plan === "standard",
    seniorMember: plan === "senior",
    lowVolume: plan === "lowVolume",
  };
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

export function annualFeeCentsFor(input: {
  membershipPlan?: unknown;
  legacyProfile?: unknown;
}): number {
  return MEMBERSHIP_PLAN_META[resolveMembershipPlan(input)].annualCents;
}

export function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function syncMembershipPlanFields(member: {
  membershipPlan?: unknown;
  legacyProfile?: unknown;
  markModified?: (k: string) => void;
}): MembershipPlanId {
  const plan = resolveMembershipPlan(member);
  member.membershipPlan = plan;
  const prev =
    member.legacyProfile && typeof member.legacyProfile === "object"
      ? (member.legacyProfile as Record<string, unknown>)
      : {};
  member.legacyProfile = { ...prev, ...planFlags(plan) };
  member.markModified?.("legacyProfile");
  return plan;
}
