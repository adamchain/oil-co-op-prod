import mongoose from "mongoose";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { Referral } from "../models/Referral.js";
import {
  namesLooselyMatch,
  oilCompanyAliases,
  oilCompanyCodeFromNotes,
} from "./oilCompanyCodes.js";

export type EncodedMemberFilter = { field: string; operator: string; value: string };

export function parseEncodedFilters(encoded: string): EncodedMemberFilter[] {
  if (!encoded) return [];
  try {
    const parsed = JSON.parse(encoded);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry): EncodedMemberFilter | null => {
        if (!Array.isArray(entry) || entry.length < 3) return null;
        const [field, operator, value] = entry as [unknown, unknown, unknown];
        if (typeof field !== "string" || typeof operator !== "string") return null;
        return { field, operator, value: typeof value === "string" ? value : "" };
      })
      .filter((f): f is EncodedMemberFilter => f !== null);
  } catch {
    return [];
  }
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pushAnd(filter: Record<string, unknown>, clause: Record<string, unknown>) {
  filter.$and = [...((filter.$and as unknown[] | undefined) || []), clause];
}

type OilCompanyLean = { _id: mongoose.Types.ObjectId; name?: string; notes?: string };

export async function oilCompanyMatchOr(oilCompanyId: string): Promise<Record<string, unknown> | null> {
  if (!mongoose.isValidObjectId(oilCompanyId)) return null;
  const oid = new mongoose.Types.ObjectId(oilCompanyId);
  const selected = (await OilCompany.findById(oid).select("name notes").lean()) as OilCompanyLean | null;
  const selectedName = String(selected?.name || "").trim();
  const selectedCode = oilCompanyCodeFromNotes(selected?.notes);
  const allCos = (await OilCompany.find({}).select("_id name notes").lean()) as OilCompanyLean[];
  const related = allCos.filter((c) => {
    if (String(c._id) === String(oid)) return true;
    return selectedName ? namesLooselyMatch(String(c.name || ""), selectedName) : false;
  });
  const relatedIds = related.map((c) => c._id);
  const extraCodes = [
    selectedCode,
    ...related.map((c) => oilCompanyCodeFromNotes(c.notes)),
  ];
  const linkedCodes = await Member.distinct("legacyProfile.oilCoRaw", {
    oilCompanyId: { $in: relatedIds.length ? relatedIds : [oid] },
  });
  extraCodes.push(...linkedCodes.map((c) => String(c || "")));
  const aliases = oilCompanyAliases(selectedName, extraCodes);

  const or: Record<string, unknown>[] = [
    { oilCompanyId: { $in: relatedIds.length ? relatedIds : [oid] } },
  ];
  if (aliases.names.length) {
    const nameRx = aliases.names.map((n) => escapeRx(n)).join("|");
    or.push({ "legacyProfile.oilCompanyName": { $regex: nameRx, $options: "i" } });
  }
  if (aliases.codes.length) {
    const codeRx = aliases.codes.map((c) => `^${escapeRx(c)}$`).join("|");
    or.push({ "legacyProfile.oilCoRaw": { $regex: codeRx, $options: "i" } });
  }
  return { $or: or };
}

function cityMatchClause(operator: string, value: string): Record<string, unknown> | null {
  if (operator === "is_empty") {
    return {
      $and: [
        { $or: [{ city: { $in: ["", null] } }, { city: { $exists: false } }] },
        {
          $or: [
            { "legacyProfile.mailCity": { $in: ["", null] } },
            { "legacyProfile.mailCity": { $exists: false } },
          ],
        },
      ],
    };
  }
  if (operator === "is_not_empty") {
    return {
      $or: [
        { city: { $nin: ["", null] } },
        { "legacyProfile.mailCity": { $nin: ["", null] } },
      ],
    };
  }
  const raw = value.trim();
  if (!raw) return null;
  const escaped = escapeRx(raw);
  const rx =
    operator === "equals"
      ? new RegExp(`^${escaped}$`, "i")
      : operator === "starts_with"
        ? new RegExp(`^${escaped}`, "i")
        : new RegExp(escaped, "i");
  return { $or: [{ city: rx }, { "legacyProfile.mailCity": rx }] };
}

const YES_RX = /^(y|yes|true|1|x|senior|checked|t|-1|on)$/i;

/** First non-blank path wins, matching workbench hydration. */
const TEXT_PATHS: Record<string, string[]> = {
  "legacyProfile.phone2": ["legacyProfile.phone2", "legacyProfile.PHONE_2", "legacyProfile.Phone2"],
  "legacyProfile.phone3": ["legacyProfile.phone3", "legacyProfile.PHONE_3", "legacyProfile.Phone3"],
};

