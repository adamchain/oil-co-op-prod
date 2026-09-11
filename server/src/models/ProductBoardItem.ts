import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const PRODUCT_BOARD_PHASES = ["new", "in_progress", "testing", "deployed"] as const;
export type ProductBoardPhase = (typeof PRODUCT_BOARD_PHASES)[number];

const productBoardItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: "", trim: true },
    phase: {
      type: String,
      enum: PRODUCT_BOARD_PHASES,
      default: "new",
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    createdByName: { type: String, default: "", trim: true },
    createdById: { type: Schema.Types.ObjectId, ref: "Member", default: null },
  },
  { timestamps: true }
);

productBoardItemSchema.index({ phase: 1, sortOrder: 1, createdAt: 1 });

export type ProductBoardItemDoc = InferSchemaType<typeof productBoardItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ProductBoardItem =
  mongoose.models.ProductBoardItem || mongoose.model("ProductBoardItem", productBoardItemSchema);
