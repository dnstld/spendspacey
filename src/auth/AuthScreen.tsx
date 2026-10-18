import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from './context';
import { Feedback } from './Feedback';
import { GoogleSignInButton } from './GoogleSignInButton';
import { isPagesPreview } from '@/lib/deployment';

function safeImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {
    /* Invalid identity metadata uses the fallback. */
  }
}

export function AuthScreen() {
  const { t } = useTranslation();
  const { status, session, message, pending, retry, signOut } = useAuth();
  if (status === 'initializing') return <p role="status">{t(($) => $.auth.loading)}</p>;
  if (status === 'error')
    return (
      <>
        <Feedback message={message} />
        <Button onClick={retry}>{t(($) => $.common.retry)}</Button>
      </>
    );

  const user = session?.user;
  const rawName: unknown = user?.user_metadata.full_name ?? user?.user_metadata.name;
  const name =
    typeof rawName === 'string' && rawName.trim() ? rawName : t(($) => $.auth.unknownName);
  const initials =
    typeof rawName === 'string' && rawName.trim()
      ? rawName
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase()
      : '?';
  return (
    <>
      {user ? (
        <>
          <Avatar>
            <AvatarImage
              src={safeImage(user.user_metadata.avatar_url ?? user.user_metadata.picture)}
              alt={t(($) => $.auth.avatar)}
              referrerPolicy="no-referrer"
            />
            <AvatarFallback role="img" aria-label={t(($) => $.auth.avatarFallback)}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="w-full space-y-2 break-words">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
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
        </>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-2xl bg-primary text-3xl font-semibold text-white shadow-sm"
          >
            s<span className="text-[#b5d994]">.</span>
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight">Spendspacey</h1>
          <GoogleSignInButton />
        </>
      )}
      <Feedback message={isPagesPreview() ? 'previewAuthentication' : message} />
    </>
  );
}
