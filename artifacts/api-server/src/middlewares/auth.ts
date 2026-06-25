import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET: string = (() => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET environment variable is required");
  return s;
})();

export interface JwtPayload {
  userId: number;
  role: "customer" | "seller" | "admin" | "courier";
  email: string | null;
  isVerified: boolean;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Optional JWT authentication — populates req.user if a valid Bearer token is present.
 * Never returns 401 — silently skips if no/invalid token. Use for routes that are
 * public but expose extra features to authenticated users (e.g., debug ranking).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as JwtPayload;
      req.user = payload;
    } catch {
      /* ignore invalid tokens — user stays unauthenticated */
    }
  }
  next();
}

export function requireRole(role: "customer" | "seller" | "admin" | "courier") {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

/**
 * Verifies the authenticated user's account is active (not suspended/disabled/blocked).
 * Must be placed AFTER requireAuth. Does a single indexed DB lookup per request.
 * Returns 403 with error code ACCOUNT_SUSPENDED so the client can redirect.
 */
export async function requireActiveAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [user] = await db
      .select({ accountStatus: usersTable.accountStatus, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.userId));

    if (!user || user.accountStatus !== "active") {
      res.status(403).json({
        error: "ACCOUNT_SUSPENDED",
        accountStatus: user?.accountStatus ?? "disabled",
        message: "Your account has been suspended. Please contact support.",
      });
      return;
    }

    if (req.user.role === "seller" && user.role !== "seller") {
      res.status(403).json({
        error: "ROLE_CHANGED",
        message: "Your account role has changed. Please log in again.",
      });
      return;
    }

    if (req.user.role === "courier" && user.role !== "courier") {
      res.status(403).json({
        error: "ROLE_CHANGED",
        message: "Your account role has changed. Please log in again.",
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
