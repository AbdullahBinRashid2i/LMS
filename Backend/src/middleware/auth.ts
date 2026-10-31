import type { RequestHandler } from 'express';
import { adminSupabase, publicSupabase } from '../config/supabase.js';
import type { UserRole } from '../services/accountService.js';

export type AuthUser = { id: string; email?: string };
declare global { namespace Express { interface Request { user?: AuthUser } } }
export const requireAuth: RequestHandler = (req, res, next) => {
  void (async () => {
    if (!publicSupabase || !adminSupabase) {
      res.status(503).json({ error: 'Supabase URL, anon key, and server-only service role key are required on the backend.' });
      return;
    }
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'A bearer access token is required.' }); return; }
    const { data, error } = await publicSupabase.auth.getUser(header.slice(7));
    if (error || !data.user) { res.status(401).json({ error: 'Your session is invalid or expired.' }); return; }
    req.user = { id: data.user.id, email: data.user.email };
    next();
  })().catch(next);
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      if (!req.user || !adminSupabase) { res.status(401).json({ error: 'Sign in is required.' }); return; }
      const { data, error } = await adminSupabase.from('profiles').select('role').eq('id', req.user.id).maybeSingle();
      if (error) throw error;
      if (!data || !roles.includes(data.role as UserRole)) { res.status(403).json({ error: 'Your account does not have permission for this action.' }); return; }
      next();
    })().catch(next);
  };
}