const DATE_PATHS: Record<string, string[]> = {
  "legacyProfile.newMemberDt": [
    "legacyProfile.newMemberDt",
    "legacyProfile.NEW_MEMBER",
    "legacyProfile.NEW_MEM_DT",
    "legacyProfile.NEW_MEM_DA",
    "legacyProfile.dateAdd",
    "legacyProfile.DATE_ADD",
  ],
  "legacyProfile.originalStartDate": [
    "legacyProfile.originalStartDate",
    "legacyProfile.ORIG_START",
    "legacyProfile.ORIGINAL_S",
    "legacyProfile.ORIG_DATE",
    "legacyProfile.DATE_START",
    "legacyProfile.START_DATE",
    "legacyProfile.FIRST_DATE",
    "legacyProfile.origStart",
  ],
  "legacyProfile.oilStartDate": [
    "legacyProfile.oilStartDate",
    "legacyProfile.newMemberDt",
    "legacyProfile.NEW_MEMBER",
  ],
};

const BOOL_FIELDS: Record<string, { path: string; aliases: string[]; also?: string }> = {
  "legacyProfile.standardMembership": { path: "legacyProfile.standardMembership", aliases: [] },
  "legacyProfile.seniorMember": {
    path: "legacyProfile.seniorMember",
    aliases: ["legacyProfile.seniorFlag", "legacyProfile.SENIOR"],
  },
  "legacyProfile.lowVolume": { path: "legacyProfile.lowVolume", aliases: ["legacyProfile.LOW_VOLUME"] },
  "legacyProfile.waiveFeeLifetime": {
    path: "legacyProfile.waiveFeeLifetime",
    aliases: ["legacyProfile.LIFETIME_M", "legacyProfile.WAIVE_FEE_"],
    also: "lifetimeAnnualFeeWaived",
  },
  "legacyProfile.mailAddr": { path: "legacyProfile.mailAddr", aliases: ["legacyProfile.MAIL_ADDR"] },
  "legacyProfile.callBack": {
    path: "legacyProfile.callBack",
    aliases: ["legacyProfile.CALL_BACK", "legacyProfile.CALLBACK"],
  },
  "legacyProfile.emailOptOut": {
    path: "legacyProfile.emailOptOut",
    aliases: ["legacyProfile.EMAIL_OPT", "legacyProfile.OPT_OUT", "legacyProfile.OPTED_OUT"],
  },
  renewalOnHold: { path: "renewalOnHold", aliases: [] },
  "legacyProfile.nrdOil": {
    path: "legacyProfile.nrdOil",
    aliases: [
      "legacyProfile.NRD-OI",
      "legacyProfile.NRD-OIL",
      "legacyProfile.NRD_OIL",
      "legacyProfile.NRD OIL",
      "legacyProfile.NO_RECENT_",
    ],
  },
  "legacyProfile.nrdProp": {
    path: "legacyProfile.nrdProp",
    aliases: ["legacyProfile.NRD-Prop", "legacyProfile.NRD-PROP", "legacyProfile.NRD_PROP", "legacyProfile.NRD PROP"],
  },
  "legacyProfile.deliveryHistory": { path: "legacyProfile.deliveryHistory", aliases: ["legacyProfile.DELIVERY_H"] },
  "legacyProfile.notPaidCurrent": { path: "legacyProfile.notPaidCurrent", aliases: [] },
  "legacyProfile.delinquent": { path: "legacyProfile.delinquent", aliases: ["legacyProfile.DELINQUENT"] },
};

const ENUM_FIELDS = new Set([
  "legacyProfile.howJoined",
  "legacyProfile.referralSource",
  "legacyProfile.oilWorkbenchStatus",
  "legacyProfile.propaneCompanyName",
  "legacyProfile.propaneStatus",
  "legacyProfile.electricStatus",
  "legacyProfile.solorPaid",
]);

const TEXT_FIELDS = new Set([
  "memberNumber",
  "firstName",
  "lastName",
  "addressLine1",
  "legacyProfile.aptNo1",
  "state",
  "postalCode",
  "phone",
  "legacyProfile.phone2",
  "legacyProfile.phone3",
  "email",
  "legacyProfile.email2",
  "legacyProfile.oilId",
  "legacyProfile.propaneId",
  "legacyProfile.electricAccountNumber",
  "legacyProfile.solorNotes",
  "legacyProfile.solorPanels",
  "legacyProfile.energyAuditNotes",
  "legacyProfile.insuranceAuditNotes",
  "notes",
]);

