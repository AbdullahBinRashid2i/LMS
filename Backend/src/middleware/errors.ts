import type { NextFunction, Request, Response } from 'express';
export function notFound(_req: Request, res: Response) { res.status(404).json({ error: 'Route not found.' }); }
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  console.error(error);
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
  res.status(statusCode).json({ error: process.env.NODE_ENV === 'production' && statusCode >= 500 ? 'Unexpected server error.' : message });
}
