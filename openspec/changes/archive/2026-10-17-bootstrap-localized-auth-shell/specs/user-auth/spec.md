# Spec Delta

## Purpose

Let a user enter and leave Spendspacey through Google authentication, restore an existing session, and see a minimal identity screen with clear recovery from authentication failures.

## ADDED Requirements

### Requirement: Minimal authentication views

The application SHALL show Spendspacey identity, a language selector, and a Google sign-in button when signed out. When signed in, it SHALL show only the user's Google name, email, avatar, language selector, and sign-out button, plus necessary loading and error feedback.

#### Scenario: Signed-out entry
- **WHEN** session initialization completes without a session
- **THEN** the signed-out view shows Spendspacey identity, language selection, and Google sign-in
- **AND** it shows no expense content, dashboard, editable profile, or other login method

#### Scenario: Signed-in entry
- **WHEN** a session exists with Google identity information
- **THEN** the screen shows that user's name, email, avatar, language selection, and sign-out
- **AND** the sign-in button and unrelated application content are absent

#### Scenario: Incomplete identity information
- **WHEN** an identity field is missing or the avatar fails to load
- **THEN** the screen remains usable with a localized missing-field label or avatar fallback
- **AND** user-supplied identity text is rendered as text rather than executable markup

### Requirement: Google sign-in uses the development callback

Google sign-in SHALL use a full-page authorization-code flow with PKCE. The manual development flow SHALL return to exactly `http://localhost:5173/auth/callback`. Only basic name, email, and profile access SHALL be requested.

#### Scenario: Begin sign-in
- **WHEN** the signed-out user activates Google sign-in at `http://localhost:5173`
- **THEN** authorization starts through the configured development authentication service with the exact application callback
- **AND** the sign-in action prevents repeated activation while navigation is pending

#### Scenario: Sign-in cannot start
- **WHEN** the authorization request fails before navigation
- **THEN** a localized error allows the user to retry
- **AND** the application does not report successful authentication

### Requirement: Callback completion and recovery

The callback SHALL consume a valid authorization code at most once per page runtime, establish the returned session, and replace the callback URL with `/` on success. Callback failures SHALL offer localized recovery without exposing raw provider messages or authentication parameters.

#### Scenario: Successful callback
- **WHEN** the callback receives a valid code and matching browser verifier
- **THEN** one code exchange establishes the session and the authenticated root view appears
- **AND** callback query parameters and fragments are absent from the resulting URL and completed history entry

#### Scenario: Callback handling is mounted twice
- **WHEN** the same callback is processed again during a development remount
- **THEN** the handlers share the pending or completed exchange rather than consuming the code twice

#### Scenario: Provider cancellation or invalid callback
- **WHEN** the provider returns an error in the query or fragment, the code is missing, expired or reused, or the verifier is unavailable
- **THEN** the callback shows localized recovery with a fresh sign-in or return action
- **AND** authentication parameters are removed from the URL and no successful sign-in is invented

#### Scenario: Exchange network failure
- **WHEN** the exchange fails because the authentication service cannot be reached
- **THEN** the callback exits its pending state with a localized recovery action
- **AND** it does not automatically retry a potentially consumed code

### Requirement: Session restoration is ordered with authentication changes

The application SHALL keep an initialization state until session restoration resolves, reflect subsequent authentication changes, and prevent older asynchronous results from overwriting newer session state. Failure to restore SHALL be distinguishable from a confirmed signed-out state.

#### Scenario: Restore a stored session
- **WHEN** the application launches with a restorable session
- **THEN** it shows initialization feedback followed by that user's authenticated view
- **AND** it does not flash the signed-out sign-in button during restoration

#### Scenario: Newer event wins over restoration
- **WHEN** sign-in or sign-out occurs while an older restoration request is pending
- **THEN** completion of that older request does not reverse the newer state

#### Scenario: Refresh or identity update
- **WHEN** the authentication service reports a refreshed session or updated user information
- **THEN** the displayed identity and active session reflect the latest information
- **AND** repeated sign-in notifications do not trigger navigation loops

#### Scenario: Restoration fails
- **WHEN** session restoration returns an error
- **THEN** the application shows a localized retry state rather than treating the error as proof of sign-out

### Requirement: Sign-out affects the current session

Sign-out SHALL end the current authentication session without requesting sign-out of independent sessions on other devices. It SHALL preserve the explicit language preference and report failures without claiming success.

#### Scenario: Successful current-session sign-out
- **WHEN** the user activates sign-out and the operation succeeds
- **THEN** the signed-out view appears and remains signed out after reload
- **AND** the explicit language choice remains selected
- **AND** independent sessions on other devices are not revoked

#### Scenario: Sign-out fails
- **WHEN** sign-out returns a network or service error
- **THEN** the application displays a localized retry action and follows the authentication service's actual session state

#### Scenario: Session ends elsewhere in the same browser
- **WHEN** the application receives notice that its current session ended in another tab
- **THEN** its authenticated identity is removed and the signed-out view appears

