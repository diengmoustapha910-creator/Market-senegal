import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import type { User } from './types.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionToken?: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.cookies?.session_token as string);

  if (!token) {
    return next();
  }

  try {
    const session = await db.getSession(token);
    if (!session) {
      return next();
    }
    const user = await db.getUserById(session.user_id);
    if (user) {
      req.user = user;
      req.sessionToken = token;
    }
  } catch (err) {
    console.error('[Auth] Erreur vérification session:', err);
  }

  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise. Veuillez vous connecter.' });
  }
  next();
}

export function requireSeller(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  if (req.user.role !== 'vendeur' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux vendeurs enregistrés.' });
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès strictement réservé aux administrateurs.' });
  }
  next();
}
