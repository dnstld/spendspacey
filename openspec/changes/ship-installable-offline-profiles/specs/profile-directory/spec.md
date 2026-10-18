> **Superseded planning record — 2026-10-17.** Do not implement or synchronize this historical artifact. Follow the four replacements and current-user-only correction in [the supersession map](../../proposal.md). Original content and task completion state are preserved unchanged below.

>
> **PM decisions — 2026-10-18:** Follow the supersession map above for Cloudflare Pages Free, accepted `main` production delivery, exact Auth configuration with signups disabled, restricted previews, and read-only current-user `/profiles` with separate offline snapshot storage. Historical Vercel, missing-asset-404, and profile-directory directions below are superseded; no Supabase/OAuth/callback/token/profile network response may be runtime-cached by the service worker. The original body remains unchanged.

>
> **Resolved PM scope and device acceptance — 2026-10-18:** Follow the supersession map above: `/profiles` is Supabase `public.profiles`/Data API, displayed on existing `/`, with no `/profiles` application route. Manual PWA acceptance is iPhone/Google Chrome Share → Add to Home Screen, Spendspacey name/icon, standalone Home Screen launch, phase-specific installed-app online/offline checks, and recorded iOS/Chrome versions. Offline profiles require successful authenticated online load/commit, complete close, connectivity removal, and reopen/reload showing only that user's cached profile. Desktop Chromium cannot replace PM evidence. Safari-specific manual acceptance is not required; use standards/feature detection without browser detection. Cloudflare/GitHub access and assigned hostname are execution prerequisites. Original body preserved below.

# Spec Delta

## Purpose

Display the profiles an authenticated user is allowed to read, retaining a minimal private snapshot for offline refresh without introducing profile editing or other application data operations.

## ADDED Requirements

### Requirement: Profiles are read through existing authorization

The application SHALL read only `id`, `display_name`, `avatar_url`, and `updated_at` from the existing profiles resource using the current user's session and existing row-level security. It SHALL NOT add profile writes, schema changes, authorization bypasses, or reads of unrelated application resources.

#### Scenario: Authorized profiles load
- **WHEN** an authenticated user opens the online root view
- **THEN** the application renders the profiles returned by the authorized profiles read
- **AND** it does not assume the result is every profile in the database or only the current user's profile
- **AND** values are validated, names render as text, and missing names or unavailable avatars have accessible localized fallbacks

#### Scenario: No profiles are visible
- **WHEN** the authorized read succeeds with no visible rows
- **THEN** a localized empty state replaces any earlier list
- **AND** the application does not create a profile, invent identity rows, or treat an empty result as a request failure

### Requirement: A successful read produces a durable minimal snapshot

The application SHALL persist only validated selected profile fields and snapshot metadata, scoped to the backend, account, and snapshot format version. A successful snapshot SHALL survive page refresh and relaunch in the same browser storage context. Tokens, credentials, auth payloads, and avatar image bytes SHALL NOT be copied into it.

#### Scenario: Online data becomes available offline
- **WHEN** an authorized profiles read and its local snapshot save both succeed
- **THEN** refreshing or reopening the prepared application offline displays that saved list
- **AND** the list is identified as saved data with a localized last-successful-refresh time
- **AND** local data storage is separate from service-worker Cache Storage

#### Scenario: Snapshot metadata is inspected
- **WHEN** the saved snapshot is inspected using synthetic test data
- **THEN** it contains only the backend/account scope, format version, fetch time, selected validated profile fields, and minimal local access/invalidation metadata
- **AND** it contains no access token, refresh token, provider token, auth-session object, email copied from Auth, or cached image response

### Requirement: Offline viewing is distinct from authentication

Previously authorized profiles SHALL remain viewable offline after refresh when authentication refresh is unavailable, including an expired access token. This read-only local mode SHALL be clearly labeled and SHALL NOT imply fresh authentication or authorize network requests. Without a matching usable snapshot, the application SHALL show a localized unavailable state.

