import type { Request } from 'express';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getRouteParam(req: Request, name: string) {
  const value = req.params[name];
  if (typeof value === 'string') return value;
  if (value?.[0]) return value[0];
  throw new ApiError(`Missing route parameter: ${name}.`, 400);
}

export function parsePagination(req: Request) {
  const parsed = z.object({
    page: z.coerce.number().int().min(1).max(100000),
    pageSize: z.coerce.number().int().min(1).max(100),
  }).safeParse({
    page: req.query.page ?? 1,
    pageSize: req.query.pageSize ?? 100,
  });
  if (!parsed.success) throw new ApiError('Invalid pagination values.', 400);
  return parsed.data;
}
