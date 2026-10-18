# Proposal

## Why

Once Spendspacey is deployed and installed, one read-only view of the signed-in user's own profile is sufficient to introduce application data. Keeping it online-only first makes query correctness, authorization, and rendering reviewable before durable private data is added.

## What Changes

- Sequence **3 of 4**; requires [installable-offline-shell](../installable-offline-shell/proposal.md) implemented, deployed, manually accepted on the iPhone Home Screen app installed through Chrome, with tested iOS/Chrome versions recorded, and predecessor specs synchronized before apply.
- Add one existing-client SELECT of `id,display_name,avatar_url,updated_at` from `public.profiles` (the Supabase `/profiles` resource, served at `/rest/v1/profiles`), explicitly filtered to the verified signed-in user's ID and protected by existing RLS. Return at most that user's row, never a directory of other users.
- Validate selected fields and the returned owner ID; provide localized loading, missing-profile, error/retry, and accessible name/avatar fallbacks in the signed-in root.
- Keep the result only in page memory. Clear it on account changes or sign-out and ignore late results from earlier accounts.
- On offline cold reload show the installed shell and localized connection guidance; do not claim a persistent profile or rely on HTTP/image caches.
- Add focused synthetic tests and preserve the static-only worker policy: never runtime-cache Supabase, OAuth, callback, token, or profile network responses.
- Publish/verify the read-only view on the existing iPhone Home Screen installation added through Google Chrome, with phase-specific online/offline checks performed there and tested iOS/Chrome versions in manual PM evidence, only after accepted changes merge into `main`, using the inherited Cloudflare Pages Free production origin and restricted preview-authentication policy.

No IndexedDB/Dexie, profile snapshot, backend mutation, extra application query, schema/RLS change, profile editing, transaction, or synchronization queue is included. A hard offline reload has no cached profile in this increment; durable offline profile display is change 4. The PM confirmed `/profiles` means the Supabase `public.profiles` table/Data API resource. Display the current-user card on the existing authenticated `/` screen; do not add a `/profiles` application route. Inherit standards/feature detection, with no browser detection or Safari-specific manual acceptance. Desktop Chromium does not replace manual installed-app evidence.

## Capabilities

### New Capabilities

- `user-profile`: One authorized current-user profile SELECT, validated minimal rendering, honest online-only availability, and in-memory account isolation.

### Modified Capabilities

- `user-auth`: Show the current user's read-only database profile in the minimal signed-in screen while preserving the PWA feedback and callback behavior introduced by its predecessor.

This delta uses the projected post-`installable-offline-shell` minimal-view requirement, not the untouched Phase 1 wording. The predecessor must be integrated and its specs synchronized before implementation.

## Impact

A small profiles read/React state boundary, the root identity screen, typed English/Portuguese resources, synthetic fixtures/tests, and concise documentation. Reuse existing Supabase/client authorization and the current build/CI/delivery path; add no query framework or storage dependency.

The existing profiles table/policy contract was inspected during [the combined exploration](../ship-installable-offline-profiles/design.md). Its RLS permits some co-member rows, so an explicit current-user ID filter is required in addition to RLS. Reuse the schema/policies unchanged and verify live SELECT access with the enrolled PM during apply; no profile values are planning evidence. Completion unblocks [offline-profiles](../offline-profiles/proposal.md).
