# Spec Delta

## MODIFIED Requirements

### Requirement: Offline shell launch does not require completed authentication

The localized static shell and language selector SHALL remain usable when session restoration needs unavailable network access. Bounded connection/retry feedback SHALL replace indefinite blocking initialization without treating failure as confirmed sign-out. An eligible current-user snapshot SHALL permit labeled saved-local viewing, without copying SDK identity into a new offline store or claiming fresh authentication.

#### Scenario: Expired or unavailable session on offline launch
- **WHEN** a prepared shell reloads offline and SDK restoration/refresh cannot complete
- **THEN** the user can see the shell, change language, and receive reconnect guidance
- **AND** an eligible snapshot can show the saved current-user card while absence of one shows no fabricated profile
- **AND** no fresh authentication or current server verification is claimed and later SDK results still obey existing ordering and cleanup rules

### Requirement: Minimal authentication views

The application SHALL show Spendspacey identity, language selection, and Google sign-in when signed out. The signed-in `/` screen SHALL show only the current user's profile, available SDK session email, language selection, sign-out, and necessary auth/PWA feedback. An eligible saved profile SHALL support explicitly unverified offline viewing without a current session. No other-user directory, expense content, dashboard, profile editor, or extra login method SHALL be introduced.

#### Scenario: Signed-out entry
- **WHEN** session initialization confirms sign-out and no eligible saved access remains
- **THEN** the signed-out view shows Spendspacey identity, language selection, and Google sign-in
- **AND** it shows no expense content, dashboard, editable profile, or other login method
- **AND** necessary PWA and connection feedback can appear without private profile data

#### Scenario: Signed-in entry
- **WHEN** a session exists and the current-user profile is available
- **THEN** the screen shows only that user's profile name/avatar or fallbacks, available session email, language selection, sign-out, and necessary feedback
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

#### Scenario: Saved profile is viewable without verified authentication
- **WHEN** SDK restoration/refresh needs unavailable connectivity and an eligible current-user snapshot exists
- **THEN** the app shows that saved card and language selection with an explicit offline/unverified notice
- **AND** it does not invent authentication, reconstruct SDK email, or enable online-only actions

### Requirement: Session restoration is ordered with authentication changes

The application SHALL distinguish pending restoration, current authentication, confirmed sign-out, and unavailable verification. It SHALL reflect newer authentication events without older results reversing them. An eligible current-user snapshot SHALL support unverified offline viewing when restoration needs unavailable network access, without treating the snapshot as authentication.

#### Scenario: Restore a stored session
- **WHEN** the application launches with a restorable session
- **THEN** it shows initialization feedback followed by that user's authenticated view
- **AND** it does not flash the signed-out sign-in button during restoration

#### Scenario: Newer event wins over restoration
- **WHEN** sign-in or sign-out occurs while an older restoration request is pending
- **THEN** completion of that older request does not reverse the newer state

#### Scenario: Refresh or identity update
- **WHEN** the authentication service reports a refreshed session or updated user information
- **THEN** displayed SDK identity/session values reflect the latest information and the current-user profile follows its own authorized read
- **AND** repeated sign-in notifications do not trigger navigation loops

#### Scenario: Restoration fails
- **WHEN** session restoration returns an error
- **THEN** localized recovery appears rather than treating the error as proof of sign-out
- **AND** an eligible current-user snapshot is available only as explicitly unverified local viewing

#### Scenario: Expired session on offline refresh
- **WHEN** a prepared app reloads offline with an expired SDK token and an eligible snapshot
- **THEN** the saved card and language selector remain usable without indefinite blocking initialization
- **AND** any later network profile request requires actual SDK verification, not the saved owner marker

#### Scenario: A server rejects restored access
- **WHEN** authentication or current-user profile authorization is genuinely rejected online
- **THEN** local profile viewing is invalidated and appropriate online recovery appears
- **AND** old reads/writes cannot re-enable it

### Requirement: Sign-out affects the current session

Sign-out SHALL end only the current authentication session and preserve explicit language preference. With connectivity it SHALL invalidate private profile access before the SDK attempt and report failure according to actual SDK state. No local cleanup SHALL be represented as confirmed server revocation, and inability to persist an invalidation boundary SHALL abort the SDK attempt without claiming success.

#### Scenario: Successful current-session sign-out
- **WHEN** the user activates sign-out with connectivity and the operation succeeds
- **THEN** the signed-out view appears and remains signed out after reload
- **AND** explicit language choice remains and independent sessions on other devices are not revoked
- **AND** offline reload retains the static shell but reveals no previous private profile

#### Scenario: Sign-out fails
- **WHEN** sign-out returns a network or service error
- **THEN** localized retry feedback follows actual SDK session state, distinguishing cleared local state from unconfirmed server revocation
- **AND** invalidated snapshots are not automatically restored and sign-out is not replayed on reconnect

#### Scenario: Session ends elsewhere in the same browser
- **WHEN** the app receives notice that the current session ended in another tab
- **THEN** authenticated identity and private profile display are removed
- **AND** durable access is invalidated and older reads/writes cannot reverse the change

#### Scenario: Private invalidation cannot be persisted
- **WHEN** neither snapshot deletion nor a durable invalidation boundary can be established before sign-out
- **THEN** the SDK attempt is aborted, the current page hides private profile data, and localized storage/retry feedback appears
- **AND** completed sign-out, cleanup, and server revocation are not claimed
