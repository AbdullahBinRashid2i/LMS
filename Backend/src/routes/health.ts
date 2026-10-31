import { Router } from 'express';
import { supabaseReady } from '../config/env.js';
import { adminSupabase } from '../config/supabase.js';
const router = Router();
router.get('/', (_req, res) => {
  void (async () => {
    let connected = false;
    let databaseError: string | undefined;
    if (supabaseReady && adminSupabase) {
      const { error } = await adminSupabase.from('profiles').select('id').limit(1);
      connected = !error;
      if (error) databaseError = error.message;
    }
    res.status(connected ? 200 : 503).json({
      status: connected ? 'ok' : 'degraded', service: 'gutech-lms-api',
      configured: { supabase: supabaseReady }, connected: { database: connected },
      ...(databaseError ? { databaseError } : {}),
    });
  })().catch((error: unknown) => res.status(503).json({ status: 'degraded', service: 'gutech-lms-api', configured: { supabase: supabaseReady }, connected: { database: false }, databaseError: error instanceof Error ? error.message : 'Database check failed.' }));
});
export default router;
