import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PublicConfig } from './env';
import { isPagesPreview } from './deployment';

let client: SupabaseClient | undefined;

export function getSupabase(config: PublicConfig): SupabaseClient {
  client ??= createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: !isPagesPreview(),
      autoRefreshToken: !isPagesPreview(),
    },
  });
  return client;
}
