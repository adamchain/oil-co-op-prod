import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { Member } from "../models/Member.js";
import { OilCompany } from "../models/OilCompany.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { CommunicationLog } from "../models/CommunicationLog.js";
import { PaymentToken } from "../models/PaymentToken.js";
import { Referral } from "../models/Referral.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";

const SAMPLE_CUSTOMER_COUNT = 500;

type BillingStatus = "succeeded" | "pending" | "failed" | "waived" | "mock";

const FIRST_NAMES = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Mia", "Lucas", "Sophia", "Mason",
  "Isabella", "James", "Charlotte", "Benjamin", "Amelia", "Henry", "Evelyn", "Alexander",
  "Harper", "Daniel", "Scarlett", "Jack", "Grace", "Michael", "Chloe", "Owen", "Nora", "Samuel",
];

const LAST_NAMES = [
  "Caruso", "Benton", "Park", "Miller", "Santos", "Kline", "Donovan", "Reed", "Nguyen", "Harper",
  "Price", "Ellis", "Morris", "Ford", "Stone", "Bishop", "Ward", "Hale", "Cole", "Brooks",
  "Turner", "Hayes", "Wright", "Foster", "Bennett", "Sullivan", "Parker", "Cooper",
];

const STREETS = [
  "Main St", "Maple Ave", "Oak Rd", "Pine Ln", "Cedar Ct", "Birch Hill Rd", "River Rd", "Elm St",
  "Meadow Dr", "Country Club Rd", "Highland Ave", "Lakeview Dr", "Forest Ct", "Ridgeview Rd",
];

const CITIES = [
  { city: "Hartford", state: "CT", postalCode: "06103" },
  { city: "West Hartford", state: "CT", postalCode: "06107" },
  { city: "Newington", state: "CT", postalCode: "06111" },
  { city: "Farmington", state: "CT", postalCode: "06032" },
  { city: "Southington", state: "CT", postalCode: "06489" },
  { city: "Wethersfield", state: "CT", postalCode: "06109" },
  { city: "Middletown", state: "CT", postalCode: "06457" },
  { city: "Glastonbury", state: "CT", postalCode: "06033" },
  { city: "Manchester", state: "CT", postalCode: "06040" },
  { city: "Rocky Hill", state: "CT", postalCode: "06067" },
  { city: "Simsbury", state: "CT", postalCode: "06070" },
  { city: "Bristol", state: "CT", postalCode: "06010" },
  { city: "Enfield", state: "CT", postalCode: "06082" },
  { city: "Windsor", state: "CT", postalCode: "06095" },
];

