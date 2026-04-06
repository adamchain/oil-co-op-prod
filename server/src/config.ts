import "dotenv/config";

const cents = (v: string | undefined, fallback: number) => {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

/** Railway Mongo plugin often sets MONGO_URL; Atlas / docs usually use MONGODB_URI. */
const LOCAL_MONGO_FALLBACK = "mongodb://127.0.0.1:27017/oilcoop";

function resolveMongoUri(): string {
  const keys = ["MONGODB_URI", "MONGO_URL", "MONGO_URI", "MONGODB_URL"] as const;
  for (const key of keys) {
    const v = process.env[key]?.trim();
    if (v && /^mongodb(\+srv)?:\/\//i.test(v)) return v;
  }
  return LOCAL_MONGO_FALLBACK;
}

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  mongoUri: resolveMongoUri(),
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me-in-production-32chars",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  registrationFeeCents: cents(process.env.REGISTRATION_FEE_CENTS, 5000),
  annualFeeCents: cents(process.env.ANNUAL_FEE_CENTS, 12000),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
  emailFrom: process.env.EMAIL_FROM || "Oil Co-op <noreply@example.com>",
};

export const stripeEnabled = Boolean(config.stripeSecretKey);

/** True when any supported Mongo env var is set (not the local dev default). */
export function hasMongoEnv(): boolean {
  return config.mongoUri !== LOCAL_MONGO_FALLBACK;
}