const DATE_FIELDS = new Set([
  "legacyProfile.newMemberDt",
  "legacyProfile.originalStartDate",
  "legacyProfile.oilStartDate",
  "legacyProfile.propaneStartDate",
  "legacyProfile.electricStartDate",
  "legacyProfile.electricSignUpDate",
  "legacyProfile.solorReferralSentDate",
  "legacyProfile.solorDatePaid",
  "legacyProfile.energyAuditReferralDate",
  "legacyProfile.energyAuditDatePaid",
  "legacyProfile.insuranceAuditReferralDate",
  "legacyProfile.insuranceDatePaid",
]);

function blankClause(path: string): Record<string, unknown> {
  return {
    $or: [
      { [path]: { $exists: false } },
      { [path]: null },
      { [path]: { $type: "string", $regex: /^\s*$/ } },
    ],
  };
}

function presentClause(path: string): Record<string, unknown> {
  return { $nor: [blankClause(path)] };
}

function textRegex(operator: string, raw: string): RegExp {
  const escaped = escapeRx(raw);
  if (operator === "equals") return new RegExp(`^\\s*${escaped}\\s*$`, "i");
  if (operator === "starts_with") return new RegExp(`^\\s*${escaped}`, "i");
  return new RegExp(escaped, "i");
}

/** Match the workbench's first-non-blank resolution across alias keys. */
function resolvedTextClause(paths: string[], operator: string, value: string): Record<string, unknown> | null {
  if (operator === "is_empty") return { $and: paths.map((path) => blankClause(path)) };
  if (operator === "is_not_empty") return { $or: paths.map((path) => presentClause(path)) };
  const raw = value.trim();
  if ((operator === "contains" || operator === "starts_with") && !raw) return null;
  if (!["contains", "equals", "starts_with"].includes(operator)) return null;
  const rx = textRegex(operator, raw);
  const clauses = paths.map((path, index) => {
    const priorBlank = paths.slice(0, index).map((prior) => blankClause(prior));
    const hit = { [path]: rx };
    return priorBlank.length ? { $and: [...priorBlank, hit] } : hit;
  });
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

function enumRegex(value: string): RegExp {
  const parts = value.trim().split(/\s+/).filter(Boolean).map((part) => escapeRx(part));
  return new RegExp(`^\\s*${parts.join("\\s+")}\\s*$`, "i");
}

function oilStatusEquals(value: string): Record<string, unknown> {
  const rx = enumRegex(value);
  return {
    $or: [
      { "legacyProfile.oilWorkbenchStatus": rx },
      {
        $and: [
          blankClause("legacyProfile.oilWorkbenchStatus"),
          { "legacyProfile.workbenchMemberStatus": rx },
        ],
      },
    ],
  };
}

function oilStatusEmpty(): Record<string, unknown> {
  return {
    $and: [
      blankClause("legacyProfile.oilWorkbenchStatus"),
      blankClause("legacyProfile.workbenchMemberStatus"),
    ],
  };
}

const HOW_JOINED_GROUPS: Record<string, string[]> = {
  WEB: ["WEB", "WEBSITE", "WEB SITE", "ONLINE"],
  PHONE: ["PHONE", "TELEPHONE", "CALL"],
  EVENT: ["EVENT"],
  MAIL: ["MAIL", "MAILING"],
};

function howJoinedEquals(value: string): Record<string, unknown> {
  const target = value.trim().toUpperCase().replace(/\s+/g, " ");
  const synonyms = HOW_JOINED_GROUPS[target] || [target];
  const fieldMatch = { $or: synonyms.map((syn) => ({ "legacyProfile.howJoined": enumRegex(syn) })) };
  if (target === "WEB" || target === "PHONE") {
    return {
      $or: [
        fieldMatch,
        {
          $and: [
            blankClause("legacyProfile.howJoined"),
            { signedUpVia: target.toLowerCase() },
          ],
        },
      ],
    };
  }
  return fieldMatch;
}

function enumClause(field: string, operator: string, value: string): Record<string, unknown> | null {
  if (field === "legacyProfile.oilWorkbenchStatus") {
    if (operator === "is_empty") return oilStatusEmpty();
    if (operator === "is_not_empty") return { $nor: [oilStatusEmpty()] };
    if (!value.trim()) return null;
    if (operator === "is") return oilStatusEquals(value);
    if (operator === "is_not") return { $nor: [oilStatusEquals(value)] };
    return null;
  }
  if (field === "legacyProfile.howJoined") {
    if (operator === "is_empty") return blankClause(field);
    if (operator === "is_not_empty") return presentClause(field);
    if (!value.trim()) return null;
    if (operator === "is") return howJoinedEquals(value);
    if (operator === "is_not") return { $nor: [howJoinedEquals(value)] };
    return null;
  }
  if (operator === "is_empty") return blankClause(field);
  if (operator === "is_not_empty") return presentClause(field);
  if (!value.trim()) return null;
  const hit = { [field]: enumRegex(value) };
  if (operator === "is") return hit;
  if (operator === "is_not") return { $nor: [hit] };
  return null;
}

function legacyYesClause(path: string): Record<string, unknown> {
  return {
    $or: [
      { [path]: true },
      { [path]: 1 },
      { [path]: { $type: "string", $regex: YES_RX } },
    ],
  };
}

function boolTrueClause(field: string): Record<string, unknown> | null {
  const spec = BOOL_FIELDS[field];
  if (!spec) return null;
  const paths = [spec.path, ...spec.aliases];
  const canonicalTrue = { [spec.path]: true };
  const nonBooleanYes = {
    $and: [
      { [spec.path]: { $not: { $type: "bool" } } },
      { $or: paths.map((path) => legacyYesClause(path)) },
    ],
  };
  const parts: Record<string, unknown>[] = [canonicalTrue, nonBooleanYes];
  if (spec.also) parts.push({ [spec.also]: true });
  return { $or: parts };
}

function asTrimmedString(path: string): Record<string, unknown> {
  return {
    $trim: {
      input: { $convert: { input: `$${path}`, to: "string", onError: "", onNull: "" } },
    },
  };
}

function dateKeyFromString(rawExpr: string): Record<string, unknown> {
  return {
    $let: {
      vars: {
        iso: { $regexFind: { input: rawExpr, regex: /^(\d{4})-(\d{2})-(\d{2})/ } },
        slash: { $regexFind: { input: rawExpr, regex: /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/ } },
      },
      in: {
        $switch: {
          branches: [
            {
              case: { $ne: ["$$iso", null] },
              then: ymdKey("$$iso"),
            },
            {
              case: { $ne: ["$$slash", null] },
              then: slashKey("$$slash"),
            },
          ],
          default: null,
        },
      },
    },
  };
}

function captureInt(findExpr: string, index: number): Record<string, unknown> {
  return { $toInt: { $arrayElemAt: [`${findExpr}.captures`, index] } };
}

function ymdKey(findExpr: string): Record<string, unknown> {
  return boundedYmd(captureInt(findExpr, 0), captureInt(findExpr, 1), captureInt(findExpr, 2));
}

function slashKey(findExpr: string): Record<string, unknown> {
  const yearRaw = { $arrayElemAt: [`${findExpr}.captures`, 2] };
  const year = {
    $let: {
      vars: { y: { $toInt: yearRaw }, len: { $strLenCP: yearRaw } },
      in: {
        $cond: {
          if: { $lte: ["$$len", 2] },
          then: { $add: [{ $cond: { if: { $gte: ["$$y", 50] }, then: 1900, else: 2000 } }, "$$y"] },
          else: "$$y",
        },
      },
    },
  };
  return boundedYmd(captureInt(findExpr, 0), captureInt(findExpr, 1), year);
}

function boundedYmd(
  year: Record<string, unknown>,
  month: Record<string, unknown>,
  day: Record<string, unknown>
): Record<string, unknown> {
  return {
    $cond: {
      if: {
        $and: [
          { $gte: [month, 1] },
          { $lte: [month, 12] },
          { $gte: [day, 1] },
          { $lte: [day, 31] },
          { $gte: [year, 1900] },
          { $lte: [year, 2200] },
        ],
      },
      then: { $add: [{ $multiply: [year, 10000] }, { $multiply: [month, 100] }, day] },
      else: null,
    },
  };
}

/** YYYYMMDD of the first non-blank alias. Unparseable text stays null so it does not match. */
function resolvedDateKey(paths: string[]): Record<string, unknown> | null {
  let expr: Record<string, unknown> | null = null;
  for (let i = paths.length - 1; i >= 0; i--) {
    const fallback: Record<string, unknown> | null = expr;
    expr = {
      $let: {
        vars: { raw: asTrimmedString(paths[i]) },
        in: {
          $cond: {
            if: { $gt: [{ $strLenCP: "$$raw" }, 0] },
            then: dateKeyFromString("$$raw"),
            else: fallback,
          },
        },
      },
    };
  }
  return expr;
}

function isoDayKey(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200) return null;
  return year * 10000 + month * 100 + day;
}

