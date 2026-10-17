import { Navigate, Route, Routes } from 'react-router';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { Shell } from './components/Shell';
import { AuthProvider } from './auth/AuthProvider';
import { AuthScreen } from './auth/AuthScreen';
import { AuthCallback } from './auth/AuthCallback';

export default function App({ client }: { client?: SupabaseClient }) {
  const { t } = useTranslation();
  if (!client) {
    return (
      <Shell>
        <p role="alert">{t(($) => $.errors.configuration)}</p>
      </Shell>
    );
  }
  return (
    <AuthProvider client={client}>
      <Shell>
        <Routes>
          <Route path="/" element={<AuthScreen />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </AuthProvider>
  );
}
