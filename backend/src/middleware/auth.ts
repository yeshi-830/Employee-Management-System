import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sanitizeUser, users, type User } from '../lib/mockData.js';

export interface AuthenticatedRequest extends Request {
  user?: Omit<User, 'password'>;
}

declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, 'password'>;
    }
  }
}

export function authorize(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }

    return next();
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.ems_session;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : cookieToken;

  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token.' });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; role: string; email: string };
    const user = users.find((member) => member.id === payload.sub);

    if (!user) {
      return res.status(401).json({ message: 'Invalid user session.' });
    }

    req.user = sanitizeUser(user);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed.' });
  }
}
