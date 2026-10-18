import type { SupabaseClient } from '@supabase/supabase-js';
import { authMessage, requireAuthStorage, type AuthMessage } from './errors';
import { authenticationAllowed } from '@/lib/deployment';

type CallbackInput = { code: string; message?: never } | { message: AuthMessage; code?: never };
type CallbackResult = { ok: true } | { ok: false; message: AuthMessage };
const exchanges = new WeakMap<SupabaseClient, Map<string, Promise<CallbackResult>>>();

export function readCallback(url: URL): CallbackInput {
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (['error', 'error_code'].some((key) => query.has(key) || fragment.has(key))) {
    const code =
      query.get('error_code') ??
      fragment.get('error_code') ??
      query.get('error') ??
      fragment.get('error');
    return { message: authMessage({ code }, 'callback') };
  }
  const code = query.get('code');
  return code ? { code } : { message: 'invalidCallback' };
}

export function exchangeOnce(client: SupabaseClient, code: string): Promise<CallbackResult> {
  if (!authenticationAllowed())
    return Promise.resolve({ ok: false, message: 'previewAuthentication' });
  let clientExchanges = exchanges.get(client);
  if (!clientExchanges) {
    clientExchanges = new Map();
    exchanges.set(client, clientExchanges);
  }
  let result = clientExchanges.get(code);
  if (!result) {
    result = (async (): Promise<CallbackResult> => {
      try {
        requireAuthStorage();
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        if (error) throw error;
        return data.session ? { ok: true } : { ok: false, message: 'invalidCallback' };
      } catch (error) {
        return { ok: false, message: authMessage(error, 'callback') };
      }
    })();
    clientExchanges.set(code, result);
  }
  return result;
}
