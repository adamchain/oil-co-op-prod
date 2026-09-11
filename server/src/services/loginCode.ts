import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { LoginCode } from "../models/LoginCode.js";
import { Member } from "../models/Member.js";
import { sendLoginCodeEmail } from "./mail.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_CODES_PER_HOUR = 8;
const MAX_ATTEMPTS = 5;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function issueLoginCode(
  emailRaw: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const email = normalizeEmail(emailRaw);
  if (!email || !email.includes("@")) {
    return { ok: false, status: 400, error: "Enter a valid email address." };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await LoginCode.countDocuments({ email, createdAt: { $gte: hourAgo } });
  if (recentCount >= MAX_CODES_PER_HOUR) {
    return { ok: false, status: 429, error: "Too many sign-in codes. Try again in a little while." };
  }

  const last = await LoginCode.findOne({ email }).sort({ createdAt: -1 });
  if (last?.createdAt && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: true };
  }

  const member = await Member.findOne({ email });
  if (!member) {
    await bcrypt.hash("000000", 10);
    return { ok: true };
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);
  await LoginCode.create({
    email,
    memberId: member._id,
    codeHash,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    attempts: 0,
  });
  await sendLoginCodeEmail(member, code);
  return { ok: true };
}

const DUMMY_HASH = bcrypt.hashSync("000000", 8);

export async function consumeLoginCode(emailRaw: string, codeRaw: string) {
  const email = normalizeEmail(emailRaw);
  const code = codeRaw.replace(/\D/g, "");
  const rec = await LoginCode.findOne({
    email,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!rec || rec.attempts >= MAX_ATTEMPTS) {
    await bcrypt.compare(code || "000000", DUMMY_HASH);
    return null;
  }

  rec.attempts += 1;
  const match = await bcrypt.compare(code, rec.codeHash);
  if (!match) {
    await rec.save();
    return null;
  }

  rec.consumedAt = new Date();
  await rec.save();
  return Member.findById(rec.memberId);
}
