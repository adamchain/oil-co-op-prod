import mongoose from "mongoose";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
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

  return applied;
}
