import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { isCallbackPath } from '@/lib/callbackRoute';
import { pwaSnapshot, repairStaticShell, subscribePwa } from './lifecycle';

export function PwaFeedback() {
  const { t } = useTranslation();
  const state = useSyncExternalStore(subscribePwa, pwaSnapshot);
  return (
    <aside className="mt-6 space-y-3 text-center text-sm text-muted-foreground" aria-live="polite">
      <p data-testid="offline-readiness">
        {state.readiness === 'ready'
          ? t(($) => $.pwa.ready)
          : state.readiness === 'preparing'
            ? t(($) => $.pwa.preparing)
            : t(($) => $.pwa.unavailable)}
      </p>
      {state.waiting && <p>{t(($) => $.pwa.waiting)}</p>}
      {state.recovery && (
        <>
          <p role="alert">{t(($) => $.pwa.recovery)}</p>
          {!isCallbackPath(location.pathname) && (
            <Button
              variant="outline"
              disabled={state.repairing}
              onClick={() => void repairStaticShell()}
            >
              {t(($) => $.pwa.repair)}
            </Button>
          )}
        </>
      )}
    </aside>
  );
}
