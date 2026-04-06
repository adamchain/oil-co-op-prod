import mongoose from "mongoose";
import { config, hasMongoEnv } from "./config.js";

export async function connectDb() {
  if (process.env.RAILWAY_ENVIRONMENT && !hasMongoEnv()) {
    console.error(
      "[db] No MongoDB connection string in environment. Railway has no DB on localhost.\n" +
        "    On the API service → Variables, set one of:\n" +
        "      MONGODB_URI   (e.g. MongoDB Atlas)\n" +
        "      MONGO_URL / MONGO_URI (Railway Mongo plugin or copied connection string)\n" +
        "    Or add a variable reference from your Railway Mongo service to MONGO_URL."
    );
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri);
}
