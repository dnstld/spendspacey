# Design

## Context

See [proposal.md](proposal.md), [user-profile delta](specs/user-profile/spec.md), and [auth delta](specs/user-auth/spec.md). This is change 4/4 and depends on accepted/deployed `online-profiles` with synchronized durable specs and manual evidence from the iPhone Home Screen app installed through Google Chrome. `user-profile` is a future capability introduced by that predecessor; its online-only availability/rendering requirements are the explicit MODIFIED baseline here. Today's main still only has Phase 1 auth/localization.

The existing one-query contract stays owner-filtered and read-only. This change persists only the signed-in current user's row after a successful verified online fetch from the existing Supabase `/profiles` resource (`/rest/v1/profiles`), not the directory described in the historical combined plan. The PM confirmed the resource is `public.profiles`/Data API, not an application route. Keep the online card on the existing authenticated `/` screen and saved-local viewing on the same `/`; add no `/profiles` route, profile editor, or synchronization queue.

## Goals / Non-Goals

**Goals:** Keep that one profile available after offline refresh/relaunch and make its local privacy lifecycle explicit.

**Non-Goals:** New backend queries/mutations, offline authentication, token storage replacement, peer profiles, transaction data, upload queues, realtime/background sync, schema/RLS changes, or a general cache framework.

## Decisions

### 1. Minimal Dexie snapshot

Use a pinned compatible Dexie 4.x release for versioned IndexedDB transactions; recheck the exact maintained release during apply. A small typed store simplifies atomic replacement and invalidation compared with handwritten event orchestration; localStorage is not the profile payload store. Add no Dexie Cloud, React hooks addon, or sync service.

Without an eligible cached row, a prepared shell's first offline visit/hard reload shows localized profile-unavailable/reconnect feedback in English or Brazilian Portuguese. A never-prepared shell can still show the browser's network error; static readiness and cached-profile availability are different conditions.

Use snapshot and access-state records keyed by validated backend origin, verified account id, and format version. Keep only the active user's snapshot, not a multi-account archive. Store the row's selected fields or an explicit missing-row result, fetch time, and access generation. Require row.id to equal the binding owner. Establish allowed offline viewing only after online Auth verification plus a successful own-profile read/commit. Never derive the owner from row order or an unverified URL/metadata value.

Never persist SDK session/user objects, Auth email, provider tokens, credentials, callback parameters, other-user rows, image bytes, or raw API envelopes. The single avatar URL may be a validated selected field, but offline rendering always uses a fallback. A successful null result atomically replaces a previous row. Separate static-shell readiness from snapshot commit readiness; online rendering can still succeed when storage fails.

