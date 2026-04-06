import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";

type SeedMember = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  status: "active" | "expired" | "cancelled";
  paymentMethod: "card" | "check";
  autoRenew: boolean;
  signupOffsetDays: number;
  referralCount: number;
  lifetimeWaived: boolean;
  referralCredits: number;
  billingStatus: "succeeded" | "pending" | "failed" | "waived" | "mock";
  notes: string;
};

const oilCompaniesSeed = [
  {
    name: "North County Oil",
    contactEmail: "dispatch@northcountyoil.com",
    contactPhone: "(860) 555-0101",
    notes: "Primary contact: Jenna Mason, Dispatch Manager",
  },
  {
    name: "Bay State Fuel",
    contactEmail: "orders@baystatefuel.com",
    contactPhone: "(413) 555-0102",
    notes: "Primary contact: Alex Grant, Member Accounts",
  },
  {
    name: "Horizon Heating & Oil",
    contactEmail: "coopsupport@horizonheating.com",
    contactPhone: "(203) 555-0103",
    notes: "Primary contact: Sam Rivera, Service Coordinator",
  },
  {
    name: "Granite Valley Energy",
    contactEmail: "partnerdesk@granitevalleyenergy.com",
    contactPhone: "(401) 555-0104",
    notes: "Primary contact: Taylor Brooks, Customer Operations",
  },
  {
    name: "Pioneer Home Fuel",
    contactEmail: "members@pioneerhomefuel.com",
    contactPhone: "(914) 555-0105",
    notes: "Primary contact: Casey Morgan, Oil Program Lead",
  },
];

