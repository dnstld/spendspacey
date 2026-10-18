import { supabaseOrigin } from './origin.ts';

export interface PublicConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export function parsePublicConfig(env: Record<string, unknown>, allowLocal = false): PublicConfig {
  const allowed = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (Object.keys(env).some((key) => key.startsWith('VITE_') && !allowed.includes(key))) {
    throw new Error('Only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are public inputs.');
  }
  const invalid: string[] = [];
  const rawUrl = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let origin: string | undefined;

  try {
    origin = supabaseOrigin(rawUrl, allowLocal);
  } catch {
    invalid.push('VITE_SUPABASE_URL');
  }

  if (typeof key !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    invalid.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  if (invalid.length) throw new Error(`Invalid public configuration: ${invalid.join(', ')}`);

  return Object.freeze({ supabaseUrl: origin!, supabasePublishableKey: key as string });
}
