import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { Member } from "../models/Member.js";
import { accountKeys } from "../utils/deliveryRows.js";

const SAMPLE = ["15043-1", "11340-1", "8085-1", "12313-2", "207-1"];

async function main() {
  const uri = process.env.MONGODB_URI || "";
  const isLocal = uri.includes("127.0.0.1") || uri.includes("localhost");
  console.log("DB:", isLocal ? "LOCAL" : "REMOTE");

  await connectDb();
  const members = await Member.find({ role: "member" })
    .select("memberNumber legacyProfile.oilId")
    .lean();

  const index = new Map<string, string[]>();
  for (const m of members) {
    const oilId = String((m.legacyProfile as Record<string, unknown>)?.oilId || "");
    for (const k of accountKeys(oilId)) {
      const list = index.get(`OIL|${k}`) || [];
      list.push(String(m.memberNumber || m._id));
      index.set(`OIL|${k}`, list);
    }
  }

  for (const id of SAMPLE) {
    const keys = accountKeys(id);
    const hits: string[] = [];
    for (const k of keys) {
      const list = index.get(`OIL|${k}`);
      if (list) hits.push(...list);
    }
    console.log(id, "keys=", keys, "hits=", [...new Set(hits)].join(", ") || "NONE");
  }

  console.log("members with oilId set:", members.filter((m) => (m.legacyProfile as any)?.oilId).length);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