const memberSeeds: SeedMember[] = [
  {
    firstName: "Emma",
    lastName: "Caruso",
    email: "emma.caruso@seed.oilcoop.local",
    phone: "(860) 555-1001",
    addressLine1: "14 Pine Ridge Ln",
    city: "West Hartford",
    state: "CT",
    postalCode: "06107",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 420,
    referralCount: 1,
    lifetimeWaived: false,
    referralCredits: 1,
    billingStatus: "waived",
    notes: "Payment status: annual waived from referral credit.",
  },
  {
    firstName: "Liam",
    lastName: "Benton",
    email: "liam.benton@seed.oilcoop.local",
    phone: "(860) 555-1002",
    addressLine1: "88 Maple St",
    city: "Berlin",
    state: "CT",
    postalCode: "06037",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 620,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "succeeded",
    notes: "Payment status: paid annual successfully.",
  },
  {
    firstName: "Olivia",
    lastName: "Park",
    email: "olivia.park@seed.oilcoop.local",
    phone: "(860) 555-1003",
    addressLine1: "302 Cedar Ave",
    city: "Newington",
    state: "CT",
    postalCode: "06111",
    status: "active",
    paymentMethod: "check",
    autoRenew: false,
    signupOffsetDays: 480,
    referralCount: 2,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "pending",
    notes: "Payment status: check payer, annual invoice pending.",
  },
  {
    firstName: "Noah",
    lastName: "Miller",
    email: "noah.miller@seed.oilcoop.local",
    phone: "(860) 555-1004",
    addressLine1: "19 Oak View Dr",
    city: "Farmington",
    state: "CT",
    postalCode: "06032",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 700,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "failed",
    notes: "Payment status: annual attempt failed, follow-up required.",
  },
  {
    firstName: "Ava",
    lastName: "Santos",
    email: "ava.santos@seed.oilcoop.local",
    phone: "(860) 555-1005",
    addressLine1: "7 Willow Ct",
    city: "Southington",
    state: "CT",
    postalCode: "06489",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 540,
    referralCount: 5,
    lifetimeWaived: true,
    referralCredits: 0,
    billingStatus: "waived",
    notes: "Payment status: lifetime annual waiver from 5 referrals.",
  },
  {
    firstName: "Ethan",
    lastName: "Kline",
    email: "ethan.kline@seed.oilcoop.local",
    phone: "(860) 555-1006",
    addressLine1: "220 River Rd",
    city: "Wethersfield",
    state: "CT",
    postalCode: "06109",
    status: "active",
    paymentMethod: "check",
    autoRenew: false,
    signupOffsetDays: 365,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "pending",
    notes: "Payment status: check renewal requested, not yet received.",
  },
  {
    firstName: "Mia",
    lastName: "Donovan",
    email: "mia.donovan@seed.oilcoop.local",
    phone: "(860) 555-1007",
    addressLine1: "41 Lakeview Dr",
    city: "Middletown",
    state: "CT",
    postalCode: "06457",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 820,
    referralCount: 3,
    lifetimeWaived: false,
    referralCredits: 2,
    billingStatus: "succeeded",
    notes: "Payment status: active card on file, annual paid.",
  },
  {
    firstName: "Lucas",
    lastName: "Reed",
    email: "lucas.reed@seed.oilcoop.local",
    phone: "(860) 555-1008",
    addressLine1: "159 Birch Hill Rd",
    city: "Glastonbury",
    state: "CT",
    postalCode: "06033",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 455,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "mock",
    notes: "Payment status: dev mock annual success.",
  },
  {
    firstName: "Sophia",
    lastName: "Nguyen",
    email: "sophia.nguyen@seed.oilcoop.local",
    phone: "(860) 555-1009",
    addressLine1: "5 Country Club Rd",
    city: "Avon",
    state: "CT",
    postalCode: "06001",
    status: "active",
    paymentMethod: "check",
    autoRenew: false,
    signupOffsetDays: 610,
    referralCount: 1,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "pending",
    notes: "Payment status: mailed check reminder sent.",
  },
  {
    firstName: "Mason",
    lastName: "Harper",
    email: "mason.harper@seed.oilcoop.local",
    phone: "(860) 555-1010",
    addressLine1: "66 Elm St",
    city: "Manchester",
    state: "CT",
    postalCode: "06040",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 300,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "succeeded",
    notes: "Payment status: first annual billed successfully.",
  },
  {
    firstName: "Isabella",
    lastName: "Price",
    email: "isabella.price@seed.oilcoop.local",
    phone: "(860) 555-1011",
    addressLine1: "12 Meadow Dr",
    city: "Rocky Hill",
    state: "CT",
    postalCode: "06067",
    status: "expired",
    paymentMethod: "check",
    autoRenew: false,
    signupOffsetDays: 920,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "failed",
    notes: "Payment status: expired after failed renewal collection.",
  },
  {
    firstName: "James",
    lastName: "Ellis",
    email: "james.ellis@seed.oilcoop.local",
    phone: "(860) 555-1012",
    addressLine1: "93 North St",
    city: "Plainville",
    state: "CT",
    postalCode: "06062",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 515,
    referralCount: 4,
    lifetimeWaived: false,
    referralCredits: 1,
    billingStatus: "waived",
    notes: "Payment status: annual waived using available referral credit.",
  },
  {
    firstName: "Charlotte",
    lastName: "Morris",
    email: "charlotte.morris@seed.oilcoop.local",
    phone: "(860) 555-1013",
    addressLine1: "301 Highland Ave",
    city: "Cromwell",
    state: "CT",
    postalCode: "06416",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 205,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "succeeded",
    notes: "Payment status: new member, registration paid and annual queued.",
  },
  {
    firstName: "Benjamin",
    lastName: "Ford",
    email: "benjamin.ford@seed.oilcoop.local",
    phone: "(860) 555-1014",
    addressLine1: "80 Cherry Ln",
    city: "Bloomfield",
    state: "CT",
    postalCode: "06002",
    status: "cancelled",
    paymentMethod: "check",
    autoRenew: false,
    signupOffsetDays: 1000,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "failed",
    notes: "Payment status: account cancelled by member request.",
  },
  {
    firstName: "Amelia",
    lastName: "Stone",
    email: "amelia.stone@seed.oilcoop.local",
    phone: "(860) 555-1015",
    addressLine1: "6 Orchard Hill",
    city: "Simsbury",
    state: "CT",
    postalCode: "06070",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 660,
    referralCount: 2,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "mock",
    notes: "Payment status: annual marked as mock success in dev.",
  },
  {
    firstName: "Henry",
    lastName: "Bishop",
    email: "henry.bishop@seed.oilcoop.local",
    phone: "(860) 555-1016",
    addressLine1: "444 Main St",
    city: "New Britain",
    state: "CT",
    postalCode: "06051",
    status: "active",
    paymentMethod: "check",
    autoRenew: false,
    signupOffsetDays: 340,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "pending",
    notes: "Payment status: check expected this week.",
  },
  {
    firstName: "Evelyn",
    lastName: "Ward",
    email: "evelyn.ward@seed.oilcoop.local",
    phone: "(860) 555-1017",
    addressLine1: "9 Forest Ct",
    city: "Cheshire",
    state: "CT",
    postalCode: "06410",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 575,
    referralCount: 6,
    lifetimeWaived: true,
    referralCredits: 0,
    billingStatus: "waived",
    notes: "Payment status: lifetime waiver active.",
  },
  {
    firstName: "Alexander",
    lastName: "Hale",
    email: "alexander.hale@seed.oilcoop.local",
    phone: "(860) 555-1018",
    addressLine1: "77 Spruce St",
    city: "Bristol",
    state: "CT",
    postalCode: "06010",
    status: "expired",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 780,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "failed",
    notes: "Payment status: expired after card retries failed.",
  },
  {
    firstName: "Harper",
    lastName: "Cole",
    email: "harper.cole@seed.oilcoop.local",
    phone: "(860) 555-1019",
    addressLine1: "18 Ridgeview Rd",
    city: "Enfield",
    state: "CT",
    postalCode: "06082",
    status: "active",
    paymentMethod: "card",
    autoRenew: true,
    signupOffsetDays: 250,
    referralCount: 1,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "succeeded",
    notes: "Payment status: active and current.",
  },
  {
    firstName: "Daniel",
    lastName: "Brooks",
    email: "daniel.brooks@seed.oilcoop.local",
    phone: "(860) 555-1020",
    addressLine1: "205 Valley Rd",
    city: "Windsor",
    state: "CT",
    postalCode: "06095",
    status: "active",
    paymentMethod: "check",
    autoRenew: false,
    signupOffsetDays: 490,
    referralCount: 0,
    lifetimeWaived: false,
    referralCredits: 0,
    billingStatus: "pending",
    notes: "Payment status: paper invoice generated.",
  },
];

