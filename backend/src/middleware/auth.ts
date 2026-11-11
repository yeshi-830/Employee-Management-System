import type { NextFunction, Request, Response } from 'express';
import type { Role as DatabaseRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export type AppRole = 'admin' | 'hr_manager' | 'department_manager' | 'employee';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const appRoleByDatabaseRole: Record<DatabaseRole, AppRole> = {
  ADMIN: 'admin',
  HR_MANAGER: 'hr_manager',
  DEPARTMENT_MANAGER: 'department_manager',
  EMPLOYEE: 'employee',
};

export function authorize(roles: AppRole[]) {
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

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.ems_session;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : cookieToken;

  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token.' });
  }

  let userId: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      return res.status(401).json({ message: 'Authentication failed.' });
    }
    userId = payload.sub;
  } catch {
    return res.status(401).json({ message: 'Authentication failed.' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  });

  if (!user?.isActive) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    role: appRoleByDatabaseRole[user.role],
  };
  return next();
}

type AuthenticatedRequest = Request & { user?: AuthUser };
