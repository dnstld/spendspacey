# Spec Delta

## Purpose

Let users install Spendspacey on a phone and reopen its localized application shell without connectivity after a completed online preparation, with safe static caching and predictable updates.

## ADDED Requirements

### Requirement: Stable mobile application identity

The application SHALL expose a valid linked manifest with stable identity, root start URL and scope, Spendspacey name, standalone display, matching theme/background colors, and usable application icons. The installation identity SHALL be independent of account, language, and authentication URLs. Installation behavior SHALL use standards and feature detection without browser or user-agent detection.

#### Scenario: Installable manifest and icons
- **WHEN** the production build is inspected in a supporting browser
- **THEN** its manifest has a stable `id`, `start_url: "/"`, `scope: "/"`, `name` and `short_name` of `Spendspacey`, and `display: "standalone"`
- **AND** it declares valid 192x192 and 512x512 PNG icons and a maskable icon with safe padding, with no preferred related native application
- **AND** an Apple touch icon and appropriate mobile title, theme, and viewport metadata are present

#### Scenario: Installed mobile presentation
- **WHEN** the PM launches the application installed through Chrome from the iPhone Home Screen
- **THEN** it opens the root shell as a standalone web app with the Spendspacey name and intended icon, rather than an ordinary browser bookmark/tab
- **AND** controls remain usable around device safe areas, at narrow widths, and with zoom available

### Requirement: Completed online preparation enables offline launch

The application SHALL make the complete static shell available offline after successful online precaching. Offline readiness SHALL be reported only after required assets are stored and the worker can serve subsequent launches.

#### Scenario: Offline reload after readiness
- **WHEN** a successful online visit reaches offline readiness and connectivity is then lost
- **THEN** refreshing `/` loads the complete application shell without network access
- **AND** opening a new application page in the same prepared browser storage context also works offline

#### Scenario: Both languages and required chunks are ready
- **WHEN** a prepared application launches offline
- **THEN** its required JavaScript chunks, styles, local font, and Google button image are available
- **AND** English and Brazilian Portuguese work without fetching translations
- **AND** explicit preference, device-language resolution, English fallback, and document-language behavior follow the existing localization specification

#### Scenario: First-ever offline launch or evicted assets
- **WHEN** the browser context has never completed online preparation or required assets have been evicted
- **THEN** the application makes no successful offline-launch claim and instructs users to reconnect where application code can run
- **AND** first-ever launch can produce a browser-owned network error rather than an application screen

### Requirement: Service-worker caches contain static assets only

The service worker SHALL store only reviewed same-origin static build assets and strictly bounded reserved static-generation metadata. It SHALL NOT store API responses, OAuth traffic, callback responses, avatars or other user information, authentication parameters, tokens, credentials, or non-GET requests. No private application data snapshot SHALL be introduced by this change.

#### Scenario: Sensitive traffic is excluded
- **WHEN** sign-in, callback handling, session refresh, avatar loading, and sign-out have occurred
- **THEN** inspecting every service-worker cache shows only approved static assets and bounded reserved static-generation metadata
- **AND** no Supabase request or callback navigation URL is used as a cache key, and no API/profile response, synthetic private identity value, or authentication secret is stored
- **AND** the public Supabase origin and publishable key embedded in ordinary static application code are not treated as private response data
- **AND** requests with authorization headers and arbitrary query-string variants cannot enter static caching

#### Scenario: Controlled callback receives only the generic shell
- **WHEN** an installed worker handles navigation to `/auth/callback` with query parameters or a fragment
- **THEN** it can return the generic precached application entry document without storing the navigation URL or a callback network response
- **AND** the application retains ownership of parsing, scrubbing, and recovering from the callback

### Requirement: Worker updates preserve a complete working shell

New application versions SHALL wait for safe activation without forcing a page reload. Update status SHALL be localized, and the old complete version SHALL remain usable if installation of the replacement fails.

