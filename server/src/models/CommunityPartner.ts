import mongoose, { Schema, type InferSchemaType } from "mongoose";

const communityPartnerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true, default: "" },
    blurb: { type: String, default: "" },
    websiteUrl: { type: String, trim: true, default: "" },
    /** Card photo URL (e.g. /site/... or absolute). */
    imageUrl: { type: String, trim: true, default: "" },
    logoUrl: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

communityPartnerSchema.index({ active: 1, sortOrder: 1 });

export type CommunityPartnerDoc = InferSchemaType<typeof communityPartnerSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CommunityPartner =
  mongoose.models.CommunityPartner || mongoose.model("CommunityPartner", communityPartnerSchema);
