import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { ApiError } from './lib/apiError.js';
import { prisma } from './lib/prisma.js';
import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import departmentsRouter from './routes/departments.js';
import employeesRouter from './routes/employees.js';
import leaveRequestsRouter from './routes/leaveRequests.js';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use((req, res, next) => {
  if (req.path === '/api/auth/login') {
    return next();
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const csrfHeader = req.headers['x-csrf-token'];
    const csrfCookie = req.cookies?.__csrf;

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({ message: 'Invalid CSRF token. Refresh the page and try again.' });
    }
  }

  return next();
});

app.use('/api/auth', authRouter);

app.use('/api/dashboard', dashboardRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/leave-requests', leaveRequestsRouter);

app.get('/api/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Request validation failed.', issues: err.issues });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'A record with the supplied unique value already exists.' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'The requested record was not found.' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ message: 'The request references a record that does not exist.' });
    }
  }

  console.error(err);

  return res.status(500).json({
    message: env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : 'Internal server error',
  });
});

app.listen(env.PORT, () => {
  console.log(`EMS API running on http://localhost:${env.PORT}`);
});

export default app;
