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

if (fs.existsSync(clientDist)) {
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

await connectDb();
startScheduledJobs();

app.listen(config.port, () => {
  console.info(`API listening on http://localhost:${config.port}`);
});