#### Scenario: A replacement is ready
- **WHEN** a new worker finishes preparing a complete replacement while application windows remain open
- **THEN** the application announces that an update is ready and explains reopening after normal worker activation; a reload may adopt repaired files once the corrected worker is active
- **AND** it does not automatically activate the replacement or reload a callback or authentication operation

#### Scenario: Replacement activates
- **WHEN** the replacement has normally activated and a new eligible document navigates
- **THEN** the next launch uses the complete replacement and also works offline
- **AND** explicit language preference and normal SDK session storage remain available

#### Scenario: Update download fails
- **WHEN** required replacement assets cannot be fetched
- **THEN** the prior complete worker and shell remain usable
- **AND** the application does not report the failed replacement as ready

### Requirement: Static cache versions and recovery are bounded

Static caches SHALL have application-specific ownership and revisioning, conservatively remove obsolete generations only after independent selected/fallback validation and ownership checks, and provide bounded online recovery from missing assets. Static-cache repair SHALL preserve authentication storage, language preference, and unrelated local data. Reserved metadata SHALL contain only bounded static descriptors and lifecycle records, never network responses or private application data.

#### Scenario: Obsolete assets are removed
- **WHEN** a complete selected generation and compatible rollback fallback are independently validated and no clients or in-flight work may require older generations
- **THEN** obsolete historically selected resource caches may be removed without deleting unrelated origin caches or application data
- **AND** uncertainty defers cleanup; legacy caches without trustworthy metadata are not migrated or selected; explicit validated v2 imports use new-owned storage and preserve repair history
- **AND** cache-policy schema changes have an explicit version boundary

#### Scenario: A required chunk is missing
- **WHEN** a cached chunk is missing or mismatched and the application can show recovery
- **THEN** the user receives localized reconnect/reload guidance
- **AND** online repair is limited so it cannot create an automatic reload loop
- **AND** an offline failure does not erase remaining caches or claim successful repair

#### Scenario: Worker registration is unavailable
- **WHEN** service workers or cache storage cannot be used
- **THEN** ordinary online authentication remains usable
- **AND** the application does not claim offline readiness

### Requirement: Hosted worker files remain updateable

The actual stable worker URL and manifest SHALL have correct content types and revalidation rather than immutable caching. Root worker scope and native Pages SPA fallback SHALL remain available. Fallback HTML SHALL NOT be accepted as a valid worker or required asset. Static security headers SHALL permit the browser worker without adding Cloudflare runtime products or private-data caching.

#### Scenario: Installed files are checked on the existing host
- **WHEN** the worker, manifest, icons, and required scripts are fetched from the predecessor's production Pages origin
- **THEN** the expected files have the correct types, worker/manifest responses revalidate, and the worker controls the root scope
- **AND** every required deployed file matches the expected content/type; unknown missing paths may use native SPA fallback, but HTML cannot satisfy a worker/chunk check
- **AND** no top-level `404.html` or catch-all rewrite replaces native fallback and direct `/auth/callback` still reaches the app
- **AND** callback document delivery remains no-store/no-referrer, including a generic worker-served clone

### Requirement: Real-phone installation completes the shell milestone

Completion SHALL require manual PM installation from Chrome on an iPhone and standalone Home Screen online/offline acceptance, recording tested iOS and Chrome versions. Desktop Chromium automation SHALL NOT replace this evidence. Safari-specific manual acceptance SHALL NOT be required. No profile query or private snapshot SHALL be needed for this milestone.

#### Scenario: PM installs and launches offline
- **WHEN** automated checks pass and accepted changes merged into `main` are published at the existing production Pages URL
- **THEN** the PM opens that URL in Google Chrome on the iPhone, uses Chrome's Share menu → Add to Home Screen, confirms the Spendspacey name/intended icon, and launches from the Home Screen
- **AND** it opens as a standalone web app rather than an ordinary browser bookmark/tab
- **AND** from the installed app the PM completes online sign-in/identity/sign-out checks, waits for static readiness, then tests an available safe reload control and fully closes/reopens it in airplane mode; unavailable physical reload uses the combined evidence contract below
- **AND** the shell, English/Brazilian Portuguese controls, safe areas, touch controls, and avatar fallbacks remain usable
- **AND** an unavailable session shows reconnect guidance rather than preventing shell launch or claiming fresh authentication

