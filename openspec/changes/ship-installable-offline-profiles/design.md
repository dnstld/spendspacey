> **Superseded planning record — 2026-10-17.** Do not implement or synchronize this historical artifact. Follow the four replacements and current-user-only correction in [the supersession map](proposal.md). Original content and task completion state are preserved unchanged below.

>
> **PM decisions — 2026-10-18:** Follow the supersession map above for Cloudflare Pages Free, accepted `main` production delivery, exact Auth configuration with signups disabled, restricted previews, and read-only current-user `/profiles` with separate offline snapshot storage. Historical Vercel, missing-asset-404, and profile-directory directions below are superseded; no Supabase/OAuth/callback/token/profile network response may be runtime-cached by the service worker. The original body remains unchanged.

>
> **Resolved PM scope and device acceptance — 2026-10-18:** Follow the supersession map above: `/profiles` is Supabase `public.profiles`/Data API, displayed on existing `/`, with no `/profiles` application route. Manual PWA acceptance is iPhone/Google Chrome Share → Add to Home Screen, Spendspacey name/icon, standalone Home Screen launch, phase-specific installed-app online/offline checks, and recorded iOS/Chrome versions. Offline profiles require successful authenticated online load/commit, complete close, connectivity removal, and reopen/reload showing only that user's cached profile. Desktop Chromium cannot replace PM evidence. Safari-specific manual acceptance is not required; use standards/feature detection without browser detection. Cloudflare/GitHub access and assigned hostname are execution prerequisites. Original body preserved below.

# Design

## Context

See [proposal.md](proposal.md) for the goal and narrowed scope. The starting point is merge `3d40fd9` on clean `main`, with an archived Phase 1 and two durable capabilities: authentication and localization. The UI is a Vite 8/React 19 SPA with `/` and `/auth/callback`, a singleton Supabase client, ordered SDK event/session restoration, explicit PKCE exchange, and bundled `en`/`pt-BR`. There is no worker, manifest, profiles read, local application database, or hosting configuration.

Read-only metadata inspection confirmed that the configured Supabase project already has `public.profiles` with `id`, `display_name`, `avatar_url`, `created_at`, and `updated_at`. RLS is enabled; its SELECT policy admits the viewer's profile and profiles of shared-wallet members. This is not permission to query wallets or alter policies. Other populated application tables exist remotely despite the minimal local shell; they remain untouched. No actual profile values or Auth inventory were needed for planning. Historical Phase 1 acceptance is not a fresh inventory audit.

Design is necessary because private persistent data, authentication, worker lifecycle, and the first hosted origin cross module boundaries. Behavioral contracts are in [installable-app](specs/installable-app/spec.md), [profile-directory](specs/profile-directory/spec.md), [web-delivery](specs/web-delivery/spec.md), and [user-auth](specs/user-auth/spec.md).

## Goals / Non-Goals

**Goals:** Ship the smallest useful phone-installation milestone with one durable read-only query; keep static caching and private data storage independent; make offline read access explicit without implementing offline authentication; preserve Phase 1 callback/race/localization safeguards.

**Non-Goals:** No generic repository/query framework, local transaction domain, mutation API, queue, two-way synchronization, realtime subscription, Dexie Cloud, background job, schema migration, or new authentication infrastructure. Backend requests are limited to existing Auth operations and the profiles SELECT. IndexedDB writes are local persistence, not Supabase mutations. The proposal's other exclusions apply.

## Decisions

### 1. One profiles read with a small React boundary

Add a typed profiles module that calls the existing Supabase client for `profiles`, explicitly projecting `id,display_name,avatar_url,updated_at` and ordering by `id`. Use the signed-in user's normal session; RLS determines the result. Do not use `select('*')`, admin credentials, a self-only filter that hides permitted co-members, joins, or separate member/profile lookups. Render the returned directory; do not promise visibility of all database profiles. General pagination and search are deferred.

Validate the response at the network boundary and again on stored-snapshot reads: UUID ids, string-or-null names and avatar URLs, a valid update timestamp, and a well-formed row array with unique ids. Persist only the projected validated shape. Names render as text; URL validation follows the existing HTTPS/no-credentials avatar rule. Names and status text use localized fallbacks; external identity text remains untranslated.

Keep React state and a focused hook/provider for this one read rather than adding TanStack Query and multiple persistence plugins. Coordinate launch, foreground, reconnect, and manual retry triggers with a shared in-flight request per current account generation, so Strict Mode and duplicate events do not fan out reads. Defer retries with bounded backoff while a visible app remains online; provide a manual retry. Avoid continuous polling and stop retries when offline, signed out, or access-rejected. Any late result must still pass the generation check before rendering or saving.

