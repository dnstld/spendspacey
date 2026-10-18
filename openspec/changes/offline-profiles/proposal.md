# Proposal

## Why

After the current-user profile read is proven on the installed app, preserve that one profile for disconnected refresh and relaunch. Private durable data and expired-session behavior belong in their own change so account isolation and sign-out cleanup can be reviewed together.

## What Changes

- Sequence **4 of 4**; requires [online-profiles](../online-profiles/proposal.md) implemented, deployed, manually accepted in the iPhone Home Screen app installed through Chrome with tested iOS/Chrome versions recorded, and its durable `user-profile`/`user-auth` specs synchronized before apply.
- Persist only after a successful online, verified current-user fetch from the existing Supabase `/profiles` resource (`/rest/v1/profiles`). Cache only that signed-in user's minimal validated profile snapshot in account/backend/version-scoped IndexedDB, distinct from static service-worker Cache Storage. Proposed storage tooling is Dexie; no other user's row is fetched or retained.
- Display the saved current-user profile and last-refresh/offline feedback after an offline hard reload or relaunch, including when SDK token refresh cannot complete offline. Saved viewing is not fresh authentication.
- On reconnect/resume, verify the user through Auth and refresh the same explicitly owner-filtered SELECT; replace the snapshot, including a missing-profile result. Keep eligible saved data on network failure and invalidate it on genuine access rejection.
- Clear cached profile data on sign-out or identity change, with durable invalidation and generation guards for cross-window events, late reads/writes, and failed local cleanup.
- A prepared shell's first offline visit without cached profile data shows localized unavailable/reconnect feedback in either language. A never-prepared shell retains the browser-owned first-ever-offline limitation.
- Never runtime-cache Supabase, OAuth, callback, token, or profile network responses in the service worker; persist only the validated minimal application snapshot in the separate store.
- Cover storage failures, malformed/evicted snapshots, no-snapshot state, both locales, privacy boundaries, expired-session cold reload, and manual iPhone/Google Chrome Home Screen offline/reconnection/sign-out acceptance at the existing origin. After a successful authenticated online profile load and snapshot commit in the installed app, close it, remove connectivity, then reopen it from the Home Screen and hard reload; only that user's cached profile must remain visible. Record tested iOS and Chrome versions; desktop Chromium does not replace this evidence.

No profile editing, synchronization queue, new backend query, backend mutation, schema/RLS change, transaction entry, upload queue, background execution, realtime subscription, or synchronization service is included. Local IndexedDB writes are snapshot persistence, not server mutations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-profile`: Replace the predecessor's explicit online-only availability with a minimal durable current-user snapshot, labeled offline viewing, storage failure handling, and reconnection rules.
- `user-auth`: Allow saved-local viewing while authentication is unresolved, and coordinate sign-out/current-account state with durable private snapshot invalidation.

`user-profile` does not exist on current Phase 1 main; it is introduced by the mandatory `online-profiles` predecessor. This plan explicitly targets that projected baseline. Keep its path and full modified requirement blocks when integrating in order.

## Impact

A versioned Dexie store, profiles/auth lifecycle coordination, new typed feedback, focused IndexedDB/component/Chromium coverage, and data-retention/phone acceptance documentation. Keep the existing worker's static-only policy, Cloudflare Pages Free production origin/native SPA fallback, PKCE ownership, and SDK token persistence unchanged. Inherit production only from accepted changes merged into `main`, disabled new-user signups, exact callbacks, and restricted preview authentication. The PM confirmed `/profiles` means Supabase `public.profiles`/Data API, not a route: keep the current-user card on the existing authenticated `/` screen and saved-local viewing on that same `/`; add no `/profiles` application route. Inherit Chrome Share → Add to Home Screen, Spendspacey name/icon and standalone verification, standards/feature detection without browser detection, and no Safari-specific manual acceptance.

This completes the four-part replacement of [ship-installable-offline-profiles](../ship-installable-offline-profiles/proposal.md). Privacy means no session/token/Auth-email/image-response copies, no cross-account snapshot display, and no assertion that offline local data is currently authorized by the server.