#### Scenario: Phone update and acceptance are recorded
- **WHEN** a compatible accepted production replacement from `main` is available at the same origin
- **THEN** the PM records the waiting notice if observable and verifies the safe close-all-windows/reopen update path in the installed iPhone Home Screen app
- **AND** sanitized iPhone model, tested iOS and Chrome versions, deployed version, production URL, and manual PM pass/fail evidence is recorded without identity values or real-account traces
- **AND** desktop Chromium evidence does not substitute for the actual installed-app online/offline checks; Safari-specific manual acceptance is not required
- **AND** this change remains incomplete until actual installation/offline/update evidence passes

### Requirement: Canonical entry preparation and durable generation selection

The worker SHALL represent emitted `index.html` only as canonical `/`, deriving revision and integrity from emitted bytes and rejecting redirects. First online preparation SHALL completely persist resources, verified completion and committed selection in that order. The next ordinary load SHALL acquire control even offline, without automatic reload.

#### Scenario: Pages canonicalizes index.html
- **WHEN** the host redirects `/index.html` to `/`
- **THEN** the worker prepares canonical `/` without requesting the redirected entry
- **AND** offline next-load control and both locales work after that single online preparation

#### Scenario: New worker starts without a live predecessor
- **WHEN** the worker starts or restarts
- **THEN** it discovers strictly validated metadata only in its reserved namespace and recomputes resource integrity
- **AND** it restores committed selection through deterministic parent-linked lineage, independently of cache enumeration or timestamps
- **AND** its worker identity remains distinct from the selected generation, with policy/configuration digests checked
- **AND** malformed, incompatible, contradictory, unsupported or ambiguous metadata yields unavailable status or deferred cleanup

#### Scenario: Waiting replacement loses a required resource
- **WHEN** a complete waiting replacement becomes incomplete or corrupt before activation
- **THEN** activation independently validates and selects its committed compatible predecessor if usable
- **AND** neither generation is deleted if both are unusable, and resources are never mixed

#### Scenario: Existing windows survive restart and repair
- **WHEN** a worker restarts or repair completes while earlier windows remain open
- **THEN** their immutable browser-client generation binding remains pinned, even when unusable
- **AND** unusable pinned resources produce recovery/unavailable feedback, without switching live windows
- **AND** a new eligible canonical navigation or reload can adopt repaired files while all earlier bindings remain unchanged

#### Scenario: Repair stops or fails
- **WHEN** explicit repair fails, times out, is cancelled, is interrupted or is requested offline
- **THEN** its persisted attempt boundary prevents automatic restart or replay
- **AND** a cancellable deadline bounds exact static requests in separate staging, leaving staging unselected and selected/fallback intact

#### Scenario: Cleanup has uncertain ownership
- **WHEN** controlled, uncontrolled, hidden, unresponsive, newly navigating or unidentifiable windows or cross-worker reservations may require a generation
- **THEN** cleanup defers deletion and includes uncontrolled clients in its assessment
- **AND** selected plus validated rollback fallback is a retention target rather than an unconditional cache limit

#### Scenario: Accepted compatible rollback
- **WHEN** compatible complete versions are selected in the order v1, v2, v1
- **THEN** committed lineage selects the requested whole version and preserves one independently validated rollback fallback
- **AND** SDK/locale storage and unrelated caches remain untouched; production phone acceptance remains separate

#### Scenario: Cross-worker selection is stale
- **WHEN** an older worker attempts activation or mutation after another worker commits a newer selection
- **THEN** the installation's committed-parent boundary and immutable ownership records prevent overwriting the newer selection
- **AND** a genuine compatible rollback requires a fresh installation reservation bound to the current selection

