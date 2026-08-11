import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Single-document store for editable marketing-site copy. `values` maps a
 * content key (e.g. "ourStory.lead") to the admin-supplied text that overrides
 * the built-in default shipped in the client's content registry. Only keys the
 * admin has changed are stored; everything else falls back to the default. The
 * `singleton` field is unique so there is always exactly one content record.
 */
const siteContentSchema = new Schema(
  {
    singleton: { type: String, default: "site-content", unique: true },
    values: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

export type SiteContentDoc = InferSchemaType<typeof siteContentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SiteContent =
  mongoose.models.SiteContent || mongoose.model("SiteContent", siteContentSchema);
