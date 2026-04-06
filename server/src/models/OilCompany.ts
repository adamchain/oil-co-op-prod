import mongoose, { Schema, type InferSchemaType } from "mongoose";

const oilCompanySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    contactEmail: { type: String, trim: true, default: "" },
    contactPhone: { type: String, trim: true, default: "" },
    notes: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type OilCompanyDoc = InferSchemaType<typeof oilCompanySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OilCompany =
  mongoose.models.OilCompany || mongoose.model("OilCompany", oilCompanySchema);