The signed-in root keeps the existing identity/sign-out controls and adds only a Profiles section, saved/stale/last-refresh feedback, and essential PWA notices. An expired offline session shows the saved directory rather than recreating Google identity/email from a new store. No profile detail route or editable form is needed. Reuse the shared shell, but allow the directory to scroll without clipping at phone widths.

### 2. Versioned IndexedDB snapshot, not cached HTTP responses

Use Dexie 4.x for a small versioned IndexedDB database. Current maintained release evidence is 4.4.6; verify and pin the exact compatible release at implementation. Dexie's typed storage and transactions simplify atomic replacement/invalidation compared with handwritten IndexedDB event orchestration. No React hooks package or cloud addon is required. `localStorage` alone is not the data store: synchronous serialization and non-transactional replacement would make privacy/race handling harder.

Use one database with a snapshot store and a small access-state store. A snapshot contains:

| Field | Meaning |
| --- | --- |
| Backend scope | Validated Supabase origin; never the publishable key or a secret |
| Viewer id | The account whose authorized SELECT produced the snapshot |
| Format version | Explicit snapshot contract version |
| Fetch time | Local time of the last successful complete read |
| Rows | Only validated `id`, `display_name`, `avatar_url`, `updated_at` |
| Access generation | Matches the current locally permitted viewing generation |

Access state contains the backend/viewer binding, generation, and whether offline viewing is allowed. Keep only the currently active viewer's snapshot instead of a multi-account archive. Establish this binding only after online SDK identity verification and a successful profiles read. A profile-row id is not necessarily the viewer's id. Do not infer the viewer from the first row or accept a URL-selected account id.

Replace rows and metadata atomically. A successful empty response is a valid empty snapshot and removes earlier rows. Treat storage failure separately from network success: display online data, but explain that offline data is not ready. Unsupported or malformed snapshots fail closed and require an online reload. Handle blocked IndexedDB upgrades, quota errors, and deletion failures with localized recovery. Do not automatically wipe the whole browser origin.

Profile names and account ids are private application data, deliberately persisted for this requested feature. The original static-only privacy rule is retained for the worker; it does not prohibit this separate minimal snapshot. Never serialize the SDK session, Auth user object, email, bearer tokens, provider credentials, callback parameters, or avatar response bytes. Remote images are optional online and use initials/fallbacks offline.

