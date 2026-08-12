import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Single-document store for editable marketing-site copy. Each entry maps a
 * content key (e.g. "ourStory.lead") to the admin-supplied text that overrides
 * the built-in default shipped in the client's content registry. Only keys the
 * admin has changed are stored; everything else falls back to the default.
 *
 * Entries are stored as an ARRAY of { key, value } pairs rather than a Map /
 * keyed object on purpose: the content keys are dot-namespaced (e.g.
 * "services.heroTitle"), and MongoDB forbids "." in field names. Storing them
 * as field names (which a Map does) makes every save throw a MongoServerError
 * — here the dotted key is just a string value, which is always legal.
 *
 * The `singleton` field is unique so there is always exactly one content record.
 */
const contentEntrySchema = new Schema(
  {
    key: { type: String, required: true },
    value: { type: String, default: "" },
  },
  { _id: false }
);

const siteContentSchema = new Schema(
  {
    singleton: { type: String, default: "site-content", unique: true },
    entries: { type: [contentEntrySchema], default: [] },
  },
  { timestamps: true }
);

export type SiteContentDoc = InferSchemaType<typeof siteContentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SiteContent =
  mongoose.models.SiteContent || mongoose.model("SiteContent", siteContentSchema);