function dateClause(field: string, operator: string, value: string): Record<string, unknown> | null {
  const paths = DATE_PATHS[field] || [field];
  if (operator === "is_empty") return { $and: paths.map((path) => blankClause(path)) };
  if (operator === "is_not_empty") return { $or: paths.map((path) => presentClause(path)) };
  const target = isoDayKey(value);
  if (target == null) return null;
  const op = operator === "on" ? "$eq" : operator === "before" ? "$lt" : operator === "after" ? "$gt" : "";
  if (!op) return null;
  const key = resolvedDateKey(paths);
  if (!key) return null;
  return { $expr: { [op]: [key, target] } };
}

function countMatches(count: number, operator: string, target: number): boolean {
  if (operator === "equals") return count === target;
  if (operator === "gt") return count > target;
  if (operator === "gte") return count >= target;
  if (operator === "lt") return count < target;
  if (operator === "lte") return count <= target;
  return false;
}

async function referralCountClause(operator: string, value: string): Promise<Record<string, unknown> | null> {
  const raw = value.trim();
  if (!raw) return null;
  const target = Number(raw);
  if (!Number.isFinite(target)) return null;
  if (!["equals", "gt", "gte", "lt", "lte"].includes(operator)) return null;
  const grouped = await Referral.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $group: { _id: "$referrerMemberId", count: { $sum: 1 } } },
  ]);
  if (countMatches(0, operator, target)) {
    const excluded = grouped.filter((row) => !countMatches(row.count, operator, target)).map((row) => row._id);
    return excluded.length ? { _id: { $nin: excluded } } : null;
  }
  const included = grouped.filter((row) => countMatches(row.count, operator, target)).map((row) => row._id);
  return { _id: { $in: included } };
}

