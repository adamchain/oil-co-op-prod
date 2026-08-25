import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { connectDb } from "./db.js";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import adminRoutes from "./routes/admin.js";
import deliveriesRoutes from "./routes/deliveries.js";
import paymentsRoutes from "./routes/payments.js";
import oilPricesRoutes from "./routes/oilPrices.js";
import communityRoutes from "./routes/community.js";
import siteContentRoutes from "./routes/siteContent.js";
import {
  EDITABLE_IMAGE_PATHS,
  getSiteImageAsset,
  getSiteImageOverride,
  loadSiteImageCache,
} from "./services/siteImageStore.js";
import { startScheduledJobs } from "./services/jobs.js";

// Express 4 does NOT forward errors thrown inside async route handlers to the
// error middleware; the rejection is unhandled and, on modern Node, terminates
// the process. That means one bad request could take the whole API down (502
// for every user). Log and keep running instead so a single failing request
// degrades to a hung/timed-out response rather than a full outage.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

const app = express();

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const publicAssets = path.join(repoRoot, "public");
const clientDist = path.join(repoRoot, "client/dist");

// Admin-uploaded image replacements win over the on-disk build assets. This
// runs BEFORE express.static and only for the known editable image paths, so
// every other asset request skips straight to the static handlers. When there
// is no override, we fall through and the original file is served as usual.
app.get(EDITABLE_IMAGE_PATHS, (req, res, next) => {
  const override = getSiteImageOverride(req.path);
  if (!override) {
    next();
    return;
  }
  res.set("Content-Type", override.contentType);
  res.set("Cache-Control", "no-cache");
  res.send(override.data);
});

// Public, origin-stable URL for the editable marketing images. The client (a
// separate service in prod, Vite dev server locally) requests these through the
// API so admin replacements actually win — a root-relative <img src> would load
// the original from the client host and never reach the override store. Serves
// the override if one exists, else the bundled original.
app.get("/api/site-images/asset/*", (req, res, next) => {
  const rel = (req.params as unknown as Record<string, string>)[0] ?? "";
  const asset = getSiteImageAsset(`/${rel}`);
  if (!asset) {
    next();
    return;
  }
  res.set("Content-Type", asset.contentType);
  res.set("Cache-Control", "no-cache");
  res.send(asset.data);
});

if (fs.existsSync(publicAssets)) {
  app.use(express.static(publicAssets));
}
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);
// Raise the body limit above Express's 100 KB default: the Site Content editor
// and rich email templates can POST large payloads (hundreds of fields, long
// HTML), and the Site Content image editor POSTs replacement photos as base64
// data URLs. Over the limit, express.json() destroys the request stream
// mid-upload, which the browser surfaces as an opaque "Failed to fetch" rather
// than a 413.
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/oil-prices", oilPricesRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/site-content", siteContentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/deliveries", deliveriesRoutes);
app.use("/api/payments", paymentsRoutes);

if (fs.existsSync(clientDist)) {
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Bind on 0.0.0.0 so Railway/public proxy can reach the container (localhost-only breaks routing).
// Listen before DB connect so /api/health can respond while Mongo is still connecting.
app.listen(config.port, "0.0.0.0", () => {
  console.info(
    `API listening on http://0.0.0.0:${config.port} (process.env.PORT=${process.env.PORT ?? "unset"})`
  );
});

await connectDb();
// Warm the admin image-override cache so replacements survive restarts.
await loadSiteImageCache().catch((err) => console.error("Failed to load site image overrides", err));
startScheduledJobs();
