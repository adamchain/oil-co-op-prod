import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { getTemplateDefinitions } from "../services/emailTemplateStore.js";
import { EmailTemplate, EMAIL_TEMPLATE_KEYS } from "../models/EmailTemplate.js";

/**
 * Rewrites every email template's name/description/subject/html/text/variables
 * to the current code defaults, which are now MIDDLE-CONTENT ONLY (the shared
 * letterhead + "Sincerely, Rosemary A. Stanko, President" signature are applied
 * automatically at send time). Existing `enabled` flags are preserved.
 *
 * Run after deploying the new letterhead so old rows that still contain a
 * "Hi {firstName}," greeting / sign-off are refreshed:
 *   npm run reseed-templates                       (uses local .env)
 *   MONGODB_URI="<prod uri>" npm run reseed-templates
 */
async function main() {
  await connectDb();
  const defs = getTemplateDefinitions();

  let updated = 0;
  for (const key of EMAIL_TEMPLATE_KEYS) {
    const d = defs[key];
    const res = await EmailTemplate.updateOne(
      { key },
      {
        $set: {
          name: d.name,
          description: d.description,
          subject: d.subject,
          html: d.html,
          text: d.text,
          variables: d.variables,
        },
        $setOnInsert: { key, enabled: true },
      },
      { upsert: true }
    );
    if (res.modifiedCount || res.upsertedCount) updated += 1;
    console.log(`  refreshed  ${key}`);
  }

  console.log(`Reseeded ${updated} template(s) to middle-only bodies.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
