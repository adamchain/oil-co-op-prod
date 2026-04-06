import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { Member } from "../models/Member.js";
import type { MemberDoc } from "../models/Member.js";

export type AuthedRequest = Request & {
  userId?: string;
  member?: MemberDoc | null;
};

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    const member = await Member.findById(payload.sub);
    if (!member) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }
    req.userId = payload.sub;
    req.member = member;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.member?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
}

export function signToken(memberId: string) {
  return jwt.sign({ sub: memberId }, config.jwtSecret, { expiresIn: "7d" });
}
