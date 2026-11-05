import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PublicConfig } from './env';
import { authenticationAllowed } from './deployment';

let client: SupabaseClient | undefined;

export const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });

export function getSupabase(config: PublicConfig): SupabaseClient | undefined {
  if (!authenticationAllowed()) return;
  client ??= createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: { fetch: noStoreFetch },
  });
  return client;
}
