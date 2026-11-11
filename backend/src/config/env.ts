import 'dotenv/config';
import { z } from 'zod';

const defaultJwtSecret = 'replace-this-with-a-long-random-secret';

const config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32).default(defaultJwtSecret),
  DATABASE_URL: z.string().min(1).default('mysql://ems_user:ems_password@localhost:3306/employee_management'),
});

const parsedConfig = config.safeParse(process.env);

if (!parsedConfig.success) {
  const details = parsedConfig.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

if (parsedConfig.data.NODE_ENV === 'production' && parsedConfig.data.JWT_SECRET === defaultJwtSecret) {
  throw new Error('JWT_SECRET must be set to a unique secret in production.');
}

export const env = parsedConfig.data;
