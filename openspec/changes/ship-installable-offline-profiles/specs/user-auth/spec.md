> **Superseded planning record — 2026-10-17.** Do not implement or synchronize this historical artifact. Follow the four replacements and current-user-only correction in [the supersession map](../../proposal.md). Original content and task completion state are preserved unchanged below.

>
> **PM decisions — 2026-10-18:** Follow the supersession map above for Cloudflare Pages Free, accepted `main` production delivery, exact Auth configuration with signups disabled, restricted previews, and read-only current-user `/profiles` with separate offline snapshot storage. Historical Vercel, missing-asset-404, and profile-directory directions below are superseded; no Supabase/OAuth/callback/token/profile network response may be runtime-cached by the service worker. The original body remains unchanged.

>
> **Resolved PM scope and device acceptance — 2026-10-18:** Follow the supersession map above: `/profiles` is Supabase `public.profiles`/Data API, displayed on existing `/`, with no `/profiles` application route. Manual PWA acceptance is iPhone/Google Chrome Share → Add to Home Screen, Spendspacey name/icon, standalone Home Screen launch, phase-specific installed-app online/offline checks, and recorded iOS/Chrome versions. Offline profiles require successful authenticated online load/commit, complete close, connectivity removal, and reopen/reload showing only that user's cached profile. Desktop Chromium cannot replace PM evidence. Safari-specific manual acceptance is not required; use standards/feature detection without browser detection. Cloudflare/GitHub access and assigned hostname are execution prerequisites. Original body preserved below.

# Spec Delta

## MODIFIED Requirements

### Requirement: Minimal authentication views

The application SHALL show Spendspacey identity, language selection, and Google sign-in when signed out. The signed-in root SHALL show Google identity, language selection, sign-out, and the read-only authorized profiles view. Necessary authentication, offline, persistence, installation, and update feedback SHALL be allowed. No expense content, dashboard, editable profile, or extra login method SHALL be introduced.

#### Scenario: Signed-out entry
- **WHEN** session initialization completes without a session or eligible offline snapshot
- **THEN** the signed-out view shows Spendspacey identity, language selection, and Google sign-in
- **AND** it shows no expense content, dashboard, editable profile, or other login method
- **AND** private profiles are absent while necessary installation or connection feedback can appear

#### Scenario: Signed-in entry
- **WHEN** a session exists with Google identity information
- **THEN** the screen shows that user's name, email, avatar, language selection, sign-out, and the authorized read-only profiles view
- **AND** the sign-in button and unrelated application content are absent

#### Scenario: Incomplete identity information
- **WHEN** an identity field is missing or the avatar fails to load
- **THEN** the screen remains usable with a localized missing-field label or avatar fallback
- **AND** user-supplied identity text is rendered as text rather than executable markup

#### Scenario: Saved profiles are viewable without verified authentication
- **WHEN** a prepared application has an eligible saved profile snapshot but cannot restore or refresh authentication offline
- **THEN** it shows a clearly labeled read-only saved-profiles view and language selection
- **AND** it does not invent a current authenticated identity, copy Auth email into the snapshot, or enable online-only authentication actions

### Requirement: Callback completion and recovery

The callback SHALL consume a valid authorization code at most once per page runtime, establish the returned session, and replace the callback URL with `/` on success. Callback failures SHALL offer localized recovery without exposing raw provider messages or authentication parameters. An offline callback SHALL NOT persist or automatically replay an authorization code.

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
- **WHEN** `/auth/callback` opens without connectivity after static-shell preparation
- **THEN** the generic cached shell can show localized connection/recovery feedback and scrub callback query parameters and fragments
- **AND** the application does not start a known-offline exchange, persist the code, or replay it on reconnection
- **AND** returning to the root does not erase an otherwise eligible prior profile snapshot or valid session merely because the callback failed

### Requirement: Session restoration is ordered with authentication changes

The application SHALL distinguish pending restoration, current authentication, confirmed sign-out, and unavailable verification. It SHALL reflect authentication changes and prevent older asynchronous results from overwriting newer state. A matching saved profile snapshot SHALL support explicitly unverified offline viewing when restoration needs unavailable network access, without treating that snapshot as authentication.

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
- **THEN** the application shows localized recovery rather than treating the error as proof of sign-out
- **AND** an eligible saved profile snapshot remains available only in the explicitly unverified offline mode

#### Scenario: Expired session on offline refresh
- **WHEN** a prepared application reloads offline and its SDK access token has expired
- **THEN** the shell and eligible saved profiles remain usable without waiting indefinitely for token refresh
- **AND** online requests remain gated by actual SDK authentication rather than the saved-profile owner marker

#### Scenario: A server rejects restored access
- **WHEN** online authentication or profiles authorization is rejected
- **THEN** local profile access is invalidated and appropriate sign-in/recovery feedback appears
- **AND** an earlier successful read cannot revive that invalidated access

### Requirement: Sign-out affects the current session

Sign-out SHALL end the current authentication session without requesting sign-out of independent sessions on other devices. It SHALL preserve explicit language preference, invalidate private profile snapshots before the SDK attempt, and report failures according to actual session state. Connectivity SHALL be required to start sign-out; local private-data cleanup SHALL NOT be represented as confirmed server revocation.

#### Scenario: Successful current-session sign-out
- **WHEN** the user activates sign-out with connectivity and the operation succeeds
- **THEN** the signed-out view appears and remains signed out after reload
- **AND** the explicit language choice remains selected
- **AND** independent sessions on other devices are not revoked
- **AND** previous profiles are absent after an offline reload while the static shell still launches

#### Scenario: Sign-out fails
- **WHEN** sign-out returns a network or service error
- **THEN** the application displays localized retry feedback and follows the authentication service's actual session state
- **AND** it distinguishes cleared local state from unconfirmed server revocation where applicable
- **AND** it does not automatically restore invalidated profile snapshots or replay sign-out on reconnection

#### Scenario: Session ends elsewhere in the same browser
- **WHEN** the application receives notice that its current session ended in another tab
- **THEN** its authenticated identity and private profiles are removed and the signed-out view appears
- **AND** older asynchronous reads or snapshot writes cannot undo that change

#### Scenario: Sign-out requested while offline
- **WHEN** the application is known to be offline
- **THEN** it explains that connection is required to sign out and does not claim sign-out or server revocation
- **AND** it permits connection retry without erasing the selected language

#### Scenario: Private snapshot invalidation cannot be persisted
- **WHEN** the application cannot establish a durable snapshot invalidation or deletion boundary before sign-out
- **THEN** it aborts the SDK sign-out attempt, hides private profiles in the current page, and reports a localized storage/retry error
- **AND** it does not claim completed sign-out or cleanup

## ADDED Requirements

### Requirement: Fresh authentication requires connectivity

Fresh Google sign-in SHALL require connectivity. Offline feedback SHALL be recoverable and localized, and returning online SHALL NOT initiate OAuth automatically. Browser connectivity indicators SHALL be treated as hints rather than proof that the authentication service is reachable.

#### Scenario: Sign-in requested offline
- **WHEN** a signed-out user tries to sign in without connectivity
- **THEN** the application shows connection guidance without knowingly navigating away into an unavailable OAuth flow
- **AND** the user can retry once a connection is available

#### Scenario: Reported online connection cannot reach Auth
- **WHEN** the browser reports connectivity but the authentication service cannot be reached
- **THEN** localized failure/retry feedback appears without inventing a session
- **AND** no credentials, codes, or authentication operations are queued for later replay
