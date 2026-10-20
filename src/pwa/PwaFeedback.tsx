import { useContext, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '@/auth/context';
import { Button } from '@/components/ui/button';
import { isCallbackPath } from '@/lib/callbackRoute';
import { pwaSnapshot, repairStaticShell, subscribePwa } from './lifecycle';

export function PwaFeedback() {
  const { t } = useTranslation();
  const auth = useContext(AuthContext);
  const blocked =
    !!auth?.pending || auth?.status === 'initializing' || isCallbackPath(location.pathname);
  const state = useSyncExternalStore(subscribePwa, pwaSnapshot);
  return (
    <aside className="mt-6 space-y-3 text-center text-sm text-muted-foreground" aria-live="polite">
      <p data-testid="offline-readiness">
        {state.readiness === 'ready'
          ? t(($) => $.pwa.ready)
          : state.readiness === 'prepared'
            ? t(($) => $.pwa.prepared)
            : state.readiness === 'preparing'
              ? t(($) => $.pwa.preparing)
              : t(($) => $.pwa.unavailable)}
      </p>
      {state.waiting && <p>{t(($) => $.pwa.waiting)}</p>}
      {state.repaired && <p>{t(($) => $.pwa.repaired)}</p>}
      {state.recovery && !state.repaired && (
        <>
          <p role="alert">{t(($) => $.pwa.recovery)}</p>
          {!blocked && (
            <Button
              variant="outline"
              disabled={state.repairing}
              onClick={() => void repairStaticShell(blocked)}
            >
              {t(($) => $.pwa.repair)}
            </Button>
          )}
        </>
      )}
    </aside>
  );
}
