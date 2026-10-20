# Design

## Context

See [proposal.md](proposal.md), [installable-app](specs/installable-app/spec.md), and [auth delta](specs/user-auth/spec.md). This is change 2/4. Apply only after `deploy-auth-shell` is implemented, published, accepted on the phone, and its durable specs synchronized. Today's source has no PWA; that predecessor supplies Cloudflare Pages Free static delivery at its assigned production `*.pages.dev` origin, not a browser worker or profile query. Inherit GitHub integration, exact Node/pnpm pins, the two public application variables, production only from accepted changes merged into `main`, disabled new-user signups, exact local/production callbacks, and disabled preview authentication. No Cloudflare Functions, Workers, server runtime, Wrangler application, or Cloudflare database/storage products are introduced.

## Goals / Non-Goals

**Goals:** Make the hosted auth shell installable and launchable offline, with strict static caching and safe worker lifecycle.

**Non-Goals:** Current-user profile query, new private persistence, Dexie/IndexedDB, offline authentication, backend mutations, or synchronization. Existing SDK session storage is not replaced or copied.

## Decisions

### 1. Build-generated static precache with a custom worker

Use pinned `vite-plugin-pwa` 2.0.0 and Workbox 7.4.1 build discovery in `injectManifest` mode with an authored generation engine. Workbox supplies emitted revisions; the engine owns strict fetching, metadata, routing and isolated caches rather than Workbox's shared runtime precache. Avoid handwritten revision discovery.

Include canonical `/` generated from emitted `index.html`, every required hashed JS/CSS chunk (including the dynamically imported Supabase module), local font/Google button image, manifest, and named app icons. Use a reviewed build allowlist rather than unrestricted public globs; exclude maps, fixtures, environment files, worker script, API paths, and user data. Static fetches carry no application authorization.

Guard sensitive traffic before convenience precache routes. Exact approved static GETs use revisioned precache; same-origin root navigation uses the generic entry. Exact callback navigation can receive an uncached clone of that generic entry with no-store/no-referrer, never a stored callback response or callback-URL cache key. Supabase/API/OAuth, images from other origins, non-GET, and authorization-bearing requests use network without runtime cache writes. Other URLs/query variants use normal network behavior. Disable broad query ignoring/clean-URL expansion that widens the static allowlist. Fragments are scrubbed by the app, not the worker.

