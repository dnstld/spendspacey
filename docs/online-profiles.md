# Online current-user profile

This increment adds one online-only, read-only view of the signed-in user's own database profile. It does not add an application `/profiles` route: the card remains on the authenticated `/` screen.

## Data boundary

- The application first verifies the current identity with the Supabase Auth SDK.
- It then performs one `public.profiles` read projected to `id,display_name,avatar_url,updated_at` and explicitly filtered to that verified ID.
- Zero or one row is accepted. Wrong-owner, multiple-row, malformed, or failed responses become localized recovery states and never render raw diagnostics.
- The name and avatar come only from the database row. Email remains SDK session data and is not copied into the profile query.
- The application performs no profile insert, update, delete, directory query, schema change, or policy change.

## Availability and privacy

The result lives only in React page memory. It is not written to local storage, IndexedDB, Cache Storage, or a service-worker runtime cache. SDK and Data API requests bypass the browser response cache. The static worker continues to route Supabase, OAuth, callback, token, profile, authorization-bearing, and non-GET requests to the network without storing their responses.

An already displayed row may remain visibly marked as stale during a transient disconnection in the same document. A cold offline reload cannot restore it and shows localized connection guidance instead. Reconnect, foreground, and manual retry can start the same verified current-user read again.

## Account lifecycle

Only one coordinated read is active for an account generation. The complete identity-plus-profile operation has a bounded deadline; expiry aborts the profile transport when possible, releases the coordinated flight, and shows the existing localized retry state. A manual retry or later foreground/reconnect signal starts a fresh operation. Results from an expired operation are ignored even if an underlying request settles late.

Sign-out attempts, account changes, rejected reads, and cross-tab sign-out clear the displayed profile immediately and cancel unneeded work. Results from an older generation are ignored. React Strict Mode and repeated foreground/reconnect signals share the current in-flight operation rather than creating concurrent duplicate reads, and effect cleanup releases timers and cancellation resources.

## Acceptance boundary

Synthetic unit/component and Chromium tests cover query shape, rendering, localization, narrow/keyboard use, account switching, cross-tab removal, reload, and offline cache privacy. Production publication and the installed iPhone/Chrome Home Screen acceptance remain a separate post-merge gate; desktop automation does not replace that evidence.
