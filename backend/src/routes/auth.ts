import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sanitizeUser, users } from '../lib/mockData.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = users.find((member) => member.email.toLowerCase() === email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.JWT_SECRET, {
    expiresIn: '8h',
  });

  const csrfToken = crypto.randomBytes(32).toString('hex');

  res.cookie('ems_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.cookie('__csrf', csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  });

  return res.json({
    user: sanitizeUser(user),
    csrfToken,
    message: 'Login successful.',
  });
});

router.get('/me', authenticate, (req, res) => {
  return res.json({
    user: req.user,
  });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('ems_session');
  res.clearCookie('__csrf');
  return res.json({ message: 'Logged out successfully.' });
});

export default router;
