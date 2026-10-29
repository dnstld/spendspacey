> **Superseded planning record — 2026-10-17.** Do not apply this combined change or synchronize its historical deltas. It has not been implemented or accepted. Use the four sequential replacement changes below; each owns its own implementation, tests, publication, and acceptance.
>
> 1. [deploy-auth-shell](../archive/2026-10-19-deploy-auth-shell/proposal.md): publish the existing auth shell and verify online phone sign-in/sign-out.
> 2. [installable-offline-shell](../archive/2026-10-29-installable-offline-shell/proposal.md): install and launch the static shell offline before profile work.
> 3. [online-profiles](../online-profiles/proposal.md): one explicitly owner-filtered read of the **current user's own profile**, kept only in memory.
> 4. [offline-profiles](../offline-profiles/proposal.md): persist **only that current-user profile** with account isolation, reconnection, and cleanup.
>
> **Later scope correction:** The PM specified the current user's profile, not a list/directory of other profiles. The replacement capability is `user-profile`; references below to `profile-directory`, co-member rendering, or a broader cached list are historical and are not authorized by the replacement plans.
>
> **Preserved history:** The original proposal, design, specifications, unchecked implementation tasks, and CLI metadata remain intact below/in this directory. Superseded is a documentation notice, not a fabricated CLI completion/archive state. Main specs and the Phase 1 archive are unchanged.

>
> **PM decisions — 2026-10-18:** The replacements target **Cloudflare Pages Free**, GitHub integration with accepted `main` merges only, repository-root React/Vite static `dist` delivery, exact Node `24.21.0`/pnpm `10.27.0` pins, only the two public Supabase application inputs, and the assigned production `*.pages.dev` origin. Preserve native SPA fallback, exact local/production Auth redirects, disabled new-user signups, and restricted preview authentication. No Cloudflare runtime/storage products or custom domain are included. Historical Vercel and unconditional missing-asset-404 directions below are superseded; use `deploy-auth-shell` for current settings/tasks.
>
> **Current-user data boundary:** Changes 3/4 read only the current user's `/profiles` resource in the existing view, without editing or a synchronization queue. Change 4 saves only a successful verified online current-user result, displays it after offline hard reload, shows localized unavailable feedback without a cached profile, and clears it on sign-out/identity change. Never runtime-cache Supabase, OAuth, callback, token, or profile network responses in the service worker. These decisions refine the four-change sequence above; original historical bodies below remain unchanged.

>
> **Resolved PM scope and device acceptance — 2026-10-18:** `/profiles` means the Supabase `public.profiles` table/Data API resource (`/rest/v1/profiles`), displayed on the existing authenticated `/` screen; do not add a `/profiles` route. Retain current-user-only, read-only/RLS, offline snapshot isolation, identity-change, and sign-out cleanup requirements. The manual PWA target for change 2 and dependent acceptance is **iPhone with Google Chrome**: record tested iOS/Chrome versions; open the production Pages URL in Chrome; Share → Add to Home Screen; confirm Spendspacey name/intended icon; launch standalone from the Home Screen; perform each phase's online/offline checks in that installed app. Desktop Chromium does not replace manual PM evidence; Safari-specific manual acceptance is not required. Use standards/feature detection without browser detection.
>
> **Offline-profile manual gate:** After a successful authenticated online profile load and snapshot commit in the installed Home Screen app, close it completely, remove connectivity, reopen from the Home Screen and hard reload, and verify only that user's cached profile. Cloudflare/GitHub access and the assigned `pages.dev` hostname are execution prerequisites, not unresolved product decisions. The four-change sequence and original historical bodies remain unchanged; replacement plans are authoritative.

# Proposal

## Why

The PM needs to install Spendspacey on a phone and reopen it without connectivity before adding expense features. The existing Google authentication shell provides no deployable PWA experience or durable offline data; a read-only profiles view is enough to prove both installation and offline refresh.

## What Changes

- Deliver one HTTPS-hosted Vite application at a stable origin, with an exact registered OAuth callback, using Vercel as the proposed static-hosting default. Complete an actual PM phone installation and offline relaunch check; a successful CI build alone does not finish this milestone.
- Add a manifest, application icons, mobile metadata, standalone display, and a service worker that precaches only reviewed static application assets, including every required chunk and both bundled languages.
- Add one read-only `public.profiles` query through the existing Supabase client. Render only the profiles permitted by existing row-level security, selecting `id`, `display_name`, `avatar_url`, and `updated_at`. Do not build wallets, transactions, profile editing, or additional application queries.
- Persist a validated, account-scoped snapshot of that successful query in IndexedDB so profiles remain visible after an offline page refresh or relaunch. Show explicit saved/offline and last-refresh feedback. This is an application data snapshot, separate from service-worker Cache Storage; authentication payloads and API responses never enter the service-worker cache.
- Distinguish an authenticated online session from viewing previously authorized local data while offline, including when token refresh is unavailable. Require connectivity for fresh Google sign-in and current-session sign-out, preserve language selection, prevent cross-account snapshot exposure, and invalidate snapshots when sign-out or server rejection ends access.
- Add safe worker updates, cache versioning/recovery, proportionate automated coverage, deployment configuration/runbook work, and sanitized real-phone acceptance evidence. Preserve English and Brazilian Portuguese throughout.

This scope replaces the discussed offline transaction milestone. It excludes transaction entry, mutations, upload queues, synchronization, background execution, database/schema/RLS changes, new Auth projects, push notifications, extra login methods, custom domains, and app-store distribution. Hosting and exact hosted callback configuration are now included by the PM's revised goal. This proposal creates planning documents only; it neither deploys nor changes external services.

## Capabilities

### New Capabilities

- `installable-app`: Installable static shell, offline launch, safe asset caching, worker lifecycle, and recovery.
- `profile-directory`: One authorized profiles read, minimal rendering, durable account-scoped snapshots, and offline/reconnection behavior.
- `web-delivery`: Stable HTTPS delivery, hosting/cache/routing requirements, registered hosted authentication, and actual mobile acceptance.

### Modified Capabilities

- `user-auth`: Extend the identity-only screen with read-only profiles and PWA feedback; distinguish offline local viewing from current authentication; register hosted callbacks alongside local development; coordinate sign-out and account changes with private local snapshots.

The existing `localization` requirements already cover bundled resources, preference semantics, all application-owned feedback, and resource validation. They remain applicable without a delta.

## Impact

- Application integration points: `src/main.tsx`, `src/App.tsx`, `src/auth/`, `src/components/Shell.tsx`, and `src/i18n/`; introduce a small profiles read/snapshot boundary and PWA registration/update UI.
- Build/delivery: Vite configuration, icons/manifest, a custom Workbox worker, host configuration, and deployment documentation. Proposed dependencies are `vite-plugin-pwa`/required Workbox modules and Dexie for one versioned IndexedDB snapshot store; no general query framework or sync service is required.
- Existing Supabase `public.profiles` and SELECT policies are reused unchanged. Schema/policy metadata was inspected read-only; no profile values, account identifiers, keys, or session data belong in these artifacts. Other existing database tables remain outside scope.
- Extend Vitest/Chromium checks and the existing Linux CI workflow with installability, offline refresh, cache isolation, update, and hosted-configuration checks using synthetic data. Live OAuth, hosted headers, and phone installation require PM-owned acceptance after implementation.