#### Scenario: Token refresh cannot complete offline
- **WHEN** a previously signed-in user reloads offline with a usable snapshot and an expired or refreshing SDK session
- **THEN** the saved profiles and language selector remain usable without an indefinite authentication spinner
- **AND** the application explains that connection is needed to verify the session and refresh profiles
- **AND** no fresh sign-in, code exchange, profile read, or write is claimed to have succeeded

#### Scenario: No offline snapshot exists
- **WHEN** the static shell is available offline but no matching profile snapshot has been saved
- **THEN** it shows a localized explanation that profiles need an online visit
- **AND** it displays no synthetic, other-account, or fabricated profile data

#### Scenario: Offline avatars
- **WHEN** saved profiles render without connectivity
- **THEN** names and accessible avatar fallbacks remain visible without depending on remote images or their browser HTTP cache

### Requirement: Snapshots do not cross accounts or survive revoked local access

Account changes, explicit sign-out initiation, confirmed sign-out events, and server rejection of authentication or profile access SHALL invalidate local profile viewing. In-flight reads or writes from an older account generation SHALL NOT restore invalidated data. Failed persistent cleanup SHALL keep the application fail-closed for profile display.

#### Scenario: Account changes during a request
- **WHEN** account B replaces account A while A's profile read or snapshot save is pending
- **THEN** no profile snapshot belonging to A appears under B
- **AND** a late result cannot overwrite B's current state or re-enable A's local viewing

#### Scenario: Sign-out invalidates a snapshot
- **WHEN** a permitted sign-out attempt starts or a sign-out event arrives from another application window
- **THEN** private profile viewing is disabled immediately and the snapshot is invalidated before it can be used after reload
- **AND** the language preference and static shell remain available
- **AND** a network sign-out failure does not automatically re-enable the old snapshot

#### Scenario: Invalidated data cannot be deleted immediately
- **WHEN** a local snapshot deletion fails
- **THEN** a durable local invalidation boundary prevents that snapshot being shown again
- **AND** if neither invalidation nor cleanup can be persisted, the application explains the storage problem and does not claim completed private-data cleanup

### Requirement: Reconnection refreshes saved profiles without replaying operations

When a prepared application returns online or resumes with connectivity, it SHALL reconcile authentication and refresh the profiles read for the same verified account. Successful results SHALL replace the prior snapshot, including removals. Network failures SHALL retain eligible saved data with stale feedback; authentication or authorization rejection SHALL disable saved viewing.

#### Scenario: Reconnection succeeds
- **WHEN** connectivity and valid authentication return for the snapshot owner
- **THEN** one coordinated refresh replaces the displayed list and saved snapshot with the currently authorized result
- **AND** no OAuth, callback code, mutation, or sign-out operation is automatically replayed

#### Scenario: Permissions or visible profiles change
- **WHEN** a successful refreshed result contains fewer profiles or no profiles
- **THEN** previously visible rows absent from the result are removed from display and the stored snapshot

#### Scenario: A refresh fails
- **WHEN** the profiles endpoint cannot be reached
- **THEN** eligible saved profiles remain visible with localized stale/retry feedback
- **AND** an authentication or authorization rejection instead invalidates local viewing and requires appropriate online recovery

### Requirement: Storage failures are visible and recoverable

Unavailable, full, malformed, incompatible, or evicted local storage SHALL NOT be reported as successful offline persistence. The online profiles read SHALL remain usable where possible, with localized feedback explaining any offline limitation.

#### Scenario: Profiles load but persistence fails
- **WHEN** a profiles read succeeds but its snapshot cannot be saved
- **THEN** the online list is usable and a localized message states it is not saved for offline use
- **AND** readiness of static assets is not presented as readiness of profile data

#### Scenario: A stored snapshot is unusable
- **WHEN** a snapshot fails validation or has an unsupported format or backend/account scope
- **THEN** it is not displayed and the application offers online recovery
- **AND** there is no crash, raw diagnostic disclosure, or automatic deletion of authentication or language storage
