import { createClient } from '@supabase/supabase-js';
import { env, supabaseReady } from './env.js';

export const adminSupabase = supabaseReady
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
export const publicSupabase = env.SUPABASE_URL && env.SUPABASE_ANON_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
