import { Member } from "../models/Member.js";
import { addressesLooselyMatch, normalizePostalCode, type AddressParts } from "../utils/address.js";
import { phoneDigits, phoneFlexibleRegex } from "../utils/phone.js";

type MemberInstance = InstanceType<typeof Member>;

export type AccountMatchHint = {
  matchedBy: "email" | "phone" | "address";
  maskedName: string;
  city: string;
  state: string;
  maskedEmail: string;
  maskedPhone: string;
  /** Existing primary address summary for "is this you?" */
  existingAddress: string;
};

function maskName(first: string, last: string): string {
  const f = (first || "").trim();
  const l = (last || "").trim();
  const mask = (s: string) => (s.length <= 1 ? s : `${s[0]}${"*".repeat(Math.min(s.length - 1, 4))}`);
  return [mask(f), mask(l)].filter(Boolean).join(" ") || "Member";
}

function maskEmail(email: string | undefined | null): string {
  const e = (email || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return "";
  const [local, domain] = e.split("@");
  const localMask = local.length <= 1 ? "*" : `${local[0]}${"*".repeat(Math.min(local.length - 1, 3))}`;
  return `${localMask}@${domain}`;
}

function maskPhone(phone: string | undefined | null): string {
  const d = phoneDigits(phone);
  if (d.length < 4) return "";
  return `(***) ***-${d.slice(-4)}`;
}

function formatExistingAddress(m: MemberInstance): string {
  const parts = [m.addressLine1, m.city, m.state, m.postalCode].filter((p) => String(p || "").trim());
  return parts.join(", ");
}

export function toMatchHint(
  m: MemberInstance,
  matchedBy: "email" | "phone" | "address"
): AccountMatchHint {
  return {
    matchedBy,
    maskedName: maskName(m.firstName, m.lastName),
    city: m.city || "",
    state: m.state || "",
    maskedEmail: maskEmail(m.email),
    maskedPhone: maskPhone(m.phone),
    existingAddress: formatExistingAddress(m),
  };
}

export async function findMemberByEmail(email: string | undefined | null): Promise<MemberInstance | null> {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return null;
  return Member.findOne({ email: normalized });
}

export async function findMemberByPhone(phone: string | undefined | null): Promise<MemberInstance | null> {
  const digits = phoneDigits(phone);
  if (digits.length < 10) return null;

  const byDigits = await Member.findOne({ phoneDigits: digits });
  if (byDigits) return byDigits;

  const flex = phoneFlexibleRegex(digits);
  if (!flex) return null;

  const candidates = await Member.find({
    $or: [
      { phone: flex },
      { "legacyProfile.phone2": flex },
      { "legacyProfile.phone3": flex },
    ],
  }).limit(40);

  for (const m of candidates) {
    const lp = m.legacyProfile as { phone2?: string; phone3?: string } | undefined;
    const phones = [m.phone, lp?.phone2, lp?.phone3];
    if (phones.some((p) => phoneDigits(p) === digits)) return m;
  }
  return null;
}

type PropertyRow = {
  _id?: { toString(): string };
  label?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  isPrimary?: boolean;
};

function memberAddresses(m: MemberInstance): AddressParts[] {
  const list: AddressParts[] = [
    {
      addressLine1: m.addressLine1,
      addressLine2: m.addressLine2,
      city: m.city,
      state: m.state,
      postalCode: m.postalCode,
    },
  ];
  const props = (m.properties || []) as unknown as PropertyRow[];
  for (const p of props) {
    list.push({
      addressLine1: p.addressLine1,
      addressLine2: p.addressLine2,
      city: p.city,
      state: p.state,
      postalCode: p.postalCode,
    });
  }
  return list;
}

export async function findMemberByAddress(input: AddressParts): Promise<MemberInstance | null> {
  const zip5 = normalizePostalCode(input.postalCode);
  const street = String(input.addressLine1 || "").trim();
  if (!zip5 || zip5.length < 5 || !street) return null;

  const zipRe = new RegExp(`^${zip5}`);
  const candidates = await Member.find({
    $or: [{ postalCode: zipRe }, { "properties.postalCode": zipRe }],
  }).limit(60);

  for (const m of candidates) {
    if (memberAddresses(m).some((addr) => addressesLooselyMatch(input, addr))) {
      return m;
    }
  }
  return null;
}

/** Prefer email, then phone(s), then address. */
export async function findExistingAccount(input: {
  email?: string;
  phone?: string;
  phone2?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}): Promise<{ member: MemberInstance; matchedBy: "email" | "phone" | "address" } | null> {
  const byEmail = await findMemberByEmail(input.email);
  if (byEmail) return { member: byEmail, matchedBy: "email" };

  for (const phone of [input.phone, input.phone2]) {
    const byPhone = await findMemberByPhone(phone);
    if (byPhone) return { member: byPhone, matchedBy: "phone" };
  }

  const byAddress = await findMemberByAddress({
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
  });
  if (byAddress) return { member: byAddress, matchedBy: "address" };

  return null;
}

export function memberContactMatches(
  member: MemberInstance,
  confirmingEmail?: string,
  confirmingPhone?: string
): boolean {
  const email = (confirmingEmail || "").trim().toLowerCase();
  if (email && member.email && member.email.toLowerCase() === email) return true;

  const digits = phoneDigits(confirmingPhone);
  if (digits.length >= 10) {
    if (member.phoneDigits === digits || phoneDigits(member.phone) === digits) return true;
    const lp = member.legacyProfile as { phone2?: string; phone3?: string } | undefined;
    if (phoneDigits(lp?.phone2) === digits || phoneDigits(lp?.phone3) === digits) return true;
  }
  return false;
}

export type PropertyInput = {
  label?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
};

/** Ensure properties[] includes at least the primary top-level address. */
export function ensurePrimaryProperty(member: MemberInstance): void {
  if (!member.properties) {
    member.properties = [] as unknown as MemberInstance["properties"];
  }
  const props = member.properties as unknown as PropertyRow[];
  const hasAddress = Boolean(String(member.addressLine1 || "").trim());
  if (!hasAddress) return;

  const primaryExists = props.some(
    (p) =>
      p.isPrimary ||
      (String(p.addressLine1 || "").trim().toLowerCase() === String(member.addressLine1 || "").trim().toLowerCase() &&
        String(p.postalCode || "").trim() === String(member.postalCode || "").trim())
  );

  if (!primaryExists) {
    member.properties.unshift({
      label: "Primary",
      addressLine1: member.addressLine1 || "",
      addressLine2: member.addressLine2 || "",
      city: member.city || "",
      state: member.state || "",
      postalCode: member.postalCode || "",
      isPrimary: true,
    });
  } else if (!props.some((p) => p.isPrimary) && props.length) {
    props[0].isPrimary = true;
  }
}

export function serializeProperties(member: MemberInstance) {
  ensurePrimaryProperty(member);
  const props = (member.properties || []) as unknown as PropertyRow[];
  if (props.length === 0 && member.addressLine1) {
    return [
      {
        id: "primary",
        label: "Primary",
        addressLine1: member.addressLine1 || "",
        addressLine2: member.addressLine2 || "",
        city: member.city || "",
        state: member.state || "",
        postalCode: member.postalCode || "",
        isPrimary: true,
      },
    ];
  }
  return props.map((p) => ({
    id: String(p._id?.toString?.() ?? ""),
    label: p.label || "",
    addressLine1: p.addressLine1 || "",
    addressLine2: p.addressLine2 || "",
    city: p.city || "",
    state: p.state || "",
    postalCode: p.postalCode || "",
    isPrimary: Boolean(p.isPrimary),
  }));
}

export async function addPropertyToMember(member: MemberInstance, property: PropertyInput) {
  ensurePrimaryProperty(member);
  member.properties.push({
    label: property.label || "Additional property",
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2 || "",
    city: property.city,
    state: property.state,
    postalCode: property.postalCode,
    isPrimary: false,
  });
  await member.save();
  return serializeProperties(member);
}
