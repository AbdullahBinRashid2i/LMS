import express, { type RequestHandler } from 'express';
import cors from 'cors';
import helmet, { type HelmetOptions } from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import healthRouter from './routes/health.js';
import apiRouter from './routes/api.js';
import { errorHandler, notFound } from './middleware/errors.js';

const app = express();
const securityHeaders = (helmet as unknown as (options?: Readonly<HelmetOptions>) => RequestHandler)();
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(cors({ origin: env.FRONTEND_URL, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/health', healthRouter);
app.use('/api', apiRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
