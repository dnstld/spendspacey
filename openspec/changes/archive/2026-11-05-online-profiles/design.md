# Design

## Context

See [proposal.md](proposal.md), [user-profile](specs/user-profile/spec.md), and [auth delta](specs/user-auth/spec.md). This is change 3/4. Its baseline is the [archived installable-offline-shell](../archive/2026-10-29-installable-offline-shell/proposal.md), with synchronized capability specs, the PM-approved fresh PR #8 iPhone/Chrome online/offline acceptance on 2026-10-29 and separately mapped representative technical lifecycle/update evidence. The future ordinary-update PM smoke is non-blocking; the abandoned experimental installation is not recovery evidence. Begin only after the closure is reviewed and merged; this handoff starts no implementation. That predecessor adds PWA feedback and safe callback behavior that this change must retain. Inherit Cloudflare Pages Free static delivery at the assigned production `*.pages.dev` origin, GitHub integration, exact toolchain/public-input limits, accepted `main` merges only for production, native SPA callback fallback, disabled new-user signups, and restricted preview authentication.

Earlier read-only metadata inspection established the existing `public.profiles` fields and enabled RLS. Its policy permits self and some co-member rows, so RLS alone does not select the current user's profile. Do not inspect other-user values or alter schema/policies to build this feature.

## Goals / Non-Goals

**Goals:** One online read of the current user's own profile and one minimal card, with safe account transitions.

**Non-Goals:** Profile directories, extra application reads, profile editing, server mutations, IndexedDB/Dexie, query persistence, generic query framework, offline profile restoration, or transaction work.

## Decisions

### 1. Explicitly constrain and validate the owner

Reuse the singleton Supabase client. After SDK restoration and online `getUser()` verification outside the auth-event callback, use the verified user id in a projected `profiles` SELECT: `id,display_name,avatar_url,updated_at`, filtered by `id`, with zero-or-one-row semantics such as `maybeSingle()`. Do not derive the owner from query parameters, editable metadata, a result's first row, or a remembered local id. RLS is still the server authorization boundary. Never runtime-cache Supabase, OAuth, callback, token, or profile network responses in the service worker. The PM confirmed `/profiles` means the Supabase `public.profiles` table/Data API resource (`/rest/v1/profiles`). Display the online current-user profile on the existing authenticated `/` screen; do not add a `/profiles` application route.

Validate the response owner matches that verified id, selected field types are valid, and timestamps/URLs are safe. A missing row is localized absence, not permission to insert or substitute another profile. Ensure the profile transport bypasses browser HTTP caching; app memory is the only result store. Auth's normal verification/refresh operations are not additional application data queries.

A self-only filter now deliberately replaces the combined plan's directory interpretation, following the PM's correction. Do not fetch co-member rows even if RLS permits them. [Supabase single-result reads](https://supabase.com/docs/reference/javascript/maybesingle), [Auth verification](https://supabase.com/docs/reference/javascript/auth-getuser)

### 2. Small React state boundary

Use a typed read helper and focused hook/provider rather than introduce TanStack Query or persistence plugins for one request. Coordinate launch, foreground/reconnect, and manual retry with one in-flight request per account generation. Keep auth callbacks synchronous; schedule network work outside them. On sign-out, account change, or true rejection, hide the row and advance the generation so late results cannot replace the new user's state. Preserve SDK cross-tab notifications and cleanup under Strict Mode.

Page memory may retain the already displayed row during transient disconnection, explicitly marked stale; cold reload cannot restore it. If offline with no row, show connection guidance and retry after verification recovers. No new local store or queue is allowed.

### 3. One current-user card

Use the existing authenticated `/` card and controls. Display database display_name/avatar when available, localized missing-field/image fallbacks, and session email only from the SDK. Loading/missing/error states are explicit and do not invent a database record. Render text safely; allow only credential-free HTTPS avatar URLs with no-referrer. Keep English/Portuguese resources typed and complete, and retain PWA connection/install/update notices from the predecessor.

Avoid a list, profile route/editor, duplicate identity directory, or new product navigation. There is no need for a new dependency or remote translation request.

### 4. Verify query boundaries, then publish

Extend synthetic Auth fixtures with only the current-user SELECT; assert projection and id filter, return zero/one row, reject wrong-owner/multiple/malformed responses, and fail unexpected backend reads/writes. Tests for account B use synthetic data only. Component tests cover name/image fallbacks, localization, errors, request deduplication, late results, and sign-out.

Browser tests against the production worker confirm one current-user card, online reload, two-tab clearing, and cold offline reload showing shell/connection guidance without persisted data. Check that Cache Storage still has no profile response and no application database was introduced. Review worker-owned request interception so fixtures cannot fake connectivity. Add these tests/docs to the existing CI, not to a later change.

After accepted changes merge into `main`, publish through the inherited Pages GitHub integration at the same production origin; the PM launches the iPhone Home Screen app installed through Chrome and confirms the own-profile card online on `/`, removal on sign-out, and the phase-specific cold-offline shell/unavailable feedback there. Reference the predecessor's Chrome Share → Add to Home Screen procedure and reconfirm Spendspacey name/icon and standalone launch. Record actual iOS and Chrome versions for this revision. Desktop Chromium cannot replace this manual PM evidence; Safari-specific manual acceptance is not required. Keep standards/feature detection without browser detection. If the expected row is absent or privileges fail, report it as a PM-owned prerequisite; do not create a row, broaden RLS, or run a migration. No actual profile values or live-account traces enter evidence.

## Risks / Trade-offs

- Broad RLS visibility is mistaken for current-user selection -> explicit verified-id filter and response owner validation.
- Late requests expose another account's row -> in-memory generations and two-tab/account-switch tests.
- Session email is accidentally copied into new data storage -> no persistence at this stage; email remains SDK-only.
- Browser/worker caches mask missing connectivity -> request no-store and explicit cold offline tests without fixture fulfillment.

## Migration Plan

Before apply, integrate/accept the predecessor and synchronize its specs. Reconcile the full minimal-view delta against that projected baseline while retaining callback/PWA additions. Implement/test the one read/card, publish, and record sanitized phone acceptance. Revert to the prior accepted complete worker/build if needed; no data migration or persistent profile format exists.

After this change's acceptance and spec synchronization, [offline-profiles](../offline-profiles/proposal.md) can add durable storage.

## Execution prerequisites and evidence

The current-user data resource, existing `/` display, absence of a `/profiles` application route, and iPhone/Google Chrome Home Screen acceptance target are decided. Confirm the enrolled PM's existing row is readable during execution; missing live data does not authorize profile mutations. Cloudflare/GitHub access and the assigned hostname are execution prerequisites. Record the deployed revision, tested iOS/Chrome versions, and sanitized installed-app PM outcomes. No genuine product ambiguity remains.
