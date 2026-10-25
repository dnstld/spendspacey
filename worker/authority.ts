// Compare native objects in the same realm. URLs and build hashes identify
// scripts, not the running registration instance. Unsupported proof fails closed.
export function isBrowserActive(scope: {
  registration: { readonly active: ServiceWorker | null; readonly scope: string };
  readonly location: { readonly origin: string };
  readonly serviceWorker?: ServiceWorker;
}): boolean {
  const running = scope.serviceWorker;
  return (
    scope.registration.scope === scope.location.origin + '/' &&
    !!running &&
    scope.registration.active === running &&
    (running.state === 'activating' || running.state === 'activated')
  );
}
