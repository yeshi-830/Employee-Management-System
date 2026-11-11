import type { Request } from 'express';

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