#### Scenario: Metadata and compatibility remain static-only
- **WHEN** metadata is discovered or used during recovery
- **THEN** strict bounded schema, ownership, worker/generation identity, origin/scope, routing/offline/Auth/deployment compatibility, configuration digest, inventory, mappings, MIME, integrity and completion binding are checked
- **AND** cached resource integrity is independently recomputed before use
- **AND** no publishable keys, private configuration, credentials, tokens, sessions or user payloads are persisted in metadata
- **AND** metadata is never fetched from network, routed, repaired or treated as an authentication or durability boundary

### Requirement: Durable document ownership precedes delivery

Every application document, including a callback clone, SHALL have an exact browser-client generation binding committed jointly with any selection change before bytes are released. Persistence SHALL be awaited and independently read back. Subresources SHALL use only their exact binding. Ambiguous ownership SHALL retain references without blocking other valid new documents.

#### Scenario: Delivery is interrupted
- **WHEN** termination occurs at reservation, joint commit, response, handling or confirmation boundaries
- **THEN** startup restores validated lineage and immutable bindings, never guesses successful delivery or closure
- **AND** a never-bound operation can release references only after a durable fence; potentially delivered bindings remain protected

#### Scenario: New document adopts a repaired generation
- **WHEN** a valid browser-issued resulting identity navigates after successful repair
- **THEN** a joint commit selects verified files and binds that incoming document
- **AND** existing/frozen/BFCache documents continue exclusively on their original generation; no optional navigation hints or physical-window closure proof are required

### Requirement: Independent canonical recovery remains reachable

An exact eligible canonical root navigation without a usable application generation SHALL receive a build-verified worker-embedded bilingual recovery document. It SHALL use exact hashed CSP, no-store/no-referrer and no external dependencies or Auth/API activity. Missing binding/metadata SHALL grant guidance only. Callback and unknown paths SHALL never receive it.

#### Scenario: Bootstrap resources are evicted
- **WHEN** canonical HTML, the main bundle or lazy SDK chunk is missing/corrupt online or offline
- **THEN** canonical reload/cold launch displays independent localized recovery without fetching network HTML
- **AND** deliberate bound repair preserves its spent-attempt boundary across restart, reports unknown missing outcomes honestly and never automatically navigates the current document

### Requirement: Cleanup sealing and explicit upgrade preserve ownership

Deletion SHALL require a persisted validated seal excluding every protected reference. Sealed generations SHALL reject all new references. Upgrade SHALL validate actual v2 data, preserve repair history, copy older bytes into new-owned storage and never manufacture legacy bindings.

#### Scenario: Cleanup or import is interrupted
- **WHEN** termination races sealing/deletion/import or a new binding/source reservation
- **THEN** the shared writer boundary prevents reference/deletion conflicts, deletion resumes idempotently and incomplete imports remain unusable
- **AND** ambiguous/legacy references remain protected without quota-based expiry

### Requirement: Repair terminal ordering and durable uncertainty

Repair SHALL preserve the first effective authorized stop decision while undecided, freeze terminal selection before finish persistence, and publish definitive outcomes only from validated persisted finish evidence. Uncertain persistence SHALL remain unknown until independently resolved.

#### Scenario: Cancellation and deadline compete
- **WHEN** authorized cancellation and deadline callbacks compete, including within one scheduling turn
- **THEN** actual execution of the first abort determines cancelled versus timed-out
- **AND** clicks, message arrival and incompletely persisted cancellation do not establish priority
- **AND** a later abort path or stale callback cannot replace the first reason or a frozen decision
- **AND** both abort paths guard an already-aborted signal and a frozen decision; cancellation repeats both checks after authorization append/read-back, immediately before abort
- **AND** classification uses private worker-owned identities through `controller.signal.reason`, never exception names or strings; a persisted cancellation request is not a terminal outcome

