import 'dotenv/config';

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET ?? 'replace-me-with-a-long-random-secret',
  DATABASE_URL: process.env.DATABASE_URL ?? 'mysql://root:root_password@localhost:3306/employee_management',
};
