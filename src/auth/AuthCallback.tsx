import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuth } from './context';
import { exchangeOnce, readCallback } from './callback';
import { Feedback } from './Feedback';
import { GoogleSignInButton } from './GoogleSignInButton';
import type { AuthMessage } from './errors';
import { authenticationAllowed } from '@/lib/deployment';

export function AuthCallback() {
  const { client, message: operationMessage } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [input] = useState(() => readCallback(new URL(window.location.href)));
  const [message, setMessage] = useState<AuthMessage | null>(
    authenticationAllowed() ? (input.message ?? null) : 'previewAuthentication',
  );

  useEffect(() => {
    let active = true;
    // Capture input before cleanup; remounts reuse it and share the exchange promise.
    window.history.replaceState(window.history.state, '', '/auth/callback');
    if (authenticationAllowed() && input.code) {
      void exchangeOnce(client, input.code).then((result) => {
        if (!active) return;
        if (result.ok) void navigate('/', { replace: true });
        else setMessage(result.message);
      });
    }
    return () => {
      active = false;
    };
  }, [client, input, navigate]);

  if (!message) return <p role="status">{t(($) => $.auth.callbackLoading)}</p>;
  return (
    <>
      <Feedback message={operationMessage ?? message} />
      <GoogleSignInButton />
      <Button asChild variant="outline">
        <Link to="/" replace>
          {t(($) => $.common.back)}
        </Link>
      </Button>
    </>
  );
}
