# Installable offline shell

This implements only `installable-offline-shell`, change 2/4. `deploy-auth-shell`
was archived with 8/8 tasks and synchronized delivery specs before work started
from main `d786441215a1c9e6fb2d048262fc4d09b5d79e44`. Its production and phone
acceptance is recorded in [deployment acceptance](deploy-auth-shell-acceptance.md).
The provider settings, disabled signups, two public application variables, toolchain,
canonical-origin policy, and Pages GitHub/main delivery remain as accepted there.
This change does not access profiles or introduce private application persistence.

## Installation and limits

After review, required CI, accepted merge into `main`, and automatic publication
through the existing Pages integration, use **https://spendspacey.pages.dev** in
**Google Chrome on an iPhone**. Choose **Share → Add to Home Screen**, confirm
**Spendspacey** and the green s-dot icon, then open it from the Home Screen.
Confirm standalone web-app presentation, rather than an icon opening a browser tab.
No custom install prompt or browser/user-agent detection is used. The stable
manifest id/start/scope are `/`, independent of language or account. The layout
supports safe areas and zoom; ordinary, maskable and Apple PNGs derive from the
existing mark. `node scripts/generate-icons.mjs` reproduces them with local Chromium.
The maskable mark fits inside the central 80% safe circle on an opaque background.

Prime **the installed context itself** online; a prior Chrome tab may have separate
storage. On the first online visit, wait for localized “Prepared for offline; reload
or reopen to finish” guidance. All resources, verified completion and selection are
already persisted; the next ordinary load acquires control even offline. There is
no forced reload or `clients.claim()`. On that next load, “ready for offline use”
means the controlling worker has verified every required cached response,
MIME and SHA-256 digest, including both bundled locales, all chunks (also the lazy
Auth SDK), local font, button image, manifest and icons. Then airplane-mode hard
reload and full close/reopen can load the static shell. Device language detection,
explicit preferences and English fallback retain the existing behavior.

First-ever offline launch, cleared/evicted browser storage, unsupported workers or
unavailable Cache Storage cannot promise offline launch. First-ever offline launch
may show the browser's network error. Where app code can run, the app reports that
offline readiness is unavailable and asks for connection. Normal online Auth remains
available without worker support. A timed-out or offline session refresh shows
localized retry guidance while leaving language controls available; it does not
confirm sign-out or invent an offline identity. Fresh sign-in and sign-out need
network. An explicit connection retry is available even when connectivity hints
are pessimistic. No operation is queued or replayed on reconnect. The pinned SDK can clear its local session even when sign-out returns an error; the app follows that SDK state and explains that service sign-out was not confirmed. Offline callbacks
scrub their query/fragment and offer return/fresh-online-login recovery, without
consuming a code or clearing an otherwise usable SDK session.

## Static boundary and lifecycle

`vite-plugin-pwa` 2.0.0 and Workbox 7.4.1 use injectManifest with a reviewed static
build allowlist. Emitted `index.html` supplies revision/SHA-256 bytes for canonical
`/`; `/index.html` is never in the inventory or requested during preparation. The
browser fixture reproduces Pages’ 308 canonicalization. Build-generated revisions
and SHA-256 integrity cover the exact inventory. The separate worker TypeScript context has no DOM types. Installation
omits credentials and rejects redirects, fallback HTML and incorrect MIME/bytes.
No runtime caching route exists. Only exact approved same-origin static GETs and
query-free root navigation use the cache. Authorization-bearing requests, non-GET,
query variants, Supabase/Auth/API/OAuth/Google and foreign avatars use the native
network. An exact `/auth/callback` navigation can receive a clone of generic entry
bytes with `no-store`/`no-referrer`; neither its URL nor any callback response is
stored. Router-recognized callback variants retain existing online cleanup tests;
the worker's offline navigation allowance intentionally covers the canonical path.

`/sw.js` stays stable with root scope, `updateViaCache: none`, revalidation, JavaScript
MIME and `Service-Worker-Allowed: /`. The manifest revalidates with manifest JSON
MIME. CSP explicitly permits same-origin workers and manifests. Existing exact
hashed immutable rules, callback controls, native Pages fallback, and no top-level
404/catch-all rewrite remain. Vite preview and our synthetic header server do not
prove Cloudflare delivery: task 3.2 remains an actual-host gate.

Registration runs in production builds, including the separate local test builds;
Vite development does not register. Launch, online foreground and reconnect checks
are coalesced with one in-flight check and a 30-second floor. A replacement must
finish installing before the localized waiting notice appears. Close **all** app
windows and reopen to activate. There is no skipWaiting or controller-change reload.
The worker keeps isolated `spendspacey-static-resource-v2-<instance>` caches and a
reserved `spendspacey-static-meta-v2` cache. Only that metadata namespace is
enumerated for discovery. Strict bounded schema/ownership/identity/origin/scope,
canonical inventory/MIME/size/integrity, completion bindings and an immutable
parent-linked selection ledger establish deterministic lineage. Metadata hashes
are consistency checks, not an Auth or durability boundary. Metadata is never
fetched, routed or repaired. Compatibility includes routing, offline-response,
Auth/deployment, canonical origin/scope and a configuration digest; no keys or
private values are persisted there. Worker identity binds the pre-injection implementation digest and the canonical
inventory; selected-generation identity is separate, so a new worker can serve a verified older shell.

