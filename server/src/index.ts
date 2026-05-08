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
import { startScheduledJobs } from "./services/jobs.js";

const app = express();

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const publicAssets = path.join(repoRoot, "public");
const clientDist = path.join(repoRoot, "client/dist");
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
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
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
startScheduledJobs();
