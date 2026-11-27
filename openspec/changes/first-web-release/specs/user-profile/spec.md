# User profile delta

## MODIFIED Requirements

### Requirement: Only the current user's profile is read

The application SHALL select only `id`, `display_name`, `avatar_url`, and `updated_at` from the existing `/profiles` Supabase resource, explicitly filtered to the verified signed-in user's ID and protected by existing RLS. At most one matching row SHALL be accepted. The finance workspace SHALL NOT use the profile query to read another account or write a profile. Wallet-member attribution follows the wallet-scoped contract.

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

The Carteiras destination at authenticated `/` SHALL render one current-user profile card with safe text, a validated HTTPS avatar or accessible fallback, and localized loading, missing-profile, and retry feedback. The session email and authentication controls SHALL remain available without becoming profile-query fields. Profile values SHALL NOT be translated or rendered as executable markup. No `/profiles` application route SHALL be added.

#### Scenario: Profile is rendered
- **WHEN** a valid current-user profile is available
- **THEN** its display name and avatar/fallback appear without a directory, other-user card, profile editor, or unrelated content
- **AND** missing names and broken/unsafe avatars have localized accessible fallbacks
- **AND** Brazilian Portuguese, keyboard operation, and narrow layouts follow the workspace requirements

#### Scenario: Profile loading fails
- **WHEN** the profile read cannot complete online
- **THEN** loading ends with localized retry feedback while the shell and appropriate authentication controls remain usable
- **AND** no raw provider error, profile payload, or credential is shown
