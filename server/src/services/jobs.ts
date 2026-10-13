import cron from "node-cron";
import { runAnnualRenewal } from "./renewals.js";

// Note: this co-op does not send any email automatically. The June 1 cron below
// still charges cards on file, but never emails members — staff send any
// receipts, reminders, or notices manually from the admin UI.

async function runJuneFirstAnnualBilling() {
  const today = new Date();
  if (today.getUTCMonth() !== 5 || today.getUTCDate() !== 1) return;
  const report = await runAnnualRenewal({ date: today });
  console.info(`June 1 renewal: ${report.total} members`, report.counts);
}

export function startScheduledJobs() {
  cron.schedule("5 12 * * *", () => {
    void runJuneFirstAnnualBilling();
  });
  console.info("Cron scheduled: daily 12:05 UTC — June 1 annual billing (no automatic emails)");
}
