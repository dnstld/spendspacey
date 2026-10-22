// Compare native objects in the same realm. URLs and build hashes identify
// scripts, not the running registration instance. Unsupported proof fails closed.
export function isBrowserActive(scope: {
  registration: { readonly active: ServiceWorker | null };
  readonly serviceWorker?: ServiceWorker;
}): boolean {
  const running = scope.serviceWorker;
  return (
    !!running &&
    scope.registration.active === running &&
    (running.state === 'activating' || running.state === 'activated')
  );
}