const PHONE_TYPES = ["HOME", "CELL", "WORK"];
const OIL_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO OIL", "UNKNOWN"];
const PROPANE_STATUS = ["ACTIVE", "INACTIVE", "NO PROPANE", "PROSPECTIVE", "RESIDENT", "UNKNOWN"];
const CARD_TYPES = ["visa", "mastercard", "amex"];
const DEFAULT_OIL_COMPANIES = [
  { code: "ALLI", name: "Alliance Express", address: "11 Broadway", city: "Chelsea", state: "MA", zip: "02150", phone: "866-590-3326 ext. 6014", fax: "", contact1: "Jody Gallagher", email1: "jgallagher@hopenergy.com", contact2: "Tracy Everdale", email2: "teverdale@hopenergy.com", contact3: "Terrisa Archibald", email3: "tarchibald@hopenergy.com" },
  { code: "TLC", name: "AUTOMATIC TLC", address: "64 Oakland Avenue", city: "East Hartford", state: "CT", zip: "06108", phone: "866-590-3326 ext. 6014", fax: "", contact1: "Jody Gallagher", email1: "jgallagher@hopenergy.com", contact2: "Tracy Everdale", email2: "teverdale@hopenergy.com", contact3: "Terrisa Archibald", email3: "tarchibald@hopenergy.com" },
  { code: "", name: "Chain Oil 2", address: "", city: "", state: "", zip: "", phone: "484-571-2062", fax: "", contact1: "", email1: "adam@suitenote.com", contact2: "", email2: "", contact3: "", email3: "" },
  { code: "CRC", name: "CONNECTICUT REFINING CO.", address: "46 Goodwin Street", city: "New Haven", state: "CT", zip: "06512", phone: "866-590-3326 ext. 6014", fax: "", contact1: "Jody Gallagher", email1: "jgallagher@hopenergy.com", contact2: "Tracy Everdale", email2: "teverdale@hopenergy.com", contact3: "Terrisa Archibald", email3: "tarchibald@hopenergy.com" },
  { code: "DDLC", name: "DDLC ENERGY", address: "410 Bank Street", city: "New London", state: "CT", zip: "06320", phone: "866-590-3326 ext. 6014", fax: "", contact1: "Jody Gallagher", email1: "jgallagher@hopenergy.com", contact2: "Tracy Everdale", email2: "teverdale@hopenergy.com", contact3: "Terrisa Archibald", email3: "tarchibald@hopenergy.com" },
  { code: "DEITCH", name: "Deitch Energy, LLC", address: "40 Woodland Street", city: "Hartford", state: "CT", zip: "06105", phone: "860-728-5431", fax: "860-528-4321", contact1: "Michael Deitch", email1: "michaeljdeitch@gmail.com", contact2: "", email2: "", contact3: "", email3: "" },
  { code: "DOM", name: "Dominick Fuel", address: "836 Fairfield Avenue", city: "Bridgeport", state: "CT", zip: "06601", phone: "866-590-3326 ext. 6014", fax: "", contact1: "Jody Gallagher", email1: "jgallagher@hopenergy.com", contact2: "Tracy Everdale", email2: "teverdale@hopenergy.com", contact3: "Terrisa Archibald", email3: "tarchibald@hopenergy.com" },
  { code: "FFH", name: "F.F. Hitchcock", address: "264 Sandbank Road", city: "Cheshire", state: "CT", zip: "06410", phone: "475-315-0247", fax: "", contact1: "MaryKate Green", email1: "marykate.green@ffhitch", contact2: "", email2: "", contact3: "", email3: "" },
  { code: "HALE", name: "Hale Hill Biofuels", address: "18 Main Street", city: "Chester", state: "CT", zip: "06412", phone: "203-425-3445", fax: "888-425-3445", contact1: "Kim Kellogg", email1: "halehillfarm@yahoo.com", contact2: "", email2: "", contact3: "", email3: "" },
  { code: "HIHO", name: "Hi Ho Petroleum", address: "39 Salt Street", city: "Bridgeport", state: "CT", zip: "06605", phone: "203-335-0101", fax: "", contact1: "Cristina Conti", email1: "cconti@hihopetroleum.com", contact2: "Bill Klopfer", email2: "bklopfer@hihoenergy.com", contact3: "", email3: "" },
  { code: "HOFF", name: "Hoffman Energy", address: "56 Quarry Road #2", city: "Trumbull", state: "CT", zip: "06611", phone: "800-637-2239", fax: "", contact1: "Jill Tulley", email1: "jtulley@hoffmanenergy.com", contact2: "Marie Kantzas", email2: "mkantzas@hoffmanenergy.com", contact3: "", email3: "" },
  { code: "MTN", name: "Hometown Heating", address: "test", city: "", state: "", zip: "", phone: "", fax: "", contact1: "", email1: "", contact2: "", email2: "", contact3: "", email3: "" },
  { code: "IVES", name: "Ives Brothers", address: "1244 Main Street", city: "Willimantic", state: "CT", zip: "06226", phone: "860-423-6381", fax: "", contact1: "Suzette Butler", email1: "ivesbrosoil@gmail.com", contact2: "", email2: "", contact3: "", email3: "" },
  { code: "KAUF", name: "Kaufman Fuel", address: "836 Fairfield Avenue", city: "Bridgeport", state: "CT", zip: "06604", phone: "866-590-3326 ext. 6014", fax: "", contact1: "Jody Gallagher", email1: "jgallagher@hopenergy.com", contact2: "Tracy Everdale", email2: "teverdale@hopenergy.com", contact3: "Terrisa Archibald", email3: "tarchibald@hopenergy.com" },
  { code: "MERC", name: "Mercury Energy", address: "46 Goodwin Street", city: "New Haven", state: "CT", zip: "06512", phone: "866-590-3326 ext. 6014", fax: "", contact1: "Jody Gallagher", email1: "jgallagher@hopenergy.com", contact2: "Tracy Everdale", email2: "teverdale@hopenergy.com", contact3: "Terrisa Archibald", email3: "tarchibald@hopenergy.com" },
  { code: "MIRA", name: "Mirabito Energy", address: "22 Rowley Street", city: "Winsted", state: "CT", zip: "06098", phone: "607-352-2800 ext. 7814", fax: "", contact1: "Sandy Mark", email1: "sandy.mark@mirabito.com", contact2: "Kathi Shackelton", email2: "kathi.shackelton@mirabito.com", contact3: "", email3: "" },
  { code: "KAS", name: "PETRO FUEL", address: "340 Tolland Street", city: "East Hartford", state: "CT", zip: "06108", phone: "800-645-4328", fax: "", contact1: "Shirley Worthington", email1: "sworthin@petroheat.com", contact2: "Catherine Harrison", email2: "charrison@petroheat.com", contact3: "", email3: "" },
  { code: "PetRI", name: "Petro Fuel", address: "14 Knight Street", city: "Warwick", state: "RI", zip: "02886", phone: "401-736-2370", fax: "", contact1: "Shirley Worthington", email1: "sworthin@petroheat.com", contact2: "Catherine Harrison", email2: "charrison@petroheat.com", contact3: "", email3: "" },
  { code: "POW", name: "Power Fuel", address: "", city: "", state: "", zip: "", phone: "", fax: "", contact1: "", email1: "", contact2: "", email2: "", contact3: "", email3: "" },
  { code: "RIVER", name: "River Valley Oil Service", address: "P.O. Box 866", city: "Middletown", state: "CT", zip: "06457", phone: "860-342-5670", fax: "", contact1: "Bethany Sanderson", email1: "", contact2: "", email2: "", contact3: "", email3: "" },
  { code: "SAVE", name: "Saveway Petroleum", address: "49 South Main Street", city: "Danielson", state: "CT", zip: "06238", phone: "860-779-2500", fax: "", contact1: "Toby Mercier", email1: "toby.mercier@nepropane.com", contact2: "Heather Brooks", email2: "hbrooks@nepropane.com", contact3: "", email3: "" },
  { code: "SUP", name: "Superior Plus", address: "22 Rowley Street", city: "Winsted", state: "CT", zip: "06098", phone: "860-379-3322", fax: "", contact1: "Colleen Hackett", email1: "chackett@superiorplusenergy.com", contact2: "Candice Daum", email2: "cdaum@superiorplusenergy.com", contact3: "", email3: "" },
  { code: "THOM", name: "Thomaston Oil", address: "401 McMahon Drive", city: "Thomaston", state: "CT", zip: "06787", phone: "860-283-4878 ext. 109", fax: "", contact1: "Jennifer Silva", email1: "jsilva@ctcomfortcontrol.com", contact2: "Jill Brown", email2: "jill@alliancealltrades.com", contact3: "", email3: "customerservice@thomastonoil.com" },
  { code: "VLIAN", name: "Valiant Energy Solutions", address: "165 Railroad Hill Street", city: "Waterbury", state: "CT", zip: "06708", phone: "800-992-2227", fax: "", contact1: "Jennifer Nagorski", email1: "jennifer.nagorski@valiantenergy.com", contact2: "Rebecca Faroni", email2: "rebecca.faroni@valiantenergy.com", contact3: "", email3: "" },
  { code: "VAL", name: "Valley Saybrook Oil", address: "36 Brownstone Avenue", city: "Portland", state: "CT", zip: "06480", phone: "866-590-3326 ext. 6014", fax: "", contact1: "Jody Gallagher", email1: "jgallagher@hopenergy.com", contact2: "Tracy Everdale", email2: "teverdale@hopenergy.com", contact3: "Terrisa Archibald", email3: "tarchibald@hopenergy.com" },
];

