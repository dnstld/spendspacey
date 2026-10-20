# Spec Delta

## MODIFIED Requirements

### Requirement: Minimal authentication views

The application SHALL show Spendspacey identity, language selection, and Google sign-in when signed out. When signed in, it SHALL show only Google name, email, avatar, language selection, and sign-out, plus necessary authentication, connection, installation, and update feedback. No expense content, dashboard, editable profile, extra login method, or application profile query SHALL be introduced by the shell.

#### Scenario: Signed-out entry
- **WHEN** session initialization completes without a session
- **THEN** the signed-out view shows Spendspacey identity, language selection, and Google sign-in
- **AND** it shows no expense content, dashboard, editable profile, or other login method
- **AND** necessary PWA and connection feedback can appear

#### Scenario: Signed-in entry
- **WHEN** a session exists with Google identity information
- **THEN** the screen shows that user's name, email, avatar, language selection, and sign-out
- **AND** the sign-in button and unrelated application content are absent

#### Scenario: Incomplete identity information
- **WHEN** an identity field is missing or the avatar fails to load
- **THEN** the screen remains usable with a localized missing-field label or avatar fallback
- **AND** user-supplied identity text is rendered as text rather than executable markup

### Requirement: Callback completion and recovery

The callback SHALL consume a valid authorization code at most once per page runtime, establish the returned session, and replace the callback URL with `/` on success. Callback failures SHALL offer localized recovery without exposing raw provider messages or authentication parameters. Offline callback handling SHALL NOT persist or automatically replay a code.

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

#### Scenario: Controlled offline callback navigation
- **WHEN** `/auth/callback` opens offline after static preparation
- **THEN** the generic shell shows localized connection/recovery feedback and scrubs query parameters and fragments
- **AND** a known-offline exchange is not started and the code is neither persisted nor replayed after reconnecting
- **AND** callback failure alone does not erase an otherwise valid existing SDK session

## ADDED Requirements

### Requirement: Fresh authentication requires connectivity

Fresh Google sign-in and current-session sign-out SHALL require connectivity. Offline feedback SHALL be localized and recoverable. Reconnection SHALL NOT automatically start OAuth, code exchange, or sign-out, and browser connectivity indicators SHALL be treated as hints rather than proof that Auth is reachable.

#### Scenario: Authentication action requested offline
- **WHEN** the shell is known to be offline
- **THEN** sign-in/sign-out actions explain the connection requirement without claiming success, queuing operations, or knowingly navigating into unavailable OAuth
- **AND** explicit connection retry remains possible and language choice is preserved

#### Scenario: Reported online connection cannot reach Auth
- **WHEN** the browser reports connectivity but an authentication request fails
- **THEN** localized failure/retry feedback follows actual SDK session state
- **AND** cleared local state is not represented as confirmed server revocation and no operation is automatically replayed

### Requirement: Offline shell launch does not require completed authentication

The localized static shell and language selector SHALL remain usable when session restoration needs unavailable network access. The application SHALL give bounded connection/retry feedback rather than an indefinite blocking spinner, without treating restoration failure as confirmed sign-out or copying SDK identity into a new offline store.

#### Scenario: Expired or unavailable session on offline launch
- **WHEN** a prepared shell reloads offline and SDK restoration/refresh cannot complete
- **THEN** the user can see the shell and change language while receiving reconnect guidance
- **AND** no fresh authentication, durable profile availability, or current server verification is claimed
- **AND** later SDK results still obey existing ordering and cleanup rules

#### Scenario: Independent recovery has no authentication authority
- **WHEN** the worker serves embedded canonical recovery
- **THEN** it does not import/execute Auth, inspect SDK storage or make Auth/API requests
- **AND** callback clones require their own committed generation binding, retain no-store/no-referrer and fail closed without a verified document; no callback cleanup is claimed without application execution

#### Scenario: Existing callback route forms execute cleanup with document ownership
- **WHEN** a controlled navigation matches the application's existing case-insensitive, trailing-slash or encoded-segment callback route
- **THEN** a verified selected canonical document clone receives its own committed binding before delivery, retaining no-store/no-referrer and application-owned URL cleanup
- **AND** no callback URL, query, fragment or sensitive input enters metadata, cache keys, logs or generated artifacts; unrecognized paths receive no worker fallback
