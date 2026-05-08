import type { Request, Response, NextFunction } from "express";
import { auth } from "../lib/firebase.js";

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = header.slice(7);
  try {
    const decoded = await auth.verifyIdToken(token);
    (req as any).uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function optionalToken(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    try {
      const decoded = await auth.verifyIdToken(token);
      (req as any).uid = decoded.uid;
    } catch {}
  }
  next();
}
