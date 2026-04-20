import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export type AdminJwtPayload = {
  sub: string;
  role: 'admin' | 'editor';
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
    }
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  if (config.ADMIN_AUTH_DISABLED) {
    req.admin = {
      sub: 'dev-admin',
      role: 'admin',
      email: config.ADMIN_BOOTSTRAP_EMAIL
    };
    return next();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    req.admin = jwt.verify(header.slice(7), config.JWT_SECRET) as AdminJwtPayload;
    return next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export function requireRole(role: 'admin' | 'editor') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (req.admin.role !== role && req.admin.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    return next();
  };
}
