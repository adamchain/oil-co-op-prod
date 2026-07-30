import mongoose, { Schema, type InferSchemaType } from "mongoose";

const communityEventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    /** Event date as YYYY-MM-DD (optional for undated blurbs). */
    eventDate: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    blurb: { type: String, default: "" },
    imageUrl: { type: String, trim: true, default: "" },
    /** upcoming = left column; recent = right column with photo. */
    kind: { type: String, enum: ["upcoming", "recent"], default: "upcoming" },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

communityEventSchema.index({ kind: 1, active: 1, eventDate: -1 });

export type CommunityEventDoc = InferSchemaType<typeof communityEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CommunityEvent =
  mongoose.models.CommunityEvent || mongoose.model("CommunityEvent", communityEventSchema);
