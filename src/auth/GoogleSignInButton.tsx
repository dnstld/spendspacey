import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useContext } from 'react';
import { AuthContext } from './context';
import { authenticationAllowed } from '@/lib/deployment';

export function GoogleSignInButton() {
  const { t } = useTranslation();
  const auth = useContext(AuthContext);
  const pending = auth?.pending;
  return (
    <Button
      className="w-full border-[#747775] bg-white font-google text-[#1f1f1f]"
      variant="outline"
      disabled={!auth || !authenticationAllowed() || !!pending}
      aria-busy={pending === 'signIn'}
      onClick={() => void auth?.signIn()}
    >
      <img src="/google-g.png" alt="" className="size-5 object-contain" />
      {pending === 'signIn' ? t(($) => $.auth.signingIn) : t(($) => $.auth.signIn)}
    </Button>
  );
}
