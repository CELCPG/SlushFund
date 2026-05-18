import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Allow requests to pass through if not configured (demo mode)
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
export const supabaseAdmin = isSupabaseConfigured && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;