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
| Unit/component suite                                         | 349 passed in 19 files                                                                                                                                                                 |
| Configuration rejection                                      | Passed startup/build/key/toolchain/input checks and 46 unsafe URL/Pages metadata builds                                                                                                |
| Local build                                                  | Passed; synthetic local Auth artifact                                                                                                                                                  |
| Pages build variants                                         | Passed production, preview and unclassified policy artifacts                                                                                                                           |
| PWA build inventory                                          | Passed each variant: stable manifest identity/colors/root scope, actual decoded 192/512/180 PNG sizes, metadata, 11 exact static assets, SHA-256 integrity and required lazy SDK chunk |
| Two complete worker builds                                   | Passed synthetic v1/v2 through the actual Vite/PWA pipeline                                                                                                                            |
| Chromium full regression suite                               | 48 passed: 31 inherited auth/origin/preview tests and 17 PWA tests                                                                                                                     |
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

The fixture now returns Pages-style HTTP 308 for `/index.html` (including query
preservation). Worker installation never requests that URL: only canonical `/` is
precached, with revision, SHA-256, size and MIME derived from emitted `index.html`.
The first online visit fully prepares before control; the next ordinary reload
acquires control offline with HTTP cache disabled. Unknown/missing/API/query paths
have no worker fallback. Unexpected redirects, opaque or wrong-URL responses,
wrong MIME and incorrect bytes are rejected.

The 46 real-engine generation tests exercise resource/completion/selection
interruption, discovery after restart, enumeration-order independence, untrusted
metadata rejection (structure/schema/configuration/origin/scope/inventory/mapping/
MIME/integrity/completion/ambiguity/worker-build binding), independent predecessor verification, neither
usable, complete v1 → v2 → v1 rollback, three-generation retention and cleanup,
controlled/uncontrolled/hidden/unresponsive/newly navigating clients, stale-owner
and activation-ticket rejection, concurrent startup/status/fetch/activation/repair/
cleanup and cross-worker installation protection. Persisted reservations bind each
installation to its observed committed parent so an older activation cannot append
over a newer selection. Origin-wide Web Locks serialize short mutations; network
installation/repair does not block the older offline shell.

Repair tests exercise success, offline/failure/timeout/cancellation/interruption,
persisted attempt boundaries before requests, non-replay after restart, single
flight, separate staging, verified copy/download and unchanged selected resources
on failure. Live/reloaded windows keep their generation; a successful pending
repair is selected only after every earlier window closes and a fresh root launch
occurs. Unknown navigation hints defer selection. Chromium additionally terminates
workers, reloads and navigates without live switching, deletes/corrupts the waiting
v2 entry before offline activation, confirms v1 selection/restoration, and verifies
complete v1 → v2 → v1 rollback. Callback/Auth processing blocks repair. Metadata
never enters the network, routing or repair inventory. Legacy v1 and unrelated
caches, SDK and locale storage are preserved. Missing coordination or an unusable
fallback defers cleanup.

New feedback tests cover prepared/repaired guidance in both languages and suppress
repair during initialization, sign-in, sign-out and callbacks. Offline Auth/expired
restoration stays localized and usable. The actual SDK logout-500 regression is
retained: cleared local state is reflected without claiming server revocation.

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

## Correction file areas

- `build/pwa.ts`, `vite.config.ts`, `scripts/check-pwa.mjs`: canonical emitted inventory,
  compatibility/build digests and generated output assertions.
- `worker/schema.ts`, `worker/generations.ts`, `worker/policy.ts`, `worker/sw.ts`:
  bounded durable metadata, strict isolated generation routing, startup/activation,
  recovery, rollback and conservative ownership/cleanup.
- `src/pwa/*`, both locale files: preparation/control distinction, explicit repair,
  localized close/reopen guidance and Auth-processing guards.
- `test/staticGenerations.ts`, worker/unit/component tests, `e2e/pwa-server.ts`,
  `e2e/pwa.spec.ts`: real-engine fault injection plus actual-worker Pages regressions.
- Active proposal/design/installable-app delta/tasks and installation runbook:
  corrected lifecycle, migration boundaries, verification and pending acceptance.

Tasks 1.3 and 2.2 were reopened for correction and re-completed only after corrected
implementation and representative engine/browser regressions passed. Tasks 1.2 and
3.1 retain fresh full-suite evidence above. Historical b9c61fe results do not prove
the corrected lifecycle; this record supersedes their implementation assertions.
