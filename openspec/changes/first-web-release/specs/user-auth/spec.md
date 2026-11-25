# User auth delta

## MODIFIED Requirements

### Requirement: Minimal authentication views

The application SHALL show Spendspacey identity and Google sign-in when signed out. When signed in, it SHALL open the financial workspace and provide current-session sign-out and applicable authentication, connection, installation, and update feedback.

#### Scenario: Signed-out entry
- **WHEN** session initialization completes without a session
- **THEN** the signed-out view shows Spendspacey identity and Google sign-in
- **AND** private expense data and other sign-in methods are absent
- **AND** necessary PWA and connection feedback can appear

#### Scenario: Signed-in entry
- **WHEN** an existing account restores or completes an authorized session
- **THEN** the application opens Transações with the authenticated workspace
- **AND** provides localized current-session sign-out and conceals the sign-in button

#### Scenario: Incomplete identity information
- **WHEN** a displayed member identity field is missing or the avatar fails to load
- **THEN** the screen remains usable with an accessible localized fallback
- **AND** user-supplied identity text is rendered as text rather than executable markup

### Requirement: Sign-out affects the current session

Sign-out SHALL end the current authentication session without requesting sign-out of independent sessions on other devices. It SHALL report failures without claiming success.

#### Scenario: Successful current-session sign-out
- **WHEN** the user activates sign-out and the operation succeeds
- **THEN** the signed-out view appears and remains signed out after reload
- **AND** independent sessions on other devices are not revoked

#### Scenario: Sign-out fails
- **WHEN** sign-out returns a network or service error
- **THEN** the application displays a localized retry action and follows the authentication service's actual session state

#### Scenario: Session ends elsewhere in the same browser
- **WHEN** the application receives notice that its current session ended in another tab
- **THEN** its authenticated identity is removed and the signed-out view appears

### Requirement: Authentication controls are accessible

The shell SHALL provide keyboard-operable controls, accessible control names, visible focus, announced loading/error feedback, and usable layouts at narrow and wide viewport sizes.

#### Scenario: Keyboard and narrow viewport operation
- **WHEN** a user navigates the shell by keyboard at a narrow viewport
- **THEN** authentication actions remain visible, focusable, and usable without horizontal overflow
- **AND** status and error feedback is available to assistive technology

### Requirement: Fresh authentication requires connectivity

Fresh Google sign-in and current-session sign-out SHALL require connectivity. Offline feedback SHALL be localized and recoverable. Reconnection SHALL NOT automatically start OAuth, code exchange, or sign-out, and browser connectivity indicators SHALL be treated as hints rather than proof that Auth is reachable.

#### Scenario: Authentication action requested offline
- **WHEN** the shell is known to be offline
- **THEN** sign-in/sign-out actions explain the connection requirement without claiming success, queuing operations, or knowingly navigating into unavailable OAuth
- **AND** explicit connection retry remains possible

#### Scenario: Reported online connection cannot reach Auth
- **WHEN** the browser reports connectivity but an authentication request fails
- **THEN** localized failure/retry feedback follows actual SDK session state
- **AND** cleared local state is not represented as confirmed server revocation and no operation is automatically replayed

### Requirement: Offline shell launch does not require completed authentication

The localized static shell SHALL remain usable when session restoration needs unavailable network access. The application SHALL give bounded connection/retry feedback rather than an indefinite blocking spinner, without treating restoration failure as confirmed sign-out or copying SDK identity into a new offline store.

#### Scenario: Expired or unavailable session on offline launch
- **WHEN** a prepared shell reloads offline and SDK restoration/refresh cannot complete
- **THEN** the user can see the Brazilian Portuguese shell with reconnect guidance
- **AND** prior SDK session evidence keeps the workspace in a reconnect state rather than forcing sign-out
- **AND** no fresh authentication, durable profile or finance data, or current server verification is claimed
- **AND** later SDK results still obey existing ordering and cleanup rules

#### Scenario: Independent recovery has no authentication authority
- **WHEN** the worker serves embedded canonical recovery
- **THEN** it does not import/execute Auth, inspect SDK storage or make Auth/API requests
- **AND** callback clones require their own committed generation binding, retain no-store/no-referrer and fail closed without a verified document; no callback cleanup is claimed without application execution

#### Scenario: Existing callback route forms execute cleanup with document ownership
- **WHEN** a controlled navigation matches the application's existing case-insensitive, trailing-slash or encoded-segment callback route
- **THEN** a verified selected canonical document clone receives its own committed binding before delivery, retaining no-store/no-referrer and application-owned URL cleanup
- **AND** no callback URL, query, fragment or sensitive input enters metadata, cache keys, logs or generated artifacts; unrecognized paths receive no worker fallback
