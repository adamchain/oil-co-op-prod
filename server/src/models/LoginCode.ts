import mongoose, { Schema, type InferSchemaType } from "mongoose";

const loginCodeSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

loginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginCodeDoc = InferSchemaType<typeof loginCodeSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const LoginCode =
  mongoose.models.LoginCode || mongoose.model("LoginCode", loginCodeSchema);
