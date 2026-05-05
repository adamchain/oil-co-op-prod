import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { Member } from "../models/Member.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";

const email = (process.env.SET_ADMIN_EMAIL ?? "admin@example.com").toLowerCase().trim();
const password = process.env.SET_ADMIN_PASSWORD ?? "Admin10..@";

async function main() {
  await connectDb();
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await Member.findOne({ email });
  if (existing) {
    await Member.updateOne(
      { _id: existing._id },
      {
        $set: {
          passwordHash,
          role: "admin",
          ...(existing.memberNumber ? {} : { memberNumber: "INTERNAL-ADMIN" }),
        },
      }
    );
    console.info("Updated admin:", email);
  } else {
    const internalTaken = await Member.findOne({ memberNumber: "INTERNAL-ADMIN" });
    const memberNumber =
      internalTaken && internalTaken.email !== email ? undefined : "INTERNAL-ADMIN";

    await Member.create({
      email,
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      ...(memberNumber ? { memberNumber } : {}),
      nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()),
      notificationSettings: {},
    });
    console.info("Created admin:", email);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