Register only in production; use a separate worker TypeScript context. Offline readiness requires complete precaching and an activated/controlling launch path, not just a visible page. Public Supabase URL/key in compiled static code are allowed public configuration, not cached private API responses. [Worker modes](https://vite-pwa-org.netlify.app/guide/inject-manifest), [Workbox revisions](https://developer.chrome.com/docs/workbox/modules/workbox-precaching)

### 2. Minimal installation identity

Use stable manifest id, root scope/start URL, Spendspacey name, standalone display, matching colors, 192/512 ordinary PNGs, a safe-padded maskable icon, and Apple touch icon/mobile metadata. Reuse the existing brand and keep zoom/safe areas usable. Use web standards and feature detection for service workers, storage, and standalone presentation; do not detect browsers or user-agent strings. Browser installation UI is enough; no custom install-prompt framework, screenshots, splash-image matrix, orientation lock, or app-store work. The app's guidance is localized; browser/OS UI is external. [Installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

### 3. Authentication cannot block the offline shell

Render language selection and connection/retry feedback independently of an SDK restoration that needs network refresh. Keep subscribe-before-read, revision ordering, synchronous auth callbacks, URL scrubbing, and single-exchange ownership. An SDK-restored usable session can display its existing identity, but expired/unavailable restoration has no new offline identity guarantee.

Known-offline sign-in/sign-out show connection guidance; explicit retry remains possible because connectivity signals are hints. Do not queue or automatically replay OAuth, exchanges, or logout. Controlled offline callbacks scrub inputs and offer return/fresh-online-login recovery; callback failure alone does not erase a valid SDK session. Do not copy auth identity into an application store merely to fill the offline screen.

### 4. Document-generation ownership and independent recovery

The technical contract is document ownership, not observable physical window closure. An eligible new canonical navigation or reload can adopt repaired files. Every existing or possibly delivered document retains its immutable browser-client binding, including frozen/BFCache clients. Subresources use only that binding; missing/conflicting bindings fail closed with no network/global-selection substitution. Callback clones for the existing router-recognized callback forms also require binding before bytes, never promote, and never receive recovery HTML. This callback-only recognition never expands static cache URLs/keys; unknown native Pages documents remain unbound and their application assets fail closed.

Use a new v3 ownership namespace and isolated resource caches outside v2 deletion authority. Serialize every writer with an origin-wide lock; unavailable coordination means unavailable service. Immutable hash-linked ledger lineage supplies authority; reject forks, missing/corrupt commits, unsupported schemas and inconsistent revisions. Hashes detect corruption/identity, not authentication. Every writer checks epoch, parent, head and reservation revision immediately before persistence.

Persist a navigation reservation before application delivery. A single immutable logical commit contains the selection and incoming binding. Await its write, read it back, validate lineage/binding and revalidate the complete generation/exact response before releasing bytes. Confirmation adds evidence, never changes ownership. Reserved operations can be abandoned only by a durable fence. Bound operations remain possibly delivered regardless of confirmation/handled; ambiguity protects all referenced generations indefinitely but does not veto a different new document.

States are Reserved, Bound for delivery, Recovery-bound, Confirmed, Delivery failed (positive pre-release evidence only), Ambiguous and Retired/abandoned. Never infer retirement from time, absence, missing replies, visibility, unload, pagehide or handled. Browser lookups/enumeration happen outside the selection lock; delayed observations carry epoch/head/binding checks. Status is read-only. No optional navigation hints, claim, forced activation or automatic reload.

Embed the recovery document, both locales and exact CSP hashes in worker implementation identity. Only exact query-free same-origin authorization-free GET navigation to `/` can receive it. It has no generation-cache entry or external dependency and never fetches HTML, initializes Auth, reads session storage or executes the SDK. Use no-store/no-referrer/nosniff/frame denial, default-src none, hashed script/style, connect-src none, base-uri/form-action/frame-ancestors none. Only the established locale key is read, with supported-value validation and storage-failure handling. Messages use strict bounded schemas, actual event.source/origin, request/worker/binding correlation; caller IDs, URLs and status claims confer no authority. Missing identity/durability gives guidance-only recovery.

Persist deliberate repair attempts before static network requests. One shared flight, separate staging, exact canonical inventory, independent MIME/integrity checks and a cancelling deadline apply. Page timeout does not release the worker lock. Duplicate/spent IDs do not restart work; reload/restart/reconnect/status never repair. Outcomes distinguish offline hint, running/busy, failed, timed out, cancelled, unknown/interrupted, spent and verified pending adoption. Missing durable outcome is unknown. Revalidate completed staging at the next eligible navigation; never switch the existing document. Guidance says reopen or reload; physical iPhone evidence remains 3.4.

Before cleanup persist a deletion seal for exact proven-unreferenced generations. Sealed resources cannot gain any selection, binding, repair/import source or reservation reference. Resume deletion idempotently after restart. All pins (including unconfirmed/ambiguous), selected/fallback, legacy, staging and in-flight references protect resources; inclusive browser observations only add conservative deferral. Never expire ownership for quota/cache-count targets.

Cut over actual 069dbc50 v2 data only through its explicit validator: descriptors, worker/configuration identities, lineage, completions and repair history. Preserve spent/unknown history and persist a validated cutover. Copy older generations into new-owned caches and independently verify them before usable completion; interrupted imports are unselected. Leave legacy caches untouched. Do not guess bindings for pre-pin clients; fail their unbound subresources closed and require new navigation. Reject legacy privileged messages and unsupported newer metadata. Older static bytes under the corrected worker are distinct from redeploying an obsolete worker implementation. An imported v2 UI cannot speak the corrected control protocol: keep its verified rollback selected/protected, but use embedded recovery for canonical entry and a safely bound selected clone for callbacks. Refresh legacy repair history at activation/startup and before repair, sharing the old/new single-flight lock so waiting-period attempts remain spent.

### 5. Tests and phone acceptance belong here

Add build checks for manifest/icon dimensions and required precache chunks, plus Chromium manifest/installability diagnostics. Wait explicitly for worker activation/control, disable ordinary HTTP-cache assistance, then test offline reload and new page in both locales. Audit every worker cache after synthetic auth/avatar traffic for private markers and sensitive URL keys. Do not use Lighthouse's deprecated PWA score or an install-prompt event as the gate.

Use the actual generation engine with Cache Storage/Web Lock adapters for interruption, three-generation retention, concurrency, untrusted metadata and bounded repair tests. Use real two-build Chromium workers for Pages canonicalization, waiting corruption, restart, complete replacement, repair pinning and v1 → v2 → v1 rollback. Update installation/worker-aware rollback docs without a new browser matrix or host secrets in PR CI.

The required manual target is **iPhone with Google Chrome**. The PM records the iPhone model, tested iOS and Chrome versions, production Pages URL, and deployed/update revisions. Open that production URL in Chrome, use its Share menu → Add to Home Screen, confirm the Spendspacey name and intended icon, then launch from the Home Screen. Confirm standalone web-app presentation; an icon that opens an ordinary browser tab/bookmark does not pass. [Chrome's iPhone installation guidance](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DiOS&hl=en)

Perform phase-specific online authentication/identity/sign-out, static readiness, airplane-mode reload/full close-reopen, both languages, safe-area/touch controls, reconnect, and waiting-update close-reopen checks from the installed Home Screen app. Prime that installed context itself; a Chrome tab visit may not transfer its storage. Record sanitized PM pass/fail evidence for actual standalone launch and these checks. Desktop Chromium automation supplements this manual evidence and cannot replace it. Safari-specific manual acceptance is not required, and the target does not authorize browser detection. No profiles are required in this increment; changes 3/4 inherit this same installed-app acceptance context.

## Risks / Trade-offs

- A Home Screen icon is only a browser shortcut -> explicitly verify standalone launch on the iPhone installed through Chrome; keep desktop Chromium offline checks as supplemental evidence.
- Auth opens outside the installed context and loses PKCE state -> start the online smoke from the Home Screen app and verify successful return there on the actual device; do not accept a separate signed-in Chrome tab as installed-app success.
- Worker caches accidentally capture auth/avatars -> allowlist and negative cache inspection rather than broad runtime recipes.
- Mixed build chunks or forced updates interrupt PKCE -> complete precache, waiting activation, correct hosted headers, and no forced reload.
- Browser eviction or unsupported workers remove readiness -> honest online-only fallback and documented reconnect/recovery.

## Migration Plan

Verify predecessor acceptance/spec synchronization, implement/test/review the PWA slice, merge accepted changes into `main`, and let the existing Pages GitHub integration deploy at the same assigned production URL. Verify actual Pages worker headers/native fallback and complete phone installation/update acceptance. Optional previews retain disabled Google sign-in/callback exchange; production signups remain disabled. This plan itself changes no app code or host.

Rollback must serve a compatible recovery worker at the same URL and restore a complete build; reverting files alone does not unregister installed workers. Do not delete SDK/locale storage during static repair. Only after this milestone passes should [online-profiles](../online-profiles/proposal.md) begin.

## Execution prerequisites and evidence

The iPhone/Google Chrome manual target and installation flow are decided. Record actual iOS/Chrome versions, iPhone model, production URL, deployed/update revisions, and sanitized PM outcomes during execution. Cloudflare/GitHub access and the assigned hostname are inherited execution prerequisites. No unresolved product decision remains; Safari-specific manual acceptance is not required.
