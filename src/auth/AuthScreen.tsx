import { ContasMark } from '@/components/ContasMark';
import { Shell } from '@/components/Shell';
import { FinanceWorkspace } from '@/finance/workspace';
import { PwaFeedback } from '@/pwa/PwaFeedback';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from './context';
import { Feedback } from './Feedback';
import { GoogleSignInButton } from './GoogleSignInButton';
import { authenticationAllowed } from '@/lib/deployment';
import { useCurrentProfile } from '@/profile/useCurrentProfile';

export function AuthScreen() {
  const { t } = useTranslation();
  const { status, session, generation, client, message, pending, retry, signIn, signOut } =
    useAuth();
  const user = session?.user;
  const { state: currentProfile, retry: retryProfile } = useCurrentProfile({
    client,
    ownerId: user?.id ?? null,
    generation,
    enabled: status === 'ready' && pending !== 'signOut',
  });
  if (!user && status === 'initializing')
    return (
      <Shell>
        <p role="status">{t(($) => $.auth.loading)}</p>
      </Shell>
    );
  if (!user && status === 'error')
    return (
      <Shell>
        <Feedback message={message} />
        <Button onClick={retry}>{t(($) => $.common.retry)}</Button>
      </Shell>
    );
  const profile = currentProfile.profile;
  const name = profile?.displayName?.trim() || t(($) => $.profile.unknownName);
  const initials = profile?.displayName?.trim()
    ? profile.displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
    : '?';
  if (user)
    return (
      <FinanceWorkspace
        client={client}
        userId={user.id}
        key={`${user.id}:${generation}`}
        connected={status === 'ready' && pending !== 'signOut'}
        account={
          <div className="space-y-5 border-t pt-5 text-center">
            <section
              className="flex w-full flex-col items-center gap-5"
              aria-label={t(($) => $.profile.card)}
            >
              {profile && (
                <Avatar size="lg">
                  <AvatarImage
                    src={profile.avatarUrl ?? undefined}
                    alt={t(($) => $.profile.avatar, { name })}
                    referrerPolicy="no-referrer"
                  />
                  <AvatarFallback role="img" aria-label={t(($) => $.profile.avatarFallback)}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
              )}
              {profile && (
                <h1 className="w-full break-words text-2xl font-semibold tracking-tight">{name}</h1>
              )}
              {currentProfile.status === 'loading' && !profile && (
                <p role="status">{t(($) => $.profile.loading)}</p>
              )}
              {currentProfile.status === 'missing' && (
                <p role="status">{t(($) => $.profile.missing)}</p>
              )}
              {(currentProfile.status === 'error' || currentProfile.status === 'offline') && (
                <>
                  <p role="alert">
                    {t(($) =>
                      currentProfile.status === 'offline' ? $.profile.offline : $.profile.error,
                    )}
                  </p>
                  <Button variant="outline" onClick={retryProfile}>
                    {t(($) => $.profile.retry)}
                  </Button>
                </>
              )}
              {currentProfile.status === 'stale' && (
                <p role="status">{t(($) => $.profile.stale)}</p>
              )}
            </section>
            <div className="w-full space-y-2 break-words">
              <p className="text-sm text-muted-foreground">
                {user.email || t(($) => $.auth.unknownEmail)}
              </p>
            </div>
            <Button
              className="w-full"
              variant="outline"
              disabled={!!pending}
              aria-busy={pending === 'signOut'}
              onClick={() => void signOut()}
            >
              {pending === 'signOut' ? t(($) => $.auth.signingOut) : t(($) => $.auth.signOut)}
            </Button>
            <Feedback message={message} />
            {message === 'offlineSignOut' && (
              <Button variant="outline" onClick={() => void signOut(true)}>
                {t(($) => $.common.connectionRetry)}
              </Button>
            )}
            <PwaFeedback />
          </div>
        }
      />
    );
  return (
    <Shell>
      <ContasMark alt="" className="size-16 rounded-2xl shadow-sm" />
      <h1 className="mb-4 text-4xl font-semibold tracking-tight">Spendspacey</h1>
      <GoogleSignInButton />
      {message === 'offlineSignIn' && (
        <Button variant="outline" onClick={() => void signIn(true)}>
          {t(($) => $.common.connectionRetry)}
        </Button>
      )}
      <Feedback message={authenticationAllowed() ? message : 'previewAuthentication'} />
    </Shell>
  );
}