References: [Dexie transactions](https://dexie.org/docs/Dexie/Dexie.transaction()), [schema versions](https://dexie.org/docs/Dexie/Dexie.version()), and [maintained releases](https://github.com/dexie/Dexie.js/releases).

### 3. Offline local viewing is separate from session state

Extend the existing state boundary without replacing SDK persistence or refresh scheduling. The relevant states are:

```text
Online verified account --> profiles SELECT --> durable snapshot
          |                                      |
          | connection unavailable               | reload offline
          v                                      v
    SDK unresolved/expired <------------ saved local view
          |
          | reconnect + SDK verification
          v
    refresh authorized profiles --> replace snapshot
          |
          | auth/access rejected
          v
    invalidate saved viewing --> sign-in/recovery
```

Render the outer localized shell independently of slow SDK initialization. When network-based restoration cannot finish, transition the visible UI to saved local mode if an eligible access binding/snapshot exists. Do not abandon an outstanding SDK promise and launch overlapping refreshes; retain generation ordering and let later SDK results reconcile safely. A known offline browser hint or a retryable network failure can reveal the saved mode; neither is fresh proof of identity.

On reconnect/foreground, schedule one identity check with SDK `getUser()` outside the auth-event callback, allowing the SDK to restore/refresh first. Use a bounded, recoverable UI state rather than an indefinite spinner. Only a verified viewer matching the current generation can request profiles and replace the snapshot. Network failure retains eligible saved data. Invalid authentication or a genuine access denial invalidates it. A successful smaller/empty SELECT replaces it immediately, so revoked visibility is not retained after refresh. No offline backend mutations or queued operations exist.

`navigator.onLine` and events are hints; leave explicit connection/retry recovery possible. Local viewing can show stale permissions while disconnected and is not a secure device unlock. Same-origin scripts and someone with access to the browser's stored data can read the snapshot. Do not claim encryption, remote revocation while offline, or fresh account verification. This is proportionate for the requested saved-profile proof, not a general offline authorization system.

References: [Supabase getSession](https://supabase.com/docs/reference/javascript/auth-getsession), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), and [browser connectivity limitations](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine).

### 4. Invalidation precedes sign-out and account switching

Keep subscribe-before-read ordering, synchronous auth callbacks, cleanup, and the existing revision guard. Add the equivalent guard to profiles reads and durable writes. On account change, confirmed sign-out, access rejection, or an online sign-out initiation: hide profiles immediately, advance the access generation, invalidate the durable binding, and purge the snapshot. An IndexedDB transaction must check the captured generation before committing a snapshot; a late response cannot re-enable a revoked binding.

Before SDK sign-out or a new OAuth attempt, persist a small token-free invalidation fence, then transactionally invalidate/delete the prior snapshot. Use the existing guarded browser storage as a fence fallback when IndexedDB cleanup fails; validate that fence before any snapshot hydration and synchronize it across windows. Never use it as authentication. This closes the race between async cleanup, reload, and in-flight writes. A new verified read for the chosen account is the only path to a new allowed generation. Other tabs follow SDK sign-out plus local invalidation notifications; do not preserve an old account cache for later automatic display.

If durable invalidation cannot be established in either store, do not initiate SDK sign-out or new OAuth; show a storage/retry failure and keep profiles hidden in the current page. Do not promise cleanup in a storage environment that rejected the cleanup. If invalidation succeeds but network logout fails, keep the snapshot disabled, follow actual SDK state, and explain whether the local session cleared while server revocation is unconfirmed. The next profile load must be deliberate recovery after fresh verification, not an automatic resurrection following failed logout.

Sign-out is online-only for this milestone. It is disabled with connection guidance while known offline; do not implement an offline credential-clearing API or queue. Preserve `signOut({ scope: 'local' })`. The installed SDK may clear its local session even when its logout request fails, while an earlier expired-token refresh failure can stop sign-out before clearing; tests must cover both actual-state outcomes, not assume every error retains a session.

Preserve PKCE code ownership, URL scrubbing, and no automatic code replay. A failed callback alone does not revoke eligible prior local access. The worker can return generic static HTML for the callback; application code prevents a known-offline exchange, scrubs its input, and offers return/fresh-online-login recovery. No OAuth code enters IndexedDB, Cache Storage, or a retry queue.

### 5. Custom Workbox worker with a build-generated static allowlist

Use `vite-plugin-pwa` `injectManifest` with a TypeScript worker. Release 2.0.0 explicitly supports Vite 8 and Node >=20.19; this fits Node 24. Pin exact compatible plugin and directly imported Workbox modules when implementing. A generated worker would suffice for a simpler app, but an authored handler makes the sensitive-request boundary and generic callback document behavior directly reviewable. Entirely handwritten asset discovery/versioning adds unnecessary lifecycle risk.

Generate precache entries from reviewed build output: generic `index.html`, all hashed JS/CSS chunks including the dynamically imported Supabase module, the local font and Google button image, manifest, and named application icons. Do not use an unrestricted public-file glob. Exclude maps, test fixtures, environment files, API paths, private profile snapshots, and the worker script itself. Use content hashes/revisions, an application-specific cache prefix, and an explicit cache-policy version. Static precache requests must not attach application authorization headers.

Worker routing is deny-by-default:

| Request | Handling |
| --- | --- |
| Exact approved static GET asset | Revisioned precache; safe network fallback on a missing entry |
| Same-origin root navigation, without arbitrary query variants | Return the generic cached entry document |
| Exact `/auth/callback` navigation | Return an uncached clone of the generic entry document with `no-store`/`no-referrer` response headers; never cache the request URL or fetch/store a callback response |
| Supabase/Auth/API/OAuth, cross-origin image, non-GET, authorization header | Network only, without any runtime cache write |
| Unrecognized asset, query variant, or navigation | Normal network behavior; no broad runtime-cache or navigation rule |

Apply sensitive-request guards before convenience precache routing; disable broad ignored-query matching and automatic clean-URL expansion where they could widen the allowlist. URL fragments are not sent to the worker; the application must scrub them. Cache tests inspect all Cache Storage names/keys/bodies after synthetic auth/profile traffic. No `CacheFirst` or `StaleWhileRevalidate` rule for API responses and no catch-all image cache.

Register only for production builds; keep normal Vite development free of workers. Use an isolated worker TypeScript context rather than conflicting DOM/worker globals in the existing application tsconfig. Report static readiness only after complete installation and a controllable launch path; separately report whether a profiles snapshot was durably saved.

References: [plugin strategies](https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors), [custom workers](https://vite-pwa-org.netlify.app/guide/inject-manifest), [version compatibility](https://github.com/vite-pwa/vite-plugin-pwa/blob/v2.0.0/package.json), and [Workbox precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching).

### 6. Minimal manifest and normal worker activation

Use stable manifest `id`, root start/scope, Spendspacey brand name, standalone display, and existing theme colors. Provide separate ordinary and maskable PNGs plus Apple touch icon. Reuse the existing brand treatment rather than introduce a new visual identity. Name/identity remain language-neutral; all application installation guidance is localized. Browser-owned install UI and OS labels are not controlled by i18next. No screenshots, custom install prompt framework, orientation lock, splash-image matrix, or app-store packaging is needed.

Use waiting updates with a localized notice to close all app windows and reopen. Do not call unconditional `skipWaiting` or force controller-change reloads. Check registration on launch and online foreground/reconnect, coalescing triggers. Natural activation after old clients close avoids a separate cross-window activation protocol and interruption of pending auth work. A new worker reports ready only after its entire precache installs. Remove obsolete owned assets on activation and include Workbox outdated-format cleanup, without touching IndexedDB, Auth storage, locale, or unrelated caches.

Handle missing dynamic chunks through bootstrap/error handling and Vite's preload-error signal where code can run. Provide explicit bounded online repair of owned static caches/registration with a single retry marker; never auto-loop reload or repair during callback exchange. If entry code cannot run, the runbook explains reconnecting and the browser's site/worker recovery tools, including that clearing all site data also removes profiles and sessions. Partial eviction offline cannot be repaired until connectivity returns.

References: [installability and mobile differences](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [worker lifecycle](https://web.dev/articles/service-worker-lifecycle), and [Vite missing-chunk recovery](https://vite.dev/guide/build.html).

### 7. Vercel static delivery at one stable HTTPS origin

Use Vercel as the proposed host for this existing repository, keeping the Vite SPA and Supabase architecture. Deploy built `dist/`; no SSR/serverless rewrite, new database, or Sites remix is necessary. Pin Node 24/pnpm and frozen install. Use only the two existing validated public build inputs, supplied privately through the host; deployment credentials remain in the provider/CI secret mechanisms. Account/project linkage and exact assigned URL are operational inputs collected at implementation, not secrets or invented identifiers in this plan.

Serve actual files first; apply SPA fallback to application navigation including `/auth/callback`, without returning HTML for missing assets or `sw.js`. Set revalidation for HTML, manifest, worker, and unversioned public assets; long-lived immutable caching only for content-hashed assets. Set callback `no-store` and retain no-referrer. Require the right script/manifest content types and root worker scope. A stable deployment URL avoids fragmenting installation, SDK storage, and private snapshots across preview origins. No custom domain is required. Hosting login protection must not intercept the PM's installation/worker/callback requests.

Add a restrictive, build-appropriate CSP: self-hosted scripts and worker; the configured Supabase origin for connections; safe HTTPS avatar sources; no objects, framing, arbitrary inline scripts, or analytics. Accommodate only actual framework style needs and preserve `nosniff` and no-referrer. Verify headers against the real host rather than assuming local preview reproduces them. Sanitized CI uses synthetic configuration and never captures live profiles or real OAuth traces. Keep provider deployment/account tokens out of `VITE_` inputs.

Register exactly `https://<stable-host>/auth/callback` in Supabase alongside the existing localhost callback and set hosted Site URL appropriately. Retain Google's separate Supabase `/auth/v1/callback` redirect; add the exact hosted application origin where required by the existing provider configuration. Keep Google testing/basic scopes and existing signup/access restrictions unchanged. Do not create another Auth project, use preview wildcards, change records/RLS, or reopen enrollment to solve an existing-user login error. Refer any unexpected inventory/access-control discrepancy to the PM before operational changes. Do not log callback URLs or request bodies.

Reference: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [cache headers](https://vercel.com/docs/caching/cache-control-headers), and [Supabase registered redirects](https://supabase.com/docs/guides/auth/redirect-urls).

### 8. Verification proves the phone goal, not just a manifest

Reuse Vitest/Testing Library and Chromium. Add focused local snapshot tests (a pinned IndexedDB test implementation is acceptable), account-generation and invalidation races, storage errors, complete replacement/removal, callback recovery, and both locales. Component tests cover exhaustive state edges; do not replicate SDK internals.

Browser tests use the built application and real worker/IndexedDB with synthetic Auth/profiles data. Review the existing `context.route` fixture for worker-owned requests, fail unexpected backend reads/writes, and explicitly abort Auth/profiles fixtures while offline so route fulfillment cannot fake connectivity. Wait for worker activation/control and snapshot commit, clear/disable browser HTTP cache without deleting Cache Storage, then test offline reload and a new page. Include an expired-session cold launch, no-snapshot case, account/sign-out isolation, both locales, and inspection of every worker cache for synthetic private markers.

Validate manifest contents, actual icon dimensions and responses, required precache inventory, and Chromium installability diagnostics (CDP manifest/installability APIs for the pinned browser). Do not depend on browser engagement heuristics or an install-prompt event as the only CI gate. Add one controlled two-version worker test, failed replacement, and missing-chunk recovery without creating production build bypass flags. Extend the existing single Linux job rather than add a broad browser matrix or deployment secrets to ordinary PR checks. A Lighthouse PWA score is not a gate; those audits are deprecated.

After automated checks, publish the candidate at the stable URL and verify actual routing, headers, public configuration, Auth callback, and read-only profile permissions. The PM's real phone must install, launch standalone, sign in online, reach shell-and-profiles readiness, refresh and force-close/reopen in airplane mode, use both languages, reconnect, sign out, and confirm no old profiles on offline reload. Check the waiting update/close-reopen transition on that phone. Record device/browser and sanitized outcomes; neither desktop mobile emulation nor a browser visit alone proves that the installed storage context is prepared. Installation/storage transfer can differ between Safari/browser and installed web apps.

References: [Playwright service-worker routing](https://playwright.dev/docs/service-workers), [Chrome installability diagnostics](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-getInstallabilityErrors), [Lighthouse deprecation](https://developer.chrome.com/docs/lighthouse/pwa/service-worker), and [WebKit installed-app login transfer](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/).

## Risks / Trade-offs

- Saved profiles can be stale or remain locally readable after remote permission changes while offline -> label saved mode, scope to the prior verified viewer, replace the full result on reconnect, and invalidate on known rejection/sign-out. No offline authorization claim.
- A shared phone or script injection can expose stored names -> minimal projections, no auth payload copies, text rendering, CSP, and local invalidation. Browser storage is not encrypted application storage.
- IndexedDB/Cache Storage eviction and private browsing can remove readiness -> distinguish shell/data readiness and storage failures; reconnect to rebuild. Do not promise indefinite retention.
- Async SDK and profiles results can revive old-account data -> generation checks at render and transactional commit, a durable invalidation fence, and cross-window race tests.
- A failed logout does not imply unchanged local SDK state -> preserve current-session scope and render actual events with honest revocation feedback.
- Worker updates and cached HTML can reference different chunks -> complete precaches, normal waiting activation, no force reload, correct host headers, and a two-version/missing-asset test.
- Existing remote data/access policies may differ from historical Phase 1 evidence -> reuse only the verified table contract and existing authorization, never mutate the remote schema or silently change enrollment.
- Phone OAuth can return to another storage context and lose PKCE -> exact stable origin, same-device flow, localized fresh-login recovery, and real installed-app acceptance.
- Vercel account access or provider setup can delay publication -> keep code/CI readiness separate from incomplete delivery tasks. The milestone cannot be marked complete until hosted and phone gates pass.

## Migration Plan

1. Implement and verify the static PWA slice, then the one-query snapshot slice with synthetic data. Preserve Phase 1 specs/history; update stale runbook acceptance wording without changing its recorded historical evidence.
2. Finish all automated checks and review the production artifact/cache inventory and proposed host configuration. This proposal itself performs none of those implementation or external mutations.
3. During apply, link the PM-owned Vercel account/project, obtain the stable HTTPS URL, configure public build inputs privately, and deploy the reviewed candidate. Register the exact hosted callback without changing existing access restrictions; verify headers and online read-only behavior.
4. Complete PM mobile/update acceptance and record sanitized evidence before checking off delivery tasks or archiving.

There is no backend data migration or mutation to reverse. Revert application changes normally before first publication. After publication, restore the prior complete deployment and ensure the stable worker script/headers deliver a compatible rollback worker; simply reverting Git or host files does not unregister installed workers. Keep profile format version 1 compatible through this change, never erase local data as an unexplained rollback side effect, and verify the phone's close/reopen/update recovery path. A severe boot failure uses the documented online worker recovery route.

## Open Questions

- Operational inputs for apply: PM-owned Vercel account/project access, the assigned stable HTTPS URL, and the actual phone OS/browser used for acceptance. These do not change the one-query/static-host architecture or acceptance steps. Vercel is a proposed default, not an already connected or configured service.
- Live SELECT behavior will be verified with the enrolled PM session after implementation; metadata inspection established the existing schema/policy shape but did not impersonate that user. Missing privileges or unexpected inventory are a PM prerequisite to resolve, not authorization to add migrations or broaden policies in this change.