async function clauseForFilter(filter: EncodedMemberFilter): Promise<Record<string, unknown> | null> {
  const { field, operator, value } = filter;
  if (TEXT_FIELDS.has(field)) return resolvedTextClause(TEXT_PATHS[field] || [field], operator, value);
  if (ENUM_FIELDS.has(field)) return enumClause(field, operator, value);
  if (BOOL_FIELDS[field]) {
    const truthy = boolTrueClause(field);
    if (!truthy) return null;
    if (operator === "is_true") return truthy;
    if (operator === "is_false") return { $nor: [truthy] };
    return null;
  }
  if (DATE_FIELDS.has(field)) return dateClause(field, operator, value);
  if (field === "referralCount") return referralCountClause(operator, value);
  return null;
}

function oilCompanyEmptyClause(): Record<string, unknown> {
  return {
    $and: [
      { $or: [{ oilCompanyId: null }, { oilCompanyId: { $exists: false } }] },
      {
        $or: [
          { "legacyProfile.oilCompanyName": { $in: ["", null] } },
          { "legacyProfile.oilCompanyName": { $exists: false } },
        ],
      },
      {
        $or: [
          { "legacyProfile.oilCoRaw": { $in: ["", null] } },
          { "legacyProfile.oilCoRaw": { $exists: false } },
        ],
      },
    ],
  };
}

export async function applyStructuredMemberFilters(
  filter: Record<string, unknown>,
  opts: { oilCompanyId?: string; encodedFilters?: string }
): Promise<boolean> {
  const encoded = parseEncodedFilters(opts.encodedFilters || "");
  let applied = false;

  const oilFromFilters = encoded.filter((f) => f.field === "oilCompanyId._id");
  const oilIdParam = opts.oilCompanyId?.trim() || "";
  if (oilFromFilters.length) {
    for (const f of oilFromFilters) {
      if (f.operator === "is_empty") {
        pushAnd(filter, oilCompanyEmptyClause());
        applied = true;
        continue;
      }
      if (f.operator === "is_not_empty") {
        pushAnd(filter, { $nor: [oilCompanyEmptyClause()] });
        applied = true;
        continue;
      }
      const clause = await oilCompanyMatchOr(f.value);
      if (!clause) continue;
      if (f.operator === "is") {
        pushAnd(filter, clause);
        applied = true;
      } else if (f.operator === "is_not") {
        pushAnd(filter, { $nor: [clause] });
        applied = true;
      }
    }
  } else if (oilIdParam) {
    const clause = await oilCompanyMatchOr(oilIdParam);
    if (clause) {
      pushAnd(filter, clause);
      applied = true;
    }
  }

  for (const f of encoded.filter((x) => x.field === "city")) {
    const clause = cityMatchClause(f.operator, f.value);
    if (!clause) continue;
    pushAnd(filter, clause);
    applied = true;
  }

  for (const f of encoded) {
    if (f.field === "oilCompanyId._id" || f.field === "city") continue;
    const clause = await clauseForFilter(f);
    if (!clause) continue;
    pushAnd(filter, clause);
    applied = true;
  }

  return applied;
}
