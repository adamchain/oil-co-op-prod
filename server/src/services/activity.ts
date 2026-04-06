import { ActivityLog } from "../models/ActivityLog.js";
import type mongoose from "mongoose";

export async function logActivity(
  memberId: mongoose.Types.ObjectId,
  action: string,
  details: Record<string, unknown> = {},
  actorId?: mongoose.Types.ObjectId | null
) {
  await ActivityLog.create({ memberId, action, details, actorId: actorId ?? null });
}
