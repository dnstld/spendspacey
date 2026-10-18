# Spec Delta

## MODIFIED Requirements

### Requirement: Profile rendering is minimal and localized

The `/` screen SHALL render one current-user profile card with safe text, a validated HTTPS avatar or accessible fallback, and localized loading, missing-profile, and retry feedback. Session email SHALL be shown only from an available SDK session, never copied into the profile snapshot. Profile values SHALL NOT be translated or rendered as executable markup. Offline cards SHALL identify saved data and use image fallbacks. No `/profiles` application route SHALL be added.

#### Scenario: Profile is rendered
- **WHEN** a valid current-user profile or eligible saved snapshot is available
- **THEN** its display name and avatar/fallback appear without a directory, other-user card, profile editor, or unrelated content
- **AND** missing names and broken/unsafe avatars have localized accessible fallbacks
- **AND** English/Brazilian Portuguese, keyboard operation, and narrow layouts follow the existing shell requirements
- **AND** offline rendering needs no remote image or cached avatar response
- **AND** `/profiles` identifies the Supabase `public.profiles` table/Data API resource; online and saved-local cards remain on the existing `/` screen

#### Scenario: Profile loading fails
- **WHEN** the profile read cannot complete online
- **THEN** loading ends with localized retry feedback while the shell and appropriate authentication controls remain usable
- **AND** eligible saved data can remain visible with stale feedback, but rejected authentication/access disables it
- **AND** no raw provider error, profile payload, or credential is shown

### Requirement: Profile availability is explicit

Successful verified online current-user reads SHALL produce a minimal durable account/backend/version-scoped snapshot, separate from service-worker caches. A matching eligible snapshot SHALL support clearly labeled local viewing after offline refresh/relaunch even when token refresh is unavailable. It SHALL NOT establish fresh authentication. No matching snapshot SHALL produce connection guidance, not a fabricated profile.

#### Scenario: Online launch loads profile
- **WHEN** the installed shell launches online with a verified account
- **THEN** the same owner-filtered read loads that user's profile and atomically replaces its snapshot with explicit loading/error/persistence feedback
- **AND** a successful missing-profile result replaces any previous row rather than retaining stale data

#### Scenario: Cold offline reload shows connection guidance
- **WHEN** a prepared shell has its first offline visit or hard reload without a matching usable cached profile
- **THEN** it remains usable with localized profile-unavailable/reconnect feedback in English or Brazilian Portuguese and does not claim a restored profile
- **AND** any previously loaded in-memory result is not treated as durable data unless its snapshot commit succeeded
- **AND** after connection and authentication recover, the same current-user read can run again

#### Scenario: Cold offline reload restores the current-user snapshot
- **WHEN** a prepared app hard reloads or reopens offline with an eligible snapshot saved after a successful verified online current-user fetch, including with an expired SDK token
- **THEN** only the saved current-user profile or saved missing-profile state is rendered with local/offline and last-refresh feedback
- **AND** the shell and language selector are usable without an indefinite authentication spinner
- **AND** the snapshot is not used to authenticate network requests or reconstruct Auth identity/email

## ADDED Requirements

### Requirement: Durable profile snapshots contain only permitted data

A snapshot SHALL contain only the current-user backend/account binding, format/generation metadata, last-successful-fetch time, and the selected validated row or explicit missing-row result. Its row ID SHALL match the owner binding. Tokens, credentials, SDK sessions, Auth email, other-user rows, callback parameters, and avatar image bytes SHALL NOT be copied into application data storage.

#### Scenario: Snapshot is inspected
- **WHEN** synthetic data is loaded and persisted
- **THEN** the stored payload contains at most that one matching profile and the permitted metadata
- **AND** inspection finds no additional identity, credentials, API response envelope, session object, or image response
- **AND** the unchanged worker cache still contains only static build assets and never runtime-caches Supabase, OAuth, callback, token, or profile network responses

### Requirement: Local profile access has durable invalidation

Account changes, permitted explicit sign-out initiation, confirmed sign-out, and genuine authentication/access rejection SHALL invalidate saved viewing. Late reads/writes from an older generation SHALL NOT revive it. Failed deletion SHALL use a durable invalidation boundary; inability to persist either SHALL be reported without claiming completed cleanup.