References: [Dexie transactions](https://dexie.org/docs/Dexie/Dexie.transaction()), [schema versions](https://dexie.org/docs/Dexie/Dexie.version()).

### 2. Local viewing is not authentication

Render the prepared shell/language selector independently of SDK refresh. If offline restoration is pending or fails transiently, an allowed matching snapshot can show its saved profile with offline/unverified and last-refresh feedback, including after token expiry. Do not reconstruct SDK email or treat the local binding as a server credential.

Keep SDK persistence/refresh ownership, synchronous event callbacks, subscribe-before-read, and revision ordering. Do not abandon pending SDK work and create overlapping refreshes. On online reconnect/foreground or manual retry, coalesce triggers, verify the current user through SDK Auth, and rerun the same owner-filtered SELECT. A network failure retains eligible saved data; true auth/access rejection disables it; successful updated/null data replaces it.

Browser connectivity indicators are hints, and retry remains explicit/recoverable. Cached private data can be stale while disconnected, including after remote revocation unknown to the device. Local viewing is not a device lock or encrypted vault.

### 3. Durable invalidation before account transitions

On account change, confirmed sign-out/rejection, or online sign-out initiation: hide the profile immediately, advance a generation, persist invalidation, and purge the snapshot. Each async read/save checks its captured account generation both before rendering and inside the write transaction. Use token-free access-state metadata and a guarded localStorage invalidation fence fallback so failed async deletion plus reload cannot resurrect an older snapshot. Synchronize invalidation across app windows without adding a server query.

Before new OAuth or SDK sign-out, establish that durable boundary. If neither deletion nor invalidation can be persisted, abort the SDK attempt, hide the row in the current page, and show storage/retry feedback without promising completed cleanup. New offline access requires a fresh verified read and a new allowed generation. Following a failed logout, background reconnect must not silently re-enable the old snapshot; require deliberate verified recovery.

Keep online-only current-session sign-out inherited from the shell, language preservation, and actual SDK-state handling: a network logout failure may still clear SDK-local state, while earlier refresh failure may leave it. Do not report cleanup as server revocation or queue logout. Direct callback failure alone does not invalidate an otherwise eligible snapshot; a newly initiated account-switching flow already invalidates the prior binding. PKCE ownership/scrubbing/no replay remain unchanged.

### 4. Storage/recovery and worker separation

Validate records on every hydration; mismatched owner/backend/version, malformed/evicted data, full storage, and blocked upgrades yield localized safe recovery rather than a fabricated profile or indefinite spinner. Do not delete auth/locale storage when repairing a snapshot. Static worker repair/update must not wipe profile storage. Use explicit snapshot-format and cache-policy versions with compatible replacement builds.

The worker remains static-only: never runtime-cache Supabase, OAuth, callback, token, or profile network responses. No API response or private row enters Cache Storage; only the validated projected snapshot enters the separate application store. The host remains Cloudflare Pages Free at the existing assigned production `*.pages.dev` origin, with native SPA fallback, exact toolchain/public-input limits, disabled new-user signups, exact callbacks, and disabled preview authentication. Rollback must keep a compatible worker/build and either understand version-1 snapshots or leave them untouched/unshown with recovery guidance. No backend migration is involved.

### 5. Tests and actual phone proof

Use focused IndexedDB tests with a pinned test implementation if needed: atomic row/null replacement, owner equality, schema/backend mismatches, quota/blocked/corrupt data, invalidation failure, and old-generation writes. Component tests cover expired-session saved mode, no snapshot, SDK verification/reconnect, actual logout outcomes, and both locales.

Production-build Chromium uses real worker/IndexedDB with synthetic owner-only data. Explicitly wait for worker control and snapshot commit; disable ordinary HTTP-cache assistance and abort offline Auth/profile fixtures instead of fulfilling them. Test cold offline refresh/new page with expired session, avatar fallback, no snapshot, account switch, cross-tab sign-out, rejected access, null replacement, and offline reload after logout. Inspect stored snapshots and all worker caches for forbidden identity/token markers. Update the existing CI and data-retention docs in this change.

Use the predecessor's manual target: **iPhone with Google Chrome**. Reference installation by opening the production Pages URL in Chrome, Share → Add to Home Screen, confirming the Spendspacey name/intended icon, and launching standalone from the Home Screen. Reconfirm that this is the installed web app rather than a browser bookmark/tab and record the actual iOS and Chrome versions for this revision.

In that installed Home Screen app, authenticate online, load the current user's existing `/` profile successfully, and wait for snapshot commit. Close the installed app completely, remove connectivity, reopen it from the Home Screen, and perform a hard reload; only that user's cached profile must appear with saved/offline feedback. A missing-profile fixture does not satisfy this successful-profile manual case. Also check both languages, a prepared context without cached data, reconnect refresh, and sign-out followed by offline reload without the previous private row, all from the installed app. Preserve prior installation/update checks and record sanitized revision/production URL/iPhone model/iOS and Chrome versions/manual PM outcomes. Desktop Chromium automation cannot replace this evidence. Safari-specific manual acceptance is not required. Use standards/feature detection without browser detection.

## Risks / Trade-offs

- Stale private data remains locally readable while disconnected -> explicit saved/unverified state, minimal single-owner payload, known-rejection/sign-out invalidation, and documented shared-device limits.
- Cross-account races resurrect an old row -> durable generations/fences and late-write/two-window tests.
- Storage eviction or blocked writes removes offline data -> separate shell/data readiness and honest online-only fallback.
- Cleanup failure prevents safe logout preparation -> fail visibly, abort the SDK attempt when no durable boundary exists, and never claim completed cleanup.
- Rollback/repair wipes unrelated data -> application-specific operations, snapshot version checks, and compatible worker-aware rollback.

## Migration Plan

Verify the accepted predecessor and synchronized `user-profile`/`user-auth` requirements before apply. Introduce local format version 1 only; no historical directory cache is deployed or needs migration. Implement/test persistence and auth invalidation together, review/accept and merge into `main`, publish through the existing Pages GitHub integration at the same production origin, and complete PM offline/reconnect/logout acceptance. No code or services change in this planning turn.

Rollback restores a compatible prior complete worker/build without mutating backend data or silently erasing SDK/locale/profile stores. If a prior online-only build cannot read snapshots, leave them undisplayed and ensure sign-out invalidation is honored before shipping that rollback.

## Execution prerequisites and evidence

The Supabase profile resource, existing `/` display, no `/profiles` route, and iPhone/Google Chrome Home Screen acceptance flow are decided. Cloudflare/GitHub access, the assigned production hostname, a readable existing PM profile, deployed revision, and tested iOS/Chrome versions are execution prerequisites/evidence. Missing live profile data does not authorize a new query or mutation. No genuine product ambiguity remains.
