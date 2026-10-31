import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export function validateBody(schema: ZodType) {
  const middleware: RequestHandler = (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid request body.', issues: parsed.error.flatten() }); return; }
    req.body = parsed.data;
    next();
  };
  return middleware;
}
