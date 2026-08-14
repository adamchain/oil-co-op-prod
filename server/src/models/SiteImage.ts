import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Admin-uploaded replacements for the fixed marketing-site images. Each document
 * holds the raw bytes for one known image path (e.g. "/site/house.jpg"); when a
 * document exists, the server serves these bytes in place of the file shipped in
 * the build. Only paths the admin has actually replaced have a document —
 * every other image falls through to the static file on disk.
 *
 * The `path` is unique so there is at most one override per image slot.
 */
const siteImageSchema = new Schema(
  {
    path: { type: String, required: true, unique: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

export type SiteImageDoc = InferSchemaType<typeof siteImageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SiteImage =
  mongoose.models.SiteImage || mongoose.model("SiteImage", siteImageSchema);