function buildOilCompanyNotes(oc: (typeof DEFAULT_OIL_COMPANIES)[number]): string {
  const parts: string[] = [];
  if (oc.code) parts.push(`Code: ${oc.code}`);
  const addressBits = [oc.address, oc.city, oc.state, oc.zip].filter(Boolean);
  if (addressBits.length) parts.push(`Address: ${addressBits.join(", ")}`);
  if (oc.fax) parts.push(`Fax: ${oc.fax}`);
  if (oc.contact1) parts.push(`Primary contact: ${oc.contact1}`);
  if (oc.email1) parts.push(`Primary contact email: ${oc.email1.toLowerCase()}`);
  if (oc.contact2) parts.push(`Secondary contact: ${oc.contact2}`);
  if (oc.email2) parts.push(`Secondary contact email: ${oc.email2.toLowerCase()}`);
  if (oc.contact3) parts.push(`Tertiary contact: ${oc.contact3}`);
  if (oc.email3) parts.push(`Tertiary contact email: ${oc.email3.toLowerCase()}`);
  return parts.join(" | ");
}

function memberNumberFromIndex(index: number): string {
  return `OC-SEED-${String(index + 1).padStart(4, "0")}`;
}

function phoneFromIndex(index: number): string {
  const n = 2000000 + index;
  const raw = `860${String(n).padStart(7, "0")}`;
  return `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
}

function formatDateYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pickStatus(i: number): "active" | "expired" | "cancelled" {
  if (i % 22 === 0) return "cancelled";
  if (i % 9 === 0) return "expired";
  return "active";
}

function pickBillingStatus(i: number): BillingStatus {
  if (i % 15 === 0) return "waived";
  if (i % 14 === 0) return "failed";
  if (i % 6 === 0) return "pending";
  if (i % 13 === 0) return "mock";
  return "succeeded";
}

function buildDeliveryHistory(i: number) {
  const rows: Array<{ dateDelivered: string; deliveryYear: number; fuelType: "OIL" | "PROPANE"; gallons: number }> = [];
  const years = 1 + (i % 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  for (let y = 0; y < years; y++) {
    const year = currentYear - y;
    const deliveriesThisYear = 2 + ((i + y) % 9); // 2-10 deliveries per year
    for (let j = 0; j < deliveriesThisYear; j++) {
      const d = new Date(year, (i + y * 3 + j * 2) % 12, 1 + ((i * 11 + y * 7 + j * 5) % 27));
      rows.push({
        dateDelivered: formatDateYYYYMMDD(d),
        deliveryYear: year,
        fuelType: (j + y) % 7 === 0 ? "PROPANE" : "OIL",
        gallons: 125 + ((i * 17 + y * 19 + j * 13) % 420),
      });
    }
  }
  return rows.sort((a, b) => (a.dateDelivered < b.dateDelivered ? 1 : -1));
}

async function main() {
  await connectDb();

  const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin10..@";
  const passwordHash = await bcrypt.hash(password, 10);
  const adminByEmail = await Member.findOne({ email });
  const adminByNumber = await Member.findOne({ memberNumber: "INTERNAL-ADMIN" });
  let targetAdminId = adminByEmail?._id || adminByNumber?._id || null;

  if (
    adminByEmail &&
    adminByNumber &&
    adminByEmail._id.toString() !== adminByNumber._id.toString()
  ) {
    await Member.deleteOne({ _id: adminByNumber._id });
    targetAdminId = adminByEmail._id;
  }

  const admin = targetAdminId
    ? await Member.findByIdAndUpdate(
        targetAdminId,
        {
          $set: {
            email,
            passwordHash,
            firstName: "Admin",
            lastName: "User",
            role: "admin",
            memberNumber: "INTERNAL-ADMIN",
            nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()),
            notificationSettings: {},
          },
        },
        { new: true }
      )
    : await Member.create({
        email,
        passwordHash,
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        memberNumber: "INTERNAL-ADMIN",
        nextAnnualBillingDate: nextJuneFirstAfterSignup(new Date()),
        notificationSettings: {},
      });
  if (admin) {
    console.info("Ensured admin account:", email);
  }

  for (const c of DEFAULT_OIL_COMPANIES) {
    const contactEmails = [c.email1, c.email2, c.email3].map((v) => v.trim().toLowerCase()).filter(Boolean);
    await OilCompany.findOneAndUpdate(
      { name: c.name },
      {
        $set: {
          name: c.name,
          contactPhone: c.phone,
          contactEmail: contactEmails[0] || "",
          contactEmails,
          notes: buildOilCompanyNotes(c),
          active: true,
        },
      },
      { upsert: true, new: true }
    );
  }
  const existingOilCompanies = await OilCompany.find({ active: { $ne: false } }).sort({ name: 1 });

  const memberIds = (await Member.find({ role: "member" }).select("_id").lean()).map((m) => m._id);
  if (memberIds.length > 0) {
    await Promise.all([
      BillingEvent.deleteMany({ memberId: { $in: memberIds } }),
      ActivityLog.deleteMany({ memberId: { $in: memberIds } }),
      CommunicationLog.deleteMany({ memberId: { $in: memberIds } }),
      PaymentToken.deleteMany({ memberId: { $in: memberIds } }),
      Referral.deleteMany({
        $or: [
          { newMemberId: { $in: memberIds } },
          { referrerMemberId: { $in: memberIds } },
        ],
      }),
      Member.deleteMany({ role: "member" }),
    ]);
  }

  console.info(`Deleted ${memberIds.length} existing customers.`);

  const memberPassword = await bcrypt.hash("MemberDemo!123", 10);
  const createdMembers: Array<{ _id: mongoose.Types.ObjectId; idx: number }> = [];

  for (let i = 0; i < SAMPLE_CUSTOMER_COUNT; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const place = CITIES[i % CITIES.length];
    const signupDate = new Date();
    signupDate.setDate(signupDate.getDate() - (180 + (i % 1280)));

    const paymentMethod = i % 4 === 0 ? "check" : "card";
    const autoRenew = paymentMethod === "card" && i % 8 !== 0;
    const status = pickStatus(i);
    const billingStatus = pickBillingStatus(i);
    const referralCount = i % 40 === 0 ? 2 : i % 55 === 0 ? 1 : 0;
    const referredBySparse = i > 10 && i % 33 === 0;
    const oilCompany = existingOilCompanies[i % existingOilCompanies.length];

    const legacyProfile: Record<string, unknown> = {
      legacyId: `LEG-${String(i + 1).padStart(5, "0")}`,
      workbenchMemberStatus: OIL_STATUS[i % OIL_STATUS.length],
      oilWorkbenchStatus: OIL_STATUS[i % OIL_STATUS.length],
      oilId: `OIL-${String(600000 + i)}`,
      oilStartDate: formatDateYYYYMMDD(signupDate),
      propaneStatus: PROPANE_STATUS[i % PROPANE_STATUS.length],
      propaneId: i % 3 === 0 ? `PRO-${String(500000 + i)}` : "",
      propaneStartDate: i % 3 === 0 ? formatDateYYYYMMDD(signupDate) : "",
      deliveryHistory: true,
      delinquent: i % 21 === 0,
      notPaidCurrentYr: billingStatus === "pending" || billingStatus === "failed",
      noRecentDels: i % 19 === 0,
      deliveryHistoryRows: buildDeliveryHistory(i),
      registrationFee: "10",
      regCluster: String((i % 12) + 1),
      regDtPaid: formatDateYYYYMMDD(signupDate),
      regCheckCredit: paymentMethod === "check" ? "check" : "credit",
      registrationPaymentStatus: billingStatus === "waived" ? "waived" : "paid",
      waiveFeeSenior: i % 37 === 0,
      waiveFeeLifetime: i % 111 === 0,
      paymentNotes: billingStatus === "failed" ? "Manual follow up required." : "",
      ccType: paymentMethod === "card" ? CARD_TYPES[i % CARD_TYPES.length] : "",
      ccLast4: paymentMethod === "card" ? String(1000 + ((i * 13) % 8999)) : "",
      ccExp: paymentMethod === "card" ? `${String((i % 12) + 1).padStart(2, "0")}${String((26 + (i % 6))).padStart(2, "0")}` : "",
      ccName: paymentMethod === "card" ? `${firstName} ${lastName}` : "",
      referralSource: referredBySparse ? "MEMBER" : "OTHER",
      referredById: "",
      dateReferred: referredBySparse ? formatDateYYYYMMDD(signupDate) : "",
      typePhone1: PHONE_TYPES[i % PHONE_TYPES.length],
      typePhone2: PHONE_TYPES[(i + 1) % PHONE_TYPES.length],
      phone2: phoneFromIndex(i + 10000),
    };

    const emailSeed = `${firstName}.${lastName}.${String(i + 1).padStart(4, "0")}`.toLowerCase();
    const member = await Member.create({
      memberNumber: memberNumberFromIndex(i),
      email: `${emailSeed}@seed.oilcoop.local`,
      passwordHash: memberPassword,
      firstName,
      lastName,
      phone: phoneFromIndex(i),
      addressLine1: `${100 + (i % 890)} ${STREETS[i % STREETS.length]}`,
      city: place.city,
      state: place.state,
      postalCode: place.postalCode,
      role: "member",
      status,
      oilCompanyId: oilCompany._id,
      paymentMethod,
      autoRenew,
      stripeCustomerId: paymentMethod === "card" ? `cus_seed_${String(i + 1).padStart(5, "0")}` : "",
      stripeDefaultPaymentMethodId: paymentMethod === "card" && autoRenew ? `pm_seed_${String(i + 1).padStart(5, "0")}` : "",
      nextAnnualBillingDate: nextJuneFirstAfterSignup(signupDate),
      successfulReferralCount: referralCount,
      lifetimeAnnualFeeWaived: i % 111 === 0,
      referralWaiveCredits: i % 70 === 0 ? 1 : 0,
      registrationFeePaidAt: signupDate,
      lastAnnualChargeAt: billingStatus === "succeeded" || billingStatus === "mock" ? new Date() : null,
      lastAnnualChargeAmountCents: billingStatus === "succeeded" || billingStatus === "mock" ? 12000 : null,
      notificationSettings: {
        emailEnabled: true,
        renewalReminders: i % 5 !== 0,
        billingNotices: true,
        oilCompanyUpdates: true,
        marketing: i % 4 === 0,
        smsEnabled: i % 7 === 0,
        smsPhone: i % 7 === 0 ? phoneFromIndex(i) : "",
      },
      notes: `Sample customer ${i + 1}: payment=${billingStatus}, oil=${legacyProfile.oilWorkbenchStatus}.`,
      signedUpVia: i % 3 === 0 ? "phone" : i % 5 === 0 ? "admin" : "web",
      legacyProfile,
    });

    await BillingEvent.create({
      memberId: member._id,
      kind: "registration",
      amountCents: 5000,
      status: "succeeded",
      description: "Seed data: registration fee",
      billingYear: signupDate.getFullYear(),
      createdAt: signupDate,
      updatedAt: signupDate,
    });
    const annualYears = 1 + (i % 10); // 1-10 years of annual history
    const thisYear = new Date().getFullYear();
    for (let y = 0; y < annualYears; y++) {
      const year = thisYear - y;
      const statusForYear: BillingStatus =
        y === 0
          ? billingStatus
          : (y + i) % 9 === 0
            ? "waived"
            : (y + i) % 11 === 0
              ? "pending"
              : (y + i) % 13 === 0
                ? "failed"
                : "succeeded";
      const eventDate = new Date(year, 5, 1 + ((i + y) % 20));
      await BillingEvent.create({
        memberId: member._id,
        kind: "annual",
        amountCents: statusForYear === "waived" ? 0 : 12000,
        status: statusForYear,
        description: "Seed data: annual membership event",
        billingYear: year,
        createdAt: eventDate,
        updatedAt: eventDate,
      });
    }

    createdMembers.push({ _id: member._id, idx: i });
  }

  let referralLinks = 0;
  for (const rec of createdMembers) {
    if (rec.idx < 10 || rec.idx % 33 !== 0) continue;
    const referrer = createdMembers[rec.idx % 10];
    if (!referrer) continue;

    await Member.updateOne(
      { _id: rec._id },
      {
        $set: {
          referredByMemberId: referrer._id,
          "legacyProfile.referredById": memberNumberFromIndex(referrer.idx),
        },
      }
    );

    await Referral.create({
      newMemberId: rec._id,
      referrerMemberId: referrer._id,
      creditedAt: new Date(),
    });
    referralLinks++;
  }

  console.info(`Created ${createdMembers.length} sample customers.`);
  console.info(`Linked ${referralLinks} sparse referrals.`);
  console.info(`Assigned all customers across ${existingOilCompanies.length} existing oil companies.`);
  console.info("Seeded credentials: admin@example.com / Admin10..@");
  console.info("Seeded credentials: member emails use password MemberDemo!123");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
