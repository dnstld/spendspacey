# Spec Delta

## MODIFIED Requirements

### Requirement: Minimal authentication views

The application SHALL show Spendspacey identity, language selection, and Google sign-in when signed out. The signed-in `/` screen SHALL show the current user's read-only database profile when available, session email, language selection, and sign-out, plus necessary authentication, connection, installation, and update feedback. No expense content, dashboard, editable profile, other-user profile directory, or extra login method SHALL be introduced.

#### Scenario: Signed-out entry
- **WHEN** session initialization completes without a session
- **THEN** the signed-out view shows Spendspacey identity, language selection, and Google sign-in
- **AND** it shows no expense content, dashboard, editable profile, or other login method
- **AND** necessary PWA and connection feedback can appear

#### Scenario: Signed-in entry
- **WHEN** a session exists and the current-user profile is available
- **THEN** the screen shows only that user's profile name/avatar or fallbacks, session email, language selection, sign-out, and necessary feedback
- **AND** the sign-in button, other users' profiles, and unrelated application content are absent
- **AND** `/profiles` is the Supabase `public.profiles` Data API resource, with no application route added for it

#### Scenario: Incomplete identity information
- **WHEN** a profile identity field is missing or its avatar fails to load
- **THEN** the screen remains usable with a localized missing-field label or avatar fallback
- **AND** user-supplied identity text is rendered as text rather than executable markup

#### Scenario: Profile is missing or unavailable
- **WHEN** the current-user read is pending, missing, or fails
- **THEN** localized profile feedback and appropriate authentication controls remain usable
- **AND** no other user's row or fabricated database profile replaces it
