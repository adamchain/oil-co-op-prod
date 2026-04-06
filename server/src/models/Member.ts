import mongoose, { Schema, type InferSchemaType } from "mongoose";

const notificationSettingsSchema = new Schema(
  {
    emailEnabled: { type: Boolean, default: true },
    renewalReminders: { type: Boolean, default: true },
    billingNotices: { type: Boolean, default: true },
    oilCompanyUpdates: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
    smsEnabled: { type: Boolean, default: false },
    smsPhone: { type: String, default: "" },
  },
  { _id: false }
);

const memberSchema = new Schema(
  {
    memberNumber: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    addressLine1: { type: String, default: "", trim: true },
    addressLine2: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    postalCode: { type: String, default: "", trim: true },

    role: { type: String, enum: ["member", "admin"], default: "member" },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },

    /** Staff assigns oil company after signup (dropdown in admin). */
    oilCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "OilCompany",
      default: null,
    },

    referredByMemberId: {
      type: Schema.Types.ObjectId,
      ref: "Member",
      default: null,
    },

    paymentMethod: {
      type: String,
      enum: ["card", "check"],
      default: "card",
    },
    autoRenew: { type: Boolean, default: true },
    stripeCustomerId: { type: String, default: "" },
    stripeDefaultPaymentMethodId: { type: String, default: "" },

    /** Next annual membership billing (always aligned to June 1 cycle). */
    nextAnnualBillingDate: { type: Date, required: true },

    /** Successful referrals credited to this member (as referrer). */
    successfulReferralCount: { type: Number, default: 0 },
    /** Five referrals → all future June annual fees waived. */
    lifetimeAnnualFeeWaived: { type: Boolean, default: false },
    /** Each referral adds one credit; one credit skips one June 1 annual charge. */
    referralWaiveCredits: { type: Number, default: 0 },

    registrationFeePaidAt: { type: Date, default: null },
    lastAnnualChargeAt: { type: Date, default: null },
    lastAnnualChargeAmountCents: { type: Number, default: null },

    notificationSettings: { type: notificationSettingsSchema, default: () => ({}) },

    /** Reminder tracking for current June cycle (reset when June billing runs). */
    reminderSent30d: { type: Boolean, default: false },
    reminderSent7d: { type: Boolean, default: false },
    reminderSent1d: { type: Boolean, default: false },
    reminderCycleYear: { type: Number, default: null },

    notes: { type: String, default: "" },
    signedUpVia: { type: String, enum: ["web", "phone", "admin"], default: "web" },
  },
  { timestamps: true }
);

memberSchema.index({ lastName: 1, firstName: 1 });
memberSchema.index({ phone: 1 });
memberSchema.index({ status: 1 });

export type MemberDoc = InferSchemaType<typeof memberSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Member =
  mongoose.models.Member || mongoose.model("Member", memberSchema);
