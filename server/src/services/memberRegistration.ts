import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { Member } from "../models/Member.js";
import { BillingEvent } from "../models/BillingEvent.js";
import { OilCompany } from "../models/OilCompany.js";
import { config, stripeEnabled, authorizeNetEnabled } from "../config.js";
import { nextJuneFirstAfterSignup } from "../utils/juneBilling.js";
import { applyReferralCredit, findReferrerByToken } from "../services/referrals.js";
import { confirmPaymentIntent } from "../services/stripeBilling.js";
import { createProfileAndCharge } from "../services/authorizeNet.js";
import { sendWelcomeEmail, sendMemberEmail } from "../services/mail.js";
import { logActivity } from "../services/activity.js";

export const registerMemberSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional().default(""),
  addressLine1: z.string().optional().default(""),
  addressLine2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  paymentMethod: z.enum(["card", "check"]).default("card"),
  referrerToken: z.string().optional().default(""),
  paymentIntentId: z.string().optional(),
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
  oilCompanyId: z.string().nullable().optional(),
});

export type RegisterMemberInput = z.infer<typeof registerMemberSchema>;

export type RegisterMemberOptions = {
  signedUpVia?: "web" | "phone" | "admin";
  adminId?: string;
  sendWelcomeEmail?: boolean;
  notifyOilCompanyAssignment?: boolean;
};

export type RegisterMemberResult =
  | { ok: true; member: InstanceType<typeof Member> }
  | { ok: false; status: number; error: string; detail?: string; extra?: Record<string, unknown> };