#### Scenario: Failure is observed before persistence
- **WHEN** repair enters its catch boundary without a frozen decision
- **THEN** it synchronously freezes cancelled for its cancellation sentinel, timed-out for its deadline sentinel, or failed otherwise, before any awaited operation
- **AND** an unrelated abort-like exception remains failed; ordinary failure priority starts at this observation boundary
- **AND** the deadline is immediately disarmed and cannot change the outcome during snapshot, write, read-back or publication

#### Scenario: Success is selected after completion validation
- **WHEN** staging fill, completion persistence, read-back and lineage validation succeed
- **THEN** the existing writer lock obtains the final pre-finish snapshot and performs the final abort check
- **AND** an authorized abort already effective at that check wins; otherwise complete with the validated completion reference is frozen and the deadline immediately disarmed
- **AND** a deadline during that snapshot may win, but one during finish append/read-back cannot replace selected success

#### Scenario: Finish persistence is uncertain
- **WHEN** selected finish write, read-back or lineage cannot be validated
- **THEN** the immediate repair result is unknown and no replacement outcome is appended, including after selected success
- **AND** later STATUS or restart may validate an existing finish; a missing finish remains unknown even with persisted cancellation evidence
- **AND** the repair lock remains held through settlement and final result determination, hangs retain the lock, and rejected persistence never replenishes the attempt
- **AND** no automatic request starts, partial staging remains unselected, completed staging requires a validated successful finish for adoption, and incomplete-staging retention is unchanged

### Requirement: Activation ownership resumes independently of lifecycle completion

A browser-active worker SHALL resume interrupted ownership independently of activation-handler completion, using native instance authority, exclusive serialization and validated installation lineage. Committed ownership SHALL restore idempotently without reverting selections, bindings or repair history.

#### Scenario: Browser activation survives failed persistence
- **WHEN** activation persistence rejects or termination interrupts write/read-back/local restoration and the browser still activates the replacement
- **THEN** a later functional event in the same or restarted global can reconcile the unique valid transfer without another activate event
- **AND** it independently revalidates candidate and compatible predecessor, retains existing bindings and never mixes generations, repairs automatically or sweeps caches
- **AND** the current parent/head, epoch, unique completed reservation and native active authority are validated before persistence; waiting/stale/superseded/ambiguous/corrupt/forked/incompatible candidates cannot claim ownership
- **AND** repeated write failure remains bounded and unavailable; no unbound recovery document receives invented authority

#### Scenario: Restore committed ownership without inferring installation identity
- **WHEN** native browser-active identity for the expected origin/root scope and the committed same-build owner, epoch, lineage, selection and resources independently validate
- **THEN** resume the existing committed epoch and selection without another activation, reservation consumption/association, staged-resource selection, binding change or repair/adoption reversal
- **AND** one or multiple unrelated same-build installation reservations remain quarantined with protected resources and deferred cleanup; they do not block valid owner restoration
- **AND** build equality proves compatibility only, not worker-instance or registration/reservation identity; no schema/protocol migration or safety-history reset occurs

#### Scenario: Different-owner transfer remains ambiguous
- **WHEN** ownership differs and the current validated lineage has multiple completed eligible pairs, a superseded reservation or no unique completed installation provenance
- **THEN** fail closed without transfer, repair, cleanup or reconstruction from resource bytes
- **AND** waiting, stale, redundant, incompatible, corrupt and forked candidates cannot mutate

#### Scenario: Recovery controller changes or resources remain intact
- **WHEN** the controller is absent, changes or returns a delayed/obsolete/missing reply
- **THEN** recovery validates the current controller with a fresh handshake for deliberate interactions, discards stale correlation and never replays repair/cancellation
- **AND** its bilingual copy does not claim missing/corrupt resources from activation or binding unavailability; repair requires validated recovery-document authority

#### Scenario: Physical lifecycle uses bounded observable evidence
- **WHEN** Task 3.4 is reviewed
- **THEN** the following evidence-source contract applies without reducing the product's lifecycle, integrity or repair guarantees

