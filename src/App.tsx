import { Navigate, Route, Routes } from 'react-router';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { Shell } from './components/Shell';
import { AuthProvider } from './auth/AuthProvider';
import { AuthScreen } from './auth/AuthScreen';
import { AuthCallback } from './auth/AuthCallback';
import { useEffect } from 'react';
import { authenticationAllowed } from './lib/deployment';
import { callbackRoute, scrubCallbackUrl } from './lib/callbackRoute';
import { GoogleSignInButton } from './auth/GoogleSignInButton';

export default function App({ client }: { client?: SupabaseClient }) {
  const { t } = useTranslation();
  const allowed = authenticationAllowed();
  useEffect(() => {
    if (!client || !allowed) scrubCallbackUrl();
  }, [client, allowed]);
  if (!client || !allowed) {
    return (
      <Shell>
        <h1 className="text-4xl font-semibold">Spendspacey</h1>
        <GoogleSignInButton />
        <p role="alert">
          {allowed ? t(($) => $.errors.configuration) : t(($) => $.errors.previewAuthentication)}
        </p>
      </Shell>
    );
  }
  return (
    <AuthProvider client={client}>
      <Shell>
        <Routes>
          <Route path="/" element={<AuthScreen />} />
          <Route {...callbackRoute} element={<AuthCallback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </AuthProvider>
  );
}
