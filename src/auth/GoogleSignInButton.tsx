import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuth } from './context';
import { isPagesPreview } from '@/lib/deployment';

export function GoogleSignInButton() {
  const { t } = useTranslation();
  const { pending, signIn } = useAuth();
  return (
    <Button
      className="w-full border-[#747775] bg-white font-google text-[#1f1f1f]"
      variant="outline"
      disabled={isPagesPreview() || !!pending}
      aria-busy={pending === 'signIn'}
      onClick={() => void signIn()}
    >
      <img src="/google-g.png" alt="" className="size-5 object-contain" />
      {pending === 'signIn' ? t(($) => $.auth.signingIn) : t(($) => $.auth.signIn)}
    </Button>
  );
}
