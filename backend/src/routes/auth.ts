import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { appRoleByDatabaseRole, authenticate } from '../middleware/auth.js';

const router = Router();
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

router.post('/login', loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'A valid email and password are required.' });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user?.isActive || !(await bcrypt.compare(parsed.data.password, user?.password ?? ''))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, {
    expiresIn: '8h',
    issuer: 'employee-management-system',
  });
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const cookieOptions = {
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  };

  res.cookie('ems_session', token, {
    ...cookieOptions,
    httpOnly: true,
  });
  res.cookie('__csrf', csrfToken, {
    ...cookieOptions,
    httpOnly: false,
  });

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: appRoleByDatabaseRole[user.role],
    },
    csrfToken,
    message: 'Login successful.',
  });
});

router.get('/me', authenticate, (req, res) => {
  return res.json({ user: req.user });
});

router.post('/logout', (_req, res) => {
  const cookieOptions = {
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
  };
  res.clearCookie('ems_session', { ...cookieOptions, httpOnly: true });
  res.clearCookie('__csrf', { ...cookieOptions, httpOnly: false });
  return res.json({ message: 'Logged out successfully.' });
});

export default router;
