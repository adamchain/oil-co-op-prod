import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDb() {
  if (!process.env.MONGODB_URI && process.env.RAILWAY_ENVIRONMENT) {
    console.error(
      "[db] MONGODB_URI is not set. Railway has no MongoDB on localhost.\n" +
        "    In the Railway server service → Variables, add MONGODB_URI (e.g. MongoDB Atlas connection string)."
    );
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri);
}
