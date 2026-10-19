# Installable offline shell verification

Implementation branch: `feat/installable-offline-shell`. Baseline: clean, remote-verified
`main` at `d786441215a1c9e6fb2d048262fc4d09b5d79e44`. Node `24.21.0`, pnpm `10.27.0`.
The archived `deploy-auth-shell` has 8/8 completed tasks, recorded production/iPhone
acceptance and synchronized `web-delivery` specifications. No predecessor dependency
is outstanding. See [the inherited acceptance](deploy-auth-shell-acceptance.md).

## Local results

| Check                                                        | Result                                                                                                                                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen dependency install                                    | Passed; exact vite-plugin-pwa 2.0.0 and Workbox 7.4.1 pins                                                                                                                             |
| Prettier, ESLint, application and separate worker TypeScript | Passed                                                                                                                                                                                 |
| Unit/component suite                                         | 296 passed in 17 files                                                                                                                                                                 |
| Configuration rejection                                      | Passed startup/build/key/toolchain/input checks and 46 unsafe URL/Pages metadata builds                                                                                                |
| Local build                                                  | Passed; synthetic local Auth artifact                                                                                                                                                  |
| Pages build variants                                         | Passed production, preview and unclassified policy artifacts                                                                                                                           |
| PWA build inventory                                          | Passed each variant: stable manifest identity/colors/root scope, actual decoded 192/512/180 PNG sizes, metadata, 11 exact static assets, SHA-256 integrity and required lazy SDK chunk |
| Two complete worker builds                                   | Passed synthetic v1/v2 through the actual Vite/PWA pipeline                                                                                                                            |
| Chromium full regression suite                               | 42 passed: 31 inherited auth/origin/preview tests and 11 PWA tests                                                                                                                     |
| Strengthened icon diagnostic                                 | Passed decoded opaque pixels and maskable safe-circle padding                                                                                                                          |
| Secret scanning                                              | Passed repository candidate inventory, all synthetic local/Pages/PWA builds and Git history                                                                                            |
| Strict OpenSpec                                              | 7 passed, 0 failed; pre-existing informational notices for future/superseded planning deltas                                                                                           |
| Git whitespace                                               | Passed                                                                                                                                                                                 |

The Chromium tests validate manifest/installability diagnostics without a Lighthouse
score or install-prompt gate. They disable/clear HTTP caching and emulate both actual
network failure and the separate Chromium navigator connectivity state. An uncached
request must fail offline. Prepared reload/new-page launch passes in both languages;
first-ever unprepared offline launch has no app-owned shell. Worker/Cache Storage
unavailability preserves ordinary online Auth.

The privacy test performs synthetic sign-in, PKCE token exchange, restoration,
avatar fallback, sign-out, external Google navigation, cross-origin synthetic API
traffic, same-origin API/OAuth traffic, POSTs, authorization-bearing requests and
arbitrary static query variants. Every worker cache is inspected for allowed keys
and absence of synthetic identity/token/private markers. Controlled offline callbacks
receive only generic document bytes with no-store/no-referrer, scrub input, and do
not exchange/replay codes. Production canonical-origin and restricted preview tests
still assert no denied page SDK import/client construction or Auth request. Static
SDK _download by the worker_ is expected; it does not execute the SDK in a denied page.

Lifecycle tests exercise normal waiting with multiple open clients, complete v2
activation/offline reload, obsolete owned entry/cache cleanup, preservation of SDK
session/language/unrelated data, and failed replacement retaining the old complete
shell. Real missing/corrupt lazy imports trigger Vite recovery; repair is explicit,
online, integrity-checked, bounded across reload and disabled during callbacks.
Offline auth/expired restoration stays localized and usable. An actual SDK logout
500 can clear local SDK state: feedback reports that service sign-out was not
confirmed instead of inventing server revocation or keeping stale identity.

