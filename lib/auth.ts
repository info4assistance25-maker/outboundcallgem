import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "JWT_SECRET non configurato. Imposta una stringa lunga e casuale nelle variabili d'ambiente (Vercel Secrets / .env)."
  );
}
const SECRET = JWT_SECRET || "dev-only-insecure-secret-do-not-use-in-production";

export interface SessionPayload {
  username: string;
  isAdmin: boolean;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export function issueSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "12h" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request & { session?: SessionPayload }, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, error: "Autenticazione richiesta" });
  }
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ ok: false, error: "Sessione non valida o scaduta" });
  }
  req.session = session;
  next();
}

export function requireAdmin(req: Request & { session?: SessionPayload }, res: Response, next: NextFunction) {
  if (!req.session?.isAdmin) {
    return res.status(403).json({ ok: false, error: "Permessi insufficienti (richiesto ruolo Admin)" });
  }
  next();
}