function memberNumberFromIndex(index: number): string {
  return `OC-SEED-${String(index + 1).padStart(4, "0")}`;
}

function randomBoolByIndex(index: number, modulus: number): boolean {
  return index % modulus === 0;
}

async function main() {
  await connectDb();
  const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMeAdmin!123";
  const existing = await Member.findOne({ email });
  if (existing) {
    console.info("Admin already exists:", email);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await Member.create({
      email,
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      memberNumber: "INTERNAL-ADMIN",
      nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()),
      notificationSettings: {},
    });
    console.info("Created admin:", email, "password:", password);
  }

  const oilCompanies: Array<{ _id: mongoose.Types.ObjectId; name: string }> = [];
  for (const c of oilCompaniesSeed) {
    const doc = await OilCompany.findOneAndUpdate({ name: c.name }, { $set: c }, { upsert: true, new: true });
    oilCompanies.push({ _id: doc._id, name: doc.name });
  }
  console.info(`Upserted ${oilCompanies.length} oil companies.`);

  const memberPassword = await bcrypt.hash("MemberDemo!123", 10);
  let upsertedMembers = 0;
  for (let i = 0; i < memberSeeds.length; i++) {
    const seed = memberSeeds[i];
    const signupDate = new Date();
    signupDate.setDate(signupDate.getDate() - seed.signupOffsetDays);
    const nextAnnualBillingDate = nextJuneFirstAfterSignup(signupDate);
    const oilCompany = oilCompanies[i % oilCompanies.length];
    const memberNumber = memberNumberFromIndex(i);

    const member = await Member.findOneAndUpdate(
      { email: seed.email },
      {
        $set: {
          memberNumber,
          passwordHash: memberPassword,
          firstName: seed.firstName,
          lastName: seed.lastName,
          phone: seed.phone,
          addressLine1: seed.addressLine1,
          city: seed.city,
          state: seed.state,
          postalCode: seed.postalCode,
          role: "member",
          status: seed.status,
          oilCompanyId: oilCompany._id,
          paymentMethod: seed.paymentMethod,
          autoRenew: seed.autoRenew,
          stripeCustomerId: seed.paymentMethod === "card" ? `cus_seed_${String(i + 1).padStart(4, "0")}` : "",
          stripeDefaultPaymentMethodId:
            seed.paymentMethod === "card" && seed.autoRenew
              ? `pm_seed_${String(i + 1).padStart(4, "0")}`
              : "",
          nextAnnualBillingDate,
          successfulReferralCount: seed.referralCount,
          lifetimeAnnualFeeWaived: seed.lifetimeWaived,
          referralWaiveCredits: seed.referralCredits,
          registrationFeePaidAt: signupDate,
          lastAnnualChargeAt: seed.billingStatus === "succeeded" || seed.billingStatus === "mock" ? new Date() : null,
          lastAnnualChargeAmountCents:
            seed.billingStatus === "succeeded" || seed.billingStatus === "mock" ? 12000 : null,
          notificationSettings: {
            emailEnabled: true,
            renewalReminders: !randomBoolByIndex(i, 5),
            billingNotices: true,
            oilCompanyUpdates: true,
            marketing: randomBoolByIndex(i, 4),
            smsEnabled: randomBoolByIndex(i, 6),
            smsPhone: randomBoolByIndex(i, 6) ? seed.phone : "",
          },
          notes: seed.notes,
          signedUpVia: randomBoolByIndex(i, 3) ? "phone" : "web",
        },
      },
      { upsert: true, new: true }
    );

    await BillingEvent.deleteMany({ memberId: member._id, description: /seed data/i });
    await BillingEvent.create({
      memberId: member._id,
      kind: "registration",
      amountCents: 5000,
      status: "succeeded",
      description: "Seed data: registration fee",
      billingYear: signupDate.getFullYear(),
    });
    await BillingEvent.create({
      memberId: member._id,
      kind: "annual",
      amountCents: seed.billingStatus === "waived" ? 0 : 12000,
      status: seed.billingStatus,
      description: "Seed data: annual membership event",
      billingYear: new Date().getFullYear(),
    });

    upsertedMembers++;
  }
  console.info(`Upserted ${upsertedMembers} members.`);
  console.info("Seeded credentials: admin@example.com / ChangeMeAdmin!123");
  console.info("Seeded credentials: member emails use password MemberDemo!123");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
