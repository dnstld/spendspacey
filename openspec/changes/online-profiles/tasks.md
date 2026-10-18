# Tasks

Change 3/4. Fetch and render only the current user's own profile. No directory, profile editing, synchronization queue, durable profile store, backend mutation, new application query beyond this SELECT, or schema/RLS change belongs here. The PM confirmed `/profiles` denotes the Supabase `public.profiles` table/Data API resource (`/rest/v1/profiles`). Display it on the existing authenticated `/` screen and do not add a `/profiles` route.

## 1. Predecessor and current-user read

- [ ] 1.1 Verify `installable-offline-shell` is integrated, deployed, manually accepted in the iPhone Home Screen app installed from Chrome using Share → Add to Home Screen, with name/icon/standalone launch and iOS/Chrome versions recorded, and its specs synchronized. Reconcile the full minimal-view delta against that actual predecessor while retaining its PWA/callback additions; stop dependent implementation if the prerequisite is unmet.
- [ ] 1.2 Add the typed current-user read through the singleton client after SDK identity verification: project only `id,display_name,avatar_url,updated_at`, explicitly filter id to the verified user, accept zero/one row, validate owner/fields, and bypass browser response caching. Extend synthetic fixtures to assert the projection/filter and reject unexpected application reads/writes; verify wrong-owner, multiple/malformed, missing-row, and network/error cases without creating or changing database data.

## 2. Current-user card and lifecycle

- [ ] 2.1 Render one current-user card on the existing authenticated `/` screen, with no `/profiles` route, using database name/avatar or accessible fallbacks, SDK-only email, existing controls/PWA notices, and typed localized loading/missing/error/retry feedback. Verify component/resource/type and narrow/keyboard checks in both languages, safe text/URL handling, and no other-user card, editor, extra navigation, or fabricated profile; document the online-only contract here.
- [ ] 2.2 Coordinate one in-flight read per account generation with cleanup, manual/foreground/reconnect retry, immediate private-state clearing, and late-result guards. Verify Strict Mode, account A/B switching, rejection, and cross-tab sign-out tests. Add production-worker Chromium coverage for online reload, one own-profile card, no persistent application store and no runtime-cached Supabase/OAuth/callback/token/profile network responses, and cold offline reload showing only shell/connection guidance; offline fixtures must not fake connectivity.

## 3. Integrated checks and published acceptance

- [ ] 3.1 Include focused profile tests in the existing CI and run the documented full synthetic checks, strict change validation, and proposed-file/build/cache review. Verify no new data dependency, profile persistence, extra application query, mutation, schema/policy change, or private fixture entered this increment.
- [ ] 3.2 After CI/review and accepted changes merged into `main`, publish through the existing Cloudflare Pages Free GitHub integration at the same production `*.pages.dev` origin, retaining native fallback, disabled signups, and preview-authentication restrictions. Have the enrolled PM launch the iPhone Home Screen app installed through Google Chrome, reconfirm Spendspacey name/icon and standalone presentation, and verify the own-profile card online on `/`, its removal on sign-out, and cold-offline shell/unavailable feedback from that installed app. Verify live read access without capturing values or broadening RLS; treat a missing expected row/access failure as a PM prerequisite, not authority to insert/migrate. Record sanitized revision/production URL/iPhone model/tested iOS and Chrome versions/manual PM pass-fail and preserve installation/update behavior. Desktop Chromium cannot replace this evidence; Safari-specific manual acceptance is not required. Retain standards/feature detection without browser detection.

## Workflow follow-up

- Review and accept this increment, then synchronize `user-profile` and `user-auth` specs through the appropriate sync/archive workflow.
- Begin `offline-profiles` only after the online phone acceptance and synchronized predecessor contract.
