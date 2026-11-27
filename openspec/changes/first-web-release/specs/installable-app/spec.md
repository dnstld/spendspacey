# Installable app delta

## ADDED Requirements

### Requirement: Finance release installation and reconnect acceptance

The production finance release SHALL be verified on its canonical origin and support standalone launch and reconnect recovery in Brazilian Portuguese. The release SHALL be available before the user's manual acceptance review.

#### Scenario: User reviews the deployed release
- **WHEN** the user opens the updated installed app with an existing session, loses connectivity, and then reconnects
- **THEN** the signed-in experience remains available with localized offline guidance and resumes ordinary API access on reconnect
- **AND** confirmation of release behavior is recorded separately from the historical shell acceptance

### Requirement: Online preparation enables offline launch in Brazilian Portuguese

The application SHALL make the complete static shell available offline after successful online precaching. Offline readiness SHALL be reported only after required assets are stored and the worker can serve subsequent launches.

#### Scenario: Offline reload after readiness

- **WHEN** a successful online visit reaches offline readiness and connectivity is then lost
- **THEN** refreshing `/` loads the complete application shell without network access
- **AND** opening a new application page in the same prepared browser storage context also works offline

#### Scenario: Brazilian Portuguese and required chunks are ready

- **WHEN** a prepared application launches offline
- **THEN** its required JavaScript chunks, styles, local font, and Google button image are available
- **AND** Brazilian Portuguese works without fetching translations
- **AND** the document language is Brazilian Portuguese regardless of device preferences

#### Scenario: First-ever offline launch or evicted assets

- **WHEN** the browser context has never completed online preparation or required assets have been evicted
- **THEN** the application makes no successful offline-launch claim and instructs users to reconnect where application code can run
- **AND** first-ever launch can produce a browser-owned network error rather than an application screen

## MODIFIED Requirements

### Requirement: Startup access failures are retryable without weakening validation

The worker SHALL distinguish immutable build/configuration failure, retryable storage-access rejection and invalid durable state at their failure sources. Retryable failure SHALL confer no authority until complete successful validation. Established metadata loss, structural corruption, unsupported formats/namespaces, incompatible configuration and forked lineage SHALL remain fail-closed without reconstruction or safety-state reset.

#### Scenario: Shared bounded validation survives transient access failure
- **WHEN** startup or ownership revalidation encounters a rejected storage operation
- **THEN** share one flight per global under the existing exclusive writer lock, allow two failed attempts per burst, and permit a later eligible event after a five-second cooldown
- **AND** retry no failed flight recursively or in the background, multiply no attempt per concurrent resource, and initiate no repair/reload
- **AND** retain ledger observation, epochs, bindings, repair/spent history and cleanup seals across attempts

#### Scenario: Validation hangs or settles late
- **WHEN** a flight exceeds its two-second caller deadline
- **THEN** return neutral unavailable recovery while retaining the original flight and writer lock until settlement
- **AND** no concurrent or late continuation publishes authority or unfenced writes; stale deadline callbacks cannot alter completed flights
- **AND** a later complete validation resolves uncertain writes without duplicate activation/publication or replay

#### Scenario: Truthful recovery and preparation
- **WHEN** state cannot temporarily be accessed/validated, durable validation fails, or resources are positively missing/corrupt
- **THEN** show distinct Brazilian Portuguese guidance without a generally reliable reopen remedy; unauthorized recovery repair remains disabled
- **AND** uncontrolled network documents remain unconfirmed and cannot report bound/offline-ready; delivery still requires the exact browser-issued identity and joint persisted/read-back verified binding
- **AND** recovery retains its restrictive CSP, zero Auth SDK execution and private-data boundaries; no network HTML fallback bypasses controlled delivery

#### Scenario: Representative cold-launch availability
- **WHEN** disposable tests execute unbound recovery, one reload still in recovery, full close/reopen into application, then another cold reopen with one transient startup read rejection
- **THEN** the corrected implementation must display a working application with healthy retained state in Brazilian Portuguese, preserving owner epoch, selection and old bindings
- **AND** regression evidence distinguishes pre-correction failure from corrected availability without claiming physical iPhone acceptance or its hidden trigger

## REMOVED Requirements

### Requirement: Completed online preparation enables offline launch
**Reason**: The earlier shell requirement covers two application languages.
**Migration**: Use the Brazilian Portuguese offline launch requirement, which preserves the precache, reload, and recovery expectations.