The existing Linux job retains its required check name and SHA-pinned actions.
Its new build/Chromium steps use only synthetic configuration and sanitized failure
artifacts. CI results are attached to the draft PR; local evidence is not presented
as a CI or production result.

## Scope and pending gates

**6/9 tasks complete:** 1.1, 1.2, 1.3, 2.1, 2.2, 3.1. The exact remaining tasks are:

- [ ] 3.2 After review/CI and the accepted merge to `main`, publish through the existing Pages GitHub integration at the predecessor's production origin. Verify actual worker/manifest bytes/MIME, root scope, revalidation, native SPA fallback without top-level `404.html` or catch-all rewrites, callback no-store/no-referrer, and CSP compatibility. Check required assets exist and reject fallback HTML as a valid worker/chunk; do not require arbitrary missing paths to return 404 or add Cloudflare runtime/storage products. Record version/URL/header outcomes without claiming local preview proves host behavior.
- [ ] 3.3 Have the PM record the iPhone model and tested iOS/Google Chrome versions, open the production Pages URL in Chrome, use Share → Add to Home Screen, confirm the Spendspacey name/intended icon, and launch from the Home Screen. Verify standalone web-app presentation rather than an ordinary browser bookmark/tab. From that installed app, complete online sign-in/identity/sign-out, reach static readiness, and verify airplane-mode reload and full close/reopen, both languages, safe areas, touch controls, avatar fallbacks, and reconnect guidance. Record sanitized versions/URL/revision/pass-fail evidence; desktop Chromium cannot replace this manual PM gate and Safari-specific manual acceptance is not required.
- [ ] 3.4 Publish a compatible accepted replacement merged into `main`, or identify a previously accepted complete production replacement, at that same origin and verify the waiting notice plus close-all-windows/reopen transition in the same installed iPhone Home Screen app added through Chrome; verify worker-aware recovery/rollback against complete builds. Record tested iOS/Chrome versions and sanitized update evidence without adding any application data feature.

The change stays unarchived; durable specs and later planning changes are untouched.
There is no profile access, private application store, outbox, queue, transaction,
CRUD, database/schema/RLS migration, Worker/Function, custom domain or new runtime.
No Cloudflare, Google, Supabase, DNS or GitHub setting or production data was changed.
The known non-required `Workers Builds: spendspacey` orphan trigger is left alone.
There is no approved-scope deviation. Actual Pages publication and installed-iPhone
online/offline/update evidence remain deliberately outstanding, as required.

## Changed file inventory

- `.github/workflows/checks.yml`
- `README.md`
- `build/pwa.ts`
- `docs/installable-offline-shell-verification.md`
- `docs/installable-offline-shell.md`
- `e2e/origin.spec.ts`
- `e2e/pwa-server.ts`
- `e2e/pwa.spec.ts`
- `index.html`
- `openspec/changes/installable-offline-shell/tasks.md`
- `package.json`
- `pnpm-lock.yaml`
- `public/_headers`
- `public/icons/app-192.png`
- `public/icons/app-512.png`
- `public/icons/apple-touch-icon.png`
- `public/icons/maskable-512.png`
- `scripts/check-delivery.mjs`
- `scripts/check-pwa.mjs`
- `scripts/generate-icons.mjs`
- `scripts/prepare-pwa-versions.mjs`
- `scripts/secret-scan.mjs`
- `src/auth/AuthProvider.tsx`
- `src/auth/AuthScreen.tsx`
- `src/auth/Offline.test.tsx`
- `src/auth/callback.ts`
- `src/auth/context.ts`
- `src/components/Shell.tsx`
- `src/i18n/en.ts`
- `src/i18n/pt-BR.ts`
- `src/index.css`
- `src/main.tsx`
- `src/pwa/PwaFeedback.tsx`
- `src/pwa/lifecycle.test.ts`
- `src/pwa/lifecycle.ts`
- `src/pwa/policy.test.ts`
- `tsconfig.worker.json`
- `vite.config.ts`
- `worker/policy.ts`
- `worker/sw.ts`
