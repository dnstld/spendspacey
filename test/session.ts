import type { Session } from '@supabase/supabase-js';

// Synthetic identity and unsigned token, exclusively for automated tests.
export function syntheticSession(): Session {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    email: 'person@example.test',
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: {
      full_name: 'Test Person',
      avatar_url: 'https://images.example.test/avatar.png',
    },
    created_at: '2026-01-01T00:00:00Z',
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, aud: 'authenticated', exp: now + 3600, iat: now, iss: 'https://auth.example.test/auth/v1' })}.synthetic-not-a-signature`,
    refresh_token: 'synthetic-refresh-token-not-valid',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user,
  };
}