async function nextMemberNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OC-${year}-`;
  const lastDocs = await Member.find({
    memberNumber: new RegExp(`^${prefix}`),
  })
    .sort({ memberNumber: -1 })
    .limit(1)
    .select("memberNumber")
    .lean();
  const last = lastDocs[0] as { memberNumber?: string } | undefined;
  let n = 1;
  if (last?.memberNumber) {
    const part = last.memberNumber.slice(prefix.length);
    const parsed = parseInt(part, 10);
    if (Number.isFinite(parsed)) n = parsed + 1;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export async function registerMember(
  body: RegisterMemberInput,
  options: RegisterMemberOptions = {}
): Promise<RegisterMemberResult> {
  const signedUpVia = options.signedUpVia ?? "web";
  const sendWelcome = options.sendWelcomeEmail !== false;
  const notifyOil = options.notifyOilCompanyAssignment !== false;

  const exists = await Member.findOne({ email: body.email.toLowerCase() });
  if (exists) {
    return { ok: false, status: 409, error: "Email already registered" };
  }

  let oilCompanyObjectId: mongoose.Types.ObjectId | null = null;
  if (body.oilCompanyId) {
    if (!mongoose.isValidObjectId(body.oilCompanyId)) {
      return { ok: false, status: 400, error: "Invalid oil company" };
    }
    const oc = await OilCompany.findById(body.oilCompanyId);
    if (!oc) {
      return { ok: false, status: 400, error: "Invalid oil company" };
    }
    oilCompanyObjectId = oc._id;
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const signupDate = new Date();
  const nextAnnual = nextJuneFirstAfterSignup(signupDate);
  const memberNumber = await nextMemberNumber();

  let referredByMemberId = undefined as undefined | mongoose.Types.ObjectId;
  if (body.referrerToken) {
    const ref = await findReferrerByToken(body.referrerToken);
    if (ref) referredByMemberId = ref._id;
  }

  let authnetCustomerProfileId = "";
  let authnetPaymentProfileId = "";
  let authnetCardLast4 = "";
  let authnetTransactionId = "";
  let stripePaymentIntentId = "";
  let paymentStatus: "succeeded" | "mock" | "pending" = "mock";

  if (body.paymentMethod === "card") {
    if (authorizeNetEnabled && body.cardNumber && body.cardExpiry && body.cardCvv) {
      const authnetResult = await createProfileAndCharge({
        merchantCustomerId: memberNumber,
        email: body.email.toLowerCase(),
        cardNumber: body.cardNumber,
        expirationDate: body.cardExpiry,
        cardCode: body.cardCvv,
        firstName: body.firstName,
        lastName: body.lastName,
        addressLine1: body.addressLine1,
        city: body.city,
        state: body.state,
        postalCode: body.postalCode,
        amountCents: config.registrationFeeCents,
        invoiceNumber: `REG-${memberNumber}`,
        description: "Co-op registration fee",
      });

      if (!authnetResult.ok) {
        return {
          ok: false,
          status: 402,
          error: "Payment failed",
          detail: authnetResult.error,
        };
      }

      authnetCustomerProfileId = authnetResult.customerProfileId;
      authnetPaymentProfileId = authnetResult.paymentProfileId;
      authnetCardLast4 = authnetResult.cardLast4;
      authnetTransactionId = authnetResult.transactionId;
      paymentStatus = "succeeded";
    } else if (stripeEnabled) {
      if (!body.paymentIntentId) {
        return { ok: false, status: 400, error: "paymentIntentId required when Stripe is enabled" };
      }
      try {
        const pi = await confirmPaymentIntent(body.paymentIntentId);
        if (pi.status !== "succeeded") {
          return {
            ok: false,
            status: 402,
            error: "Payment not completed",
            extra: { status: pi.status },
          };
        }
        if (pi.amount !== config.registrationFeeCents) {
          return { ok: false, status: 400, error: "Payment amount does not match registration fee" };
        }
        stripePaymentIntentId = body.paymentIntentId;
        paymentStatus = "succeeded";
      } catch (e) {
        return { ok: false, status: 402, error: "Payment verification failed", detail: String(e) };
      }
    } else if (!body.cardNumber) {
      paymentStatus = "mock";
    }
  } else {
    paymentStatus = "pending";
  }

  const member = await Member.create({
    memberNumber,
    email: body.email.toLowerCase(),
    passwordHash,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    addressLine1: body.addressLine1,
    addressLine2: body.addressLine2,
    city: body.city,
    state: body.state,
    postalCode: body.postalCode,
    paymentMethod: body.paymentMethod,
    autoRenew: body.paymentMethod === "card",
    nextAnnualBillingDate: nextAnnual,
    oilCompanyId: oilCompanyObjectId,
    signedUpVia,
    referredByMemberId: referredByMemberId ?? null,
    registrationFeePaidAt: paymentStatus === "succeeded" ? signupDate : null,
    authnetCustomerProfileId,
    authnetPaymentProfileId,
    authnetCardLast4,
    authnetCardExpiry: body.cardExpiry || "",
    notificationSettings: {
      emailEnabled: true,
      renewalReminders: true,
      billingNotices: true,
      oilCompanyUpdates: true,
      marketing: false,
      smsEnabled: false,
      smsPhone: "",
    },
  });

  await BillingEvent.create({
    memberId: member._id,
    kind: "registration",
    amountCents: config.registrationFeeCents,
    status: paymentStatus,
    stripePaymentIntentId: stripePaymentIntentId || undefined,
    authnetTransactionId: authnetTransactionId || undefined,
    cardLast4: authnetCardLast4 || undefined,
    description:
      paymentStatus === "pending"
        ? "Registration fee (awaiting check payment)"
        : "Registration fee (charged at signup)",
  });

  if (referredByMemberId) {
    await applyReferralCredit(member._id, referredByMemberId);
  }

  await logActivity(
    member._id,
    signedUpVia === "phone" ? "admin_phone_signup" : "member_registered",
    {
      memberNumber,
      nextAnnualBillingDate: nextAnnual.toISOString(),
      paymentProcessor: authnetTransactionId ? "authnet" : stripePaymentIntentId ? "stripe" : "none",
      signedUpVia,
      adminId: options.adminId,
    },
    options.adminId ? new mongoose.Types.ObjectId(options.adminId) : undefined
  );

  if (sendWelcome) {
    await sendWelcomeEmail(member);
  }

  if (oilCompanyObjectId && notifyOil) {
    const oc = await OilCompany.findById(oilCompanyObjectId);
    if (member.notificationSettings?.emailEnabled && member.notificationSettings?.oilCompanyUpdates) {
      await sendMemberEmail(
        member._id,
        member.email,
        "Your oil company has been assigned",
        `Hello ${member.firstName},\n\nYour heating oil broker has linked your membership to: ${oc?.name || "your oil company"}.\n`
      );
    }
  }

  return { ok: true, member };
}
