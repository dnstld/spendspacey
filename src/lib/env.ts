export interface PublicConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export function parsePublicConfig(env: Record<string, unknown>): PublicConfig {
  const invalid: string[] = [];
  const rawUrl = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let url: URL | undefined;

  try {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) throw new Error();
    url = new URL(rawUrl);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    invalid.push('VITE_SUPABASE_URL');
  }

  if (typeof key !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    invalid.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  if (invalid.length) throw new Error(`Invalid public configuration: ${invalid.join(', ')}`);

  return Object.freeze({ supabaseUrl: url!.origin, supabasePublishableKey: key as string });
}
