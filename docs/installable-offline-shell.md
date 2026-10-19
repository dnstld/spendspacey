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
storage. Wait for the localized “app shell is ready for offline use” status. It
means an activated controlling worker has verified every required cached response,
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
build allowlist. Build-generated revisions and SHA-256 integrity cover the exact
inventory. The separate worker TypeScript context has no DOM types. Installation
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
Workbox removes obsolete revisions at activation; only `spendspacey-static-` caches
are owned, with explicit cache-policy boundary `v1`. Other caches, SDK session
storage, locale preference and other origin data are preserved. A failed replacement
retains the old complete worker and shell, including offline launch.

Vite preload failures show localized connection/repair guidance where code can run.
Explicit online repair validates and replaces only missing/mismatched assets from
the active worker's own inventory, and reloads only after complete verification.
A sessionStorage guard bounds repair/reload to one attempt across a failed reload;
only a healthy controlled bootstrap clears it. Offline repair does nothing. Repair
is disabled during callbacks and cannot activate a waiting version. If a previous
release's assets are no longer hosted, close all app windows and reopen online to
activate a complete replacement. When entry code cannot run at all, browser-level
reconnect/close/reopen is needed; the app cannot display its own recovery UI then.

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
complete compatible replacement before using this procedure. The desktop v1/v2
suite demonstrates the mechanism; actual installed-iPhone update/rollback evidence
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
Auth/avatar/API traffic, and exercise complete/failed worker replacement, owned
cleanup and bounded repair. Existing canonical/preview/denied-origin, callback,
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
