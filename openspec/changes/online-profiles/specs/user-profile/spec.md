# Spec Delta

## Purpose

Display the signed-in user's own read-only database profile with clear loading, missing-data, and error behavior, without fetching other users or adding profile editing.

## ADDED Requirements

### Requirement: Only the current user's profile is read

The application SHALL select only `id`, `display_name`, `avatar_url`, and `updated_at` from the existing `/profiles` Supabase resource, explicitly filtered to the verified signed-in user's ID and protected by existing RLS. At most one matching row SHALL be accepted. No other profile, application query, backend mutation, or schema/policy change SHALL be introduced.

#### Scenario: Current user profile loads
- **WHEN** the authenticated user opens the online root view
- **THEN** one coordinated read requests only that user's profile and accepts a result only when its ID equals the verified session user ID
- **AND** RLS remains enforced even if it permits additional rows that were not requested
- **AND** `/profiles` refers to the existing Supabase `public.profiles` table/Data API resource exposed through `/rest/v1/profiles`, displayed on the existing authenticated `/` screen without a `/profiles` route, directory, editor, or synchronization queue
- **AND** repeated mounts or events do not fan out concurrent duplicate reads for the same account generation

#### Scenario: Profile does not exist
- **WHEN** the authorized filtered read succeeds with no row
- **THEN** a localized missing-profile state appears
- **AND** the application does not insert a row, substitute another user, or report the absence as successful profile data

#### Scenario: A response contains the wrong user or invalid fields
- **WHEN** the response has an unexpected owner ID, multiple rows, or malformed selected fields
- **THEN** it is rejected without rendering or retaining that profile
- **AND** localized safe recovery appears without exposing raw payloads

### Requirement: Profile rendering is minimal and localized

The authenticated `/` screen SHALL render one current-user profile card with safe text, a validated HTTPS avatar or accessible fallback, and localized loading, missing-profile, and retry feedback. The session email and authentication controls SHALL remain available without becoming profile-query fields. Profile values SHALL NOT be translated or rendered as executable markup. No `/profiles` application route SHALL be added.

#### Scenario: Profile is rendered
- **WHEN** a valid current-user profile is available
- **THEN** its display name and avatar/fallback appear without a directory, other-user card, profile editor, or unrelated content
- **AND** missing names and broken/unsafe avatars have localized accessible fallbacks
- **AND** English/Brazilian Portuguese, keyboard operation, and narrow layouts follow the existing shell requirements

#### Scenario: Profile loading fails
- **WHEN** the profile read cannot complete online
- **THEN** loading ends with localized retry feedback while the shell and appropriate authentication controls remain usable
- **AND** no raw provider error, profile payload, or credential is shown

### Requirement: Profile results follow the current account

Displayed profile state SHALL belong to the current account generation. Account changes, sign-out, or rejected access SHALL clear private in-memory results. An older request SHALL NOT render a previous user's profile after those transitions.

#### Scenario: Account changes during a read
- **WHEN** account B replaces account A while A's read is pending
- **THEN** A's result cannot appear for B
- **AND** B can load only B's owner-filtered profile

#### Scenario: Sign-out reaches another window
- **WHEN** a current-session sign-out is observed in another application window
- **THEN** that window removes the previous profile and follows actual SDK session state
- **AND** late requests cannot restore the removed data

### Requirement: Profile availability is explicit

Profile query results SHALL be held only in page memory and SHALL NOT be persisted in application storage, service-worker caches, or a browser response cache used for offline restoration. Cold offline reload SHALL show connection guidance rather than promise a saved profile.

#### Scenario: Online launch loads profile
- **WHEN** the installed shell launches online with a verified account
- **THEN** the current-user profile is loaded through the authorized read with explicit loading/error states

#### Scenario: Cold offline reload shows connection guidance
- **WHEN** the installed shell reloads without connectivity
- **THEN** it remains usable with localized connection guidance but does not claim a restored profile
- **AND** any previously loaded in-memory result is not treated as durable offline data
- **AND** no Supabase, OAuth, callback, token, or profile network response is runtime-cached by the service worker; saved-profile hard-reload support belongs to the subsequent offline increment
- **AND** after connection and authentication recover, the same current-user read can run again

### Requirement: Online profile delivery is accepted before offline storage

The online-only increment SHALL pass synthetic query/rendering/account-isolation tests, publication, and PM confirmation of the current-user card on the installed iPhone Home Screen app added through Chrome before durable profile storage is introduced. Evidence SHALL be sanitized; persistence is outside that increment.

#### Scenario: Phone verifies the online profile
- **WHEN** automated checks pass and accepted changes merged into `main` are published at the inherited Cloudflare Pages production origin
- **THEN** the PM launches the iPhone Home Screen app installed using Chrome Share → Add to Home Screen, reconfirms Spendspacey name/icon and standalone presentation, confirms the one current-user card online on `/`, and confirms sign-out removes it
- **AND** phase-specific cold-offline shell/unavailable feedback is checked from that same installed app
- **AND** deployed revision, production URL, tested iOS and Chrome versions, and manual PM pass/fail are recorded without actual profile values or real-account traces
- **AND** desktop Chromium automation does not replace manual installed-app evidence, Safari-specific manual acceptance is not required, and standards/feature detection introduce no browser detection
- **AND** the static-only worker privacy checks still pass
