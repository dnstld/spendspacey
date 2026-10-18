> **Superseded planning record — 2026-10-17.** Do not implement or synchronize this historical artifact. Follow the four replacements and current-user-only correction in [the supersession map](../../proposal.md). Original content and task completion state are preserved unchanged below.

>
> **PM decisions — 2026-10-18:** Follow the supersession map above for Cloudflare Pages Free, accepted `main` production delivery, exact Auth configuration with signups disabled, restricted previews, and read-only current-user `/profiles` with separate offline snapshot storage. Historical Vercel, missing-asset-404, and profile-directory directions below are superseded; no Supabase/OAuth/callback/token/profile network response may be runtime-cached by the service worker. The original body remains unchanged.

>
> **Resolved PM scope and device acceptance — 2026-10-18:** Follow the supersession map above: `/profiles` is Supabase `public.profiles`/Data API, displayed on existing `/`, with no `/profiles` application route. Manual PWA acceptance is iPhone/Google Chrome Share → Add to Home Screen, Spendspacey name/icon, standalone Home Screen launch, phase-specific installed-app online/offline checks, and recorded iOS/Chrome versions. Offline profiles require successful authenticated online load/commit, complete close, connectivity removal, and reopen/reload showing only that user's cached profile. Desktop Chromium cannot replace PM evidence. Safari-specific manual acceptance is not required; use standards/feature detection without browser detection. Cloudflare/GitHub access and assigned hostname are execution prerequisites. Original body preserved below.

# Spec Delta

## Purpose

Let users install Spendspacey on a phone and reopen its localized application shell without connectivity after a completed online preparation, with safe static caching and predictable updates.

## ADDED Requirements

### Requirement: Stable mobile application identity

The application SHALL expose a valid linked manifest with stable identity, root start URL and scope, Spendspacey name, standalone display, matching theme/background colors, and usable application icons. The installation identity SHALL be independent of account, language, and authentication URLs.

#### Scenario: Installable manifest and icons
- **WHEN** the production build is inspected in a supporting browser
- **THEN** its manifest has a stable `id`, `start_url: "/"`, `scope: "/"`, `name` and `short_name` of `Spendspacey`, and `display: "standalone"`
- **AND** it declares valid 192x192 and 512x512 PNG icons and a maskable icon with safe padding, with no preferred related native application
- **AND** an Apple touch icon and appropriate mobile title, theme, and viewport metadata are present

#### Scenario: Installed mobile presentation
- **WHEN** the PM launches the installed application from the phone's home screen
- **THEN** it opens the root shell in standalone presentation with the correct icon and name
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

The service worker SHALL store only reviewed same-origin static build assets. It SHALL NOT store API responses, OAuth traffic, callback responses, avatars or other user information, authentication parameters, tokens, credentials, or non-GET requests. The permitted profile snapshot SHALL use separate application data storage.

#### Scenario: Sensitive traffic is excluded
- **WHEN** sign-in, callback handling, session refresh, profiles loading, avatar loading, and sign-out have occurred
- **THEN** inspecting every service-worker cache shows only approved static assets
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
- **THEN** the application announces that an update is ready and explains closing all app windows and reopening
- **AND** it does not automatically activate the replacement or reload a callback or authentication operation

#### Scenario: Replacement activates
- **WHEN** all old application windows have closed and the replacement activates
- **THEN** the next launch uses the complete replacement and also works offline
- **AND** explicit language preference and the compatible profile snapshot remain available

#### Scenario: Update download fails
- **WHEN** required replacement assets cannot be fetched
- **THEN** the prior complete worker and shell remain usable
- **AND** the application does not report the failed replacement as ready

### Requirement: Static cache versions and recovery are bounded

Static caches SHALL have application-specific ownership and revisioning, remove obsolete owned assets after successful activation, and provide bounded online recovery from missing assets. Static-cache repair SHALL preserve authentication storage, language preference, and private profile snapshots.

#### Scenario: Obsolete assets are removed
- **WHEN** a new complete version activates
- **THEN** obsolete Spendspacey static cache entries are removed without deleting unrelated origin caches or application data
- **AND** cache-policy schema changes have an explicit version boundary

#### Scenario: A required chunk is missing
- **WHEN** a cached chunk is missing or mismatched and the application can show recovery
- **THEN** the user receives localized reconnect/reload guidance
- **AND** online repair is limited so it cannot create an automatic reload loop
- **AND** an offline failure does not erase remaining caches or claim successful repair

#### Scenario: Worker registration is unavailable
- **WHEN** service workers or cache storage cannot be used
- **THEN** ordinary online authentication and profiles rendering remain usable
- **AND** the application does not claim offline readiness