Physical Task 3.4 covers only PM-observed behavior in the same Home Screen installation: waiting notice if observable, usable existing document, close-all/reopen adoption, online use, complete offline close-all/cold reopen in English and Brazilian Portuguese, and absence of unexpected retry, forced reload or installation loss. Test an available safe normal reload control normally. If none exists, record physical reload as `unavailable/not tested`, never passed; combine bilingual physical offline cold-reopen evidence with the separate mapped automated/browser reload evidence. A waiting notice `not observed` does not alone block acceptance after rendered bilingual notice, waiting-worker and retention evidence pass. A broken notice, forced navigation/reload, unusable UI or lost installation is a failure requiring investigation.

Fault injection, exact generation/controller ownership, repair ordering, failed/offline/successful repair, staging isolation and repaired-file adoption are **not manually executed on the physical iPhone; covered by representative automated/hosted evidence**. The product guarantees remain unchanged; only these subcases' evidence source changes. No phone developer tooling, cache mutation, cookies/tokens/sessions/account-storage inspection, callback inputs, API responses or private-data inspection/export is permitted. Compatible production rollback/restoration require separate explicit authorization and exact release verification outside the phone. Neither deployment nor phone interaction is authorized by this implementation.

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
- **THEN** show distinct exact English/Brazilian Portuguese guidance without a generally reliable reopen remedy; unauthorized recovery repair remains disabled
- **AND** uncontrolled network documents remain unconfirmed and cannot report bound/offline-ready; delivery still requires the exact browser-issued identity and joint persisted/read-back verified binding
- **AND** recovery retains its restrictive CSP, zero Auth SDK execution and private-data boundaries; no network HTML fallback bypasses controlled delivery

#### Scenario: Representative cold-launch availability
- **WHEN** disposable tests execute unbound recovery, one reload still in recovery, full close/reopen into application, locale change, then another cold reopen with one transient startup read rejection
- **THEN** the corrected implementation must display a working application with healthy retained state in both languages, preserving owner epoch, selection and old bindings
- **AND** regression evidence distinguishes pre-correction failure from corrected availability without claiming physical iPhone acceptance or its hidden trigger

### Requirement: Different-owner activation eligibility is completion-first

Under the existing writer lock and full-lineage validation, different-owner activation SHALL require exactly one eligible completion/reservation pair before resource-health selection. A separate gate SHALL require its reservation to be the latest installation reservation in the epoch, including incomplete reservations.

#### Scenario: Failed install then identical-build successful retry
- **WHEN** one or multiple older incomplete reservations precede one completed latest eligible installation
- **THEN** the browser-active replacement can reconcile, bind and deliver a working application, and restore its committed epoch after restart in both languages online/offline
- **AND** activation associates the pair’s reservation ID and selects resources through its completion ID
- **AND** retain the incomplete reservations/resources, predecessor pins, repair/spent history and cleanup seals without another activation on restoration

#### Scenario: Uniqueness does not override supersession
- **WHEN** a unique completed candidate has a newer incomplete installation reservation in the same epoch, including one preceding a delayed older completion
- **THEN** reject transfer as superseded; do not select the newest reservation, infer completion from bytes or delete history

#### Scenario: Completion acknowledgement is not durable truth
- **WHEN** completion persistence or read-back is interrupted
- **THEN** authoritative full revalidation counts every valid persisted completion, including unacknowledged writes, and counts no absent completion
- **AND** multiple eligible completed pairs remain blocked regardless of differing resource health; delayed settlement retains the writer lock and cannot duplicate activation/publication

#### Scenario: Full validation and existing safety gates remain mandatory
- **WHEN** lineage/provenance is malformed, forked, unsupported, incompatible, stale, ambiguous or loses native authority/head/parent/epoch fencing
- **THEN** fail closed without ignoring incomplete/malformed records, automatic repair/reload, unsafe cleanup, data clearing or reinstallation
- **AND** committed-owner restoration, exact browser-issued binding/read-back before bytes, retention/history, recovery isolation and Auth/privacy boundaries remain unchanged without schema/protocol migration
