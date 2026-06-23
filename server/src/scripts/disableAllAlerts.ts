import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { ensureEmailTemplates } from "../services/emailTemplateStore.js";
import { EmailTemplate, EMAIL_TEMPLATE_KEYS } from "../models/EmailTemplate.js";

/**
 * Turns off every alert email by setting `enabled: false` on all templates.
 * Triggered/alert sends (welcome, renewal reminders, payment notices, oil
 * company assignment, …) check this flag and skip when disabled. Manual admin
 * sends (test email, custom email, payment link from the workbench) are not
 * affected. Re-enable individual alerts from the admin Email Templates UI.
 *
 * Run with the target DB in env, e.g.:
 *   npm run disable-alerts                  (uses local .env)
 *   MONGODB_URI="<prod uri>" npm run disable-alerts
 */
async function main() {
  await connectDb();
  // Make sure a document exists for every alert type before disabling.
  await ensureEmailTemplates();

  const result = await EmailTemplate.updateMany(
    { key: { $in: EMAIL_TEMPLATE_KEYS } },
    { $set: { enabled: false } }
  );

  console.log(`Disabled alert emails on ${result.modifiedCount} template(s).`);

  const rows = await EmailTemplate.find({ key: { $in: EMAIL_TEMPLATE_KEYS } })
    .select("key enabled")
    .sort({ key: 1 })
    .lean<{ key: string; enabled?: boolean }[]>();
  for (const r of rows) {
    console.log(`  ${r.enabled ? "ON " : "OFF"}  ${r.key}`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