#### Scenario: Account changes while a snapshot write is pending
- **WHEN** account B replaces account A during A's read or save
- **THEN** A's cached row is hidden, durably invalidated, and cleared before B's view can load
- **AND** late work cannot commit or display A's row for B

#### Scenario: Sign-out or another-window invalidation occurs
- **WHEN** sign-out begins with connectivity or the app receives a sign-out/invalidation event from another window
- **THEN** saved profile access is disabled immediately, durably invalidated, and cleared before a permitted SDK sign-out attempt, subject to the explicit persistent-cleanup failure handling below
- **AND** later offline reload cannot display the old row while language choice and static assets remain available
- **AND** a network failure does not automatically restore the old snapshot

#### Scenario: Persistent cleanup fails
- **WHEN** the snapshot cannot be deleted
- **THEN** a durable invalidation boundary prevents it from being shown again
- **AND** if no boundary or deletion can be persisted, the current page hides the row and reports a storage/retry error without claiming completed sign-out or cleanup

### Requirement: Reconnection refreshes the same current-user read

Reconnect/resume SHALL reconcile SDK authentication and coordinate a refresh of the existing explicitly owner-filtered read. Successful data or absence SHALL replace the full snapshot. Network failures SHALL retain eligible saved data with stale feedback; authentication/access rejection SHALL disable local viewing. No mutation, OAuth, callback, or sign-out replay SHALL occur.

#### Scenario: Reconnection succeeds
- **WHEN** connectivity and verified authentication return for the same owner
- **THEN** one coordinated refresh replaces the saved/current card and its timestamp with the authorized current result
- **AND** a removed profile clears any prior row and produces the missing-profile state

#### Scenario: Reconnection fails
- **WHEN** network access still fails
- **THEN** eligible saved data remains available with localized retry/stale feedback
- **AND** genuine authentication/authorization rejection instead invalidates it and requires appropriate online recovery
- **AND** an older successful request cannot undo that invalidation

### Requirement: Storage failures do not claim offline data readiness

Unavailable, full, blocked, malformed, incompatible, or evicted local storage SHALL NOT be reported as a successful profile snapshot save. Online rendering SHALL remain usable where possible, and profile-data readiness SHALL be distinct from the already prepared static shell.

#### Scenario: Read succeeds but snapshot cannot be saved
- **WHEN** the current-user read succeeds and local persistence fails
- **THEN** the online profile is usable with localized feedback that it is not saved offline
- **AND** static-shell readiness is not presented as profile-data readiness

#### Scenario: Stored data is unusable
- **WHEN** a snapshot has an unsupported version, mismatched owner/backend, invalid row, or missing data
- **THEN** it is not rendered and online recovery is offered
- **AND** authentication/language storage is not automatically erased

### Requirement: Installed offline profile acceptance is required

Completion SHALL require synthetic persistence/privacy/account-race tests and manual PM evidence from the iPhone Home Screen app installed through Chrome: successful authenticated online profile load, complete close, connectivity removal, offline relaunch/reload, and only that user's cached profile. Tested iOS/Chrome versions, reconnect, and sign-out cleanup SHALL be recorded. Desktop Chromium SHALL NOT replace this evidence; Safari-specific manual acceptance SHALL NOT be required.

#### Scenario: PM verifies saved current-user data
- **WHEN** accepted changes merged into `main` are published at the inherited Pages production origin and the PM successfully authenticates and loads their own `/` profile online until snapshot commit in the installed iPhone Home Screen app
- **THEN** the PM completely closes that app, removes connectivity, reopens it from the Home Screen, and hard reloads; only that user's cached profile appears with saved/offline feedback in both supported languages
- **AND** the app was installed from Chrome Share → Add to Home Screen with the Spendspacey name/intended icon and verified standalone presentation, rather than an ordinary browser bookmark/tab
- **AND** a missing-profile result does not satisfy this successful-profile manual case
- **AND** a prepared context with no cached profile shows localized unavailable feedback after offline hard reload
- **AND** reconnect refreshes the same `/profiles` current-user read, with no profile editing or synchronization queue, and sign-out followed by offline reload shows no previous private row
- **AND** the record identifies the production URL, deployed revision, iPhone model, tested iOS and Chrome versions, and manual PM results without profile values or real-account traces