### Requirement: Public configuration is validated safely

The application SHALL require only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as application environment inputs. Invalid configuration SHALL fail development startup and production build, and prevent browser authentication initialization without disclosing configuration values.

#### Scenario: Missing or invalid public configuration
- **WHEN** either required value is absent, the URL is invalid, or the key is not a publishable key
- **THEN** startup/build validation identifies the invalid variable names without printing values
- **AND** browser bootstrap, if reached with invalid configuration, provides localized configuration-error feedback without starting authentication

#### Scenario: Configuration is safe for the browser
- **WHEN** a build is inspected
- **THEN** it contains no Google client secret, Supabase secret/service-role key, database password, or real session token
- **AND** application authentication uses only the validated public URL and publishable key

### Requirement: Initial PM enrollment precedes signup restriction

The development environment SHALL keep Supabase **Allow new users to sign up** enabled until the PM's first Google authentication succeeds and the PM identity is confirmed in Auth. The Auth inventory SHALL be reviewed before signups are disabled. Unexpected identities SHALL stop setup for PM resolution without automatic deletion.

#### Scenario: First Google authentication enrolls the PM
- **WHEN** the PM identity does not yet exist and the PM begins initial setup
- **THEN** new signups remain enabled until the PM successfully completes Google authentication
- **AND** the PM identity is confirmed in Supabase Auth and the inventory is checked for unexpected identities
- **AND** signups are disabled only after that confirmation and resolution of any inventory findings

#### Scenario: Unexpected identities require PM resolution
- **WHEN** the Auth inventory contains an unexpected identity during enrollment review
- **THEN** setup and acceptance stop for PM resolution before signup restriction proceeds
- **AND** no unexpected identity is deleted or altered automatically
- **AND** work resumes only after the PM resolves the finding and confirms the expected inventory

### Requirement: Enrollment recovery preserves initial PM access

If initial enrollment fails before the PM identity exists, signups SHALL remain enabled during OAuth correction. If disabled prematurely, signups SHALL be temporarily re-enabled to enroll and confirm the PM before being disabled again. Recovery SHALL never leave the signup setting preventing the PM's initial enrollment.

#### Scenario: Initial enrollment fails without creating the PM identity
- **WHEN** the first Google authentication fails and the PM identity is absent from Supabase Auth
- **THEN** signups stay enabled while OAuth configuration is corrected
- **AND** they are disabled only after successful PM authentication, identity confirmation, and resolved inventory review

#### Scenario: Signups were disabled before the PM was enrolled
- **WHEN** signups are disabled but the PM identity does not exist in Supabase Auth
- **THEN** signups are temporarily re-enabled so initial enrollment is not blocked
- **AND** the PM completes Google authentication and the identity is confirmed in Auth
- **AND** the inventory is reviewed, unexpected identities are referred to the PM without automatic deletion, and signups are disabled again only after the review is resolved

### Requirement: Development access is restricted to the project manager

The Phase 1 environment SHALL use a development Auth project, retain Google testing mode, and restrict access to the confirmed PM identity. Disabled signups and a PM-only Auth inventory SHALL be operational restriction evidence. Final PM application acceptance SHALL require only existing-identity sign-in/sign-out and confirmation of the two minimal screens. A second identity or production deployment SHALL NOT be required.

#### Scenario: Restricted environment is ready for acceptance
- **WHEN** the PM reviews the development provider configuration after successful initial enrollment and resolved inventory review
- **THEN** Google remains in testing mode with the PM as its only configured test user
- **AND** the development Auth inventory contains only the PM's enrolled Google identity and new signups are disabled
- **AND** the exact application callback is `http://localhost:5173/auth/callback`
- **AND** the disabled-signup setting and PM-only inventory are accepted as operational evidence that new identities cannot enroll, without a second-account authentication test

#### Scenario: PM sign-in and sign-out smoke with signups disabled
- **WHEN** the enrolled PM performs the final manual application smoke with signups disabled
- **THEN** the PM signs in with the existing Google identity and confirms that the minimal authenticated identity screen appears
- **AND** the PM signs out and confirms that the signed-out Google-login screen appears
- **AND** signups remain disabled throughout; no other manual application behavior or second Google identity is required

#### Scenario: Unknown-user rejection is handled in automated tests
- **WHEN** an automated test supplies a signup-disabled authentication rejection for a synthetic unknown identity to a signed-out application
- **THEN** the application displays localized recovery feedback without inventing an authenticated session
- **AND** the test requires no real Google identity, while configuration inspection supplies the operational enrollment-restriction evidence

### Requirement: Authentication controls are accessible

The shell SHALL provide keyboard-operable controls, accessible control names, visible focus, announced loading/error feedback, and usable layouts at narrow and wide viewport sizes.

#### Scenario: Keyboard and narrow viewport operation
- **WHEN** a user navigates the shell by keyboard at a narrow viewport
- **THEN** language and authentication actions remain visible, focusable, and usable without horizontal overflow
- **AND** status and error feedback is available to assistive technology
