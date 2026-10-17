import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PublicConfig } from './env';

let client: SupabaseClient | undefined;

export function getSupabase(config: PublicConfig): SupabaseClient {
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
