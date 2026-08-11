import { Router } from "express";
import { getSiteContentValues } from "../services/siteContentStore.js";

const router = Router();

/** Public: content overrides for the marketing pages (key -> text). */
router.get("/", async (_req, res) => {
  const values = await getSiteContentValues();
  res.json({ values });
});

export default router;
