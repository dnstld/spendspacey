import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PublicConfig } from './env';
import { authenticationAllowed } from './deployment';

let client: SupabaseClient | undefined;

export function getSupabase(config: PublicConfig): SupabaseClient | undefined {
  if (!authenticationAllowed()) return;
  client ??= createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}