Every startup restores committed selection and all fetch/status handling waits for
initialization. Resources precede verified completion, then selection. Activation
revalidates every replacement byte; a damaged waiting build retains/selects the
independently verified predecessor. If neither works, neither is deleted. Existing
windows stay pinned and unusable resources report recovery instead of borrowing
another generation's chunks. Missing/contradictory/unsupported/incompatible or
ambiguous metadata fails closed; cache order and timestamps never resolve it.

Selected plus independently verified compatible fallback is a retention target,
not a two-cache ceiling. Cleanup requires no windows at all, including uncontrolled,
hidden, unknown or unresponsive windows, no installing/waiting worker and reliable
origin-wide coordination. Any uncertainty defers deletion. Immutable reservations
protect unselected installations/staging, and persisted in-flight repair references
protect source resources. Only exact historically selected caches outside the
retained set can be deleted. Origin-wide Web Locks coordinate worker versions;
without them repair/cleanup defer. Legacy `b9c61fe` caches have no trustworthy
descriptors: do not migrate/select/delete them. SDK storage, locale and unrelated
caches remain untouched. Metadata is bounded to 1,024 records of at most 64 KiB;
unsupported/over-limit state reports unavailable and defers cleanup rather than
attempting guessed compaction. Each inventory is at most 128 entries, 2 MiB per
resource and 8 MiB total.

Explicit repair persists its unique attempt boundary **before** network work,
then verifies copied/downloaded canonical resources in a separate reserved staging
cache. A cross-worker single-flight lock and a cancelling 12-second total deadline
bound it. Failure, interruption, cancellation or offline status never selects
staging, removes the working generation or automatically retries. The same attempt
ID cannot be replayed after termination. A later explicit click creates a new
attempt. Repair is blocked during callback/Auth processing and never makes an
Auth/token/API request. Successful repair shows localized close/reopen guidance;
it never reloads or changes active windows. The first fresh root navigation after
all earlier relevant windows close commits the single successful pending result;
a reload (`isReload`/`replacesClientId` navigation hints) is not that boundary. Unknown navigation hints defer promotion. Restart alone never promotes
it. If a pinned selection is damaged, a verified committed fallback can likewise
be selected only on a fresh launch after closure. Multiple successful results or
uncertain clients defer selection. When entry code cannot run, reconnect and close
all windows/reopen; the app cannot display recovery UI without executable code.

## Worker-aware rollback

Publish only a reviewed accepted complete build from `main` through existing Pages
GitHub integration. Do not promote a preview, change settings, add runtime products,
or treat a missing hash-looking asset's fallback HTML as JavaScript. Verify every
required worker/chunk by bytes and MIME against its accepted build inventory.
A code-only revert does not remove an installed worker. Restore a previously
accepted **complete** build with a compatible recovery worker at the same `/sw.js`
URL and root scope. Retain policy-compatible caches until complete installation and
normal activation; tell users to close all app windows and reopen online. Verify
online sign-in/callback and then offline launch on the installed iPhone. Do not
clear SDK session storage, locale preference, unrelated caches, or production data.
If no accepted PWA replacement exists yet, stop publication and prepare/review a
complete compatible replacement before using this procedure. The desktop v1 → v2 → v1
suite demonstrates complete rollback and damaged-v2 fallback; actual installed-iPhone update/rollback evidence
remains task 3.4.

## Verification and pending acceptance

Run with Node 24.21.0 and pnpm 10.27.0:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:config
pnpm build:test
pnpm test:delivery
pnpm test:pwa
pnpm test:pwa:versions
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
pnpm secret:scan
pnpm spec:validate
```

All builds and browser requests use synthetic inputs; PR CI has no provider/host
credentials or live account. Manifest diagnostics and focused worker tests run in
the existing Chromium/Linux job, with synthetic-only failure artifacts, pinned
actions, no Lighthouse score gate and no additional browser matrix. The tests use
CDP to clear/disable HTTP caching, await activation/control and readiness, exercise
both locales offline on reload/new pages, inspect every worker cache after synthetic
Auth/avatar/API traffic, and exercise complete/corrupted waiting replacement, restart, rollback, conservative
cleanup and staged repair without live switching. Engine tests cover persistence
interruptions, metadata rejection, three-generation retention, cross-worker
coordination and successful/failed/offline/timed-out/cancelled/interrupted repair. Existing canonical/preview/denied-origin, callback,
localization, SDK failure/race, build/header/CSP and secret checks remain required.

Tasks **3.2, 3.3, 3.4 remain unchecked** until post-merge hosted and PM evidence:

- **3.2:** Record accepted/deployed main revision, URL, worker/manifest bytes and
  MIME, root scope, revalidation, CSP, callback no-store/no-referrer (with query),
  native fallback, and complete required-asset content/type outcomes.
- **3.3:** Record iPhone model, tested iOS/Chrome versions, revision/URL and sanitized
  pass/fail for Chrome Share installation, intended name/icon, actual standalone
  launch; online sign-in/identity/sign-out in that installed app; readiness then
  airplane-mode reload/full close/reopen; both languages, safe areas, touch controls,
  avatar fallbacks and reconnect guidance. Desktop Chromium is supplemental.
- **3.4:** Record a compatible accepted replacement revision at the same origin,
  iOS/Chrome versions and sanitized waiting notice, close-all-windows/reopen and
  worker-aware update/recovery/rollback results in that same installed iPhone app.

Never record identity values, real tokens/codes, account screenshots, or live-account
traces. Safari-specific manual acceptance is not required. Keep the change unarchived
and later changes planning-only until publication/phone/update acceptance passes.
