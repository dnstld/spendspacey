import { parsePublicConfig } from './env';
import { authenticationAllowed } from './deployment';
import { scrubCallbackUrl } from './callbackRoute';

export async function bootstrapAuth(env: Record<string, unknown>) {
  try {
    if (authenticationAllowed()) {
      const config = parsePublicConfig(env, __AUTH_POLICY__.kind === 'local');
      return (await import('./supabase')).getSupabase(config);
    }
  } catch {
    // Neither invalid configuration nor denied origins may initialize Auth.
  }
  scrubCallbackUrl();
}
