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

The service worker SHALL store only reviewed same-origin static build assets. It SHALL NOT store API responses, OAuth traffic, callback responses, avatars or other user information, authentication parameters, tokens, credentials, or non-GET requests. No private application data snapshot SHALL be introduced by this change.

#### Scenario: Sensitive traffic is excluded
- **WHEN** sign-in, callback handling, session refresh, avatar loading, and sign-out have occurred
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
- **AND** explicit language preference and normal SDK session storage remain available

#### Scenario: Update download fails
- **WHEN** required replacement assets cannot be fetched
- **THEN** the prior complete worker and shell remain usable
- **AND** the application does not report the failed replacement as ready

### Requirement: Static cache versions and recovery are bounded

Static caches SHALL have application-specific ownership and revisioning, remove obsolete owned assets after successful activation, and provide bounded online recovery from missing assets. Static-cache repair SHALL preserve authentication storage, language preference, and unrelated local data.

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
- **AND** from the installed app the PM completes online sign-in/identity/sign-out checks, waits for static readiness, then refreshes and fully closes/reopens it in airplane mode
- **AND** the shell, English/Brazilian Portuguese controls, safe areas, touch controls, and avatar fallbacks remain usable
- **AND** an unavailable session shows reconnect guidance rather than preventing shell launch or claiming fresh authentication

#### Scenario: Phone update and acceptance are recorded
- **WHEN** a compatible accepted production replacement from `main` is available at the same origin
- **THEN** the PM verifies the waiting notice and safe close-all-windows/reopen update path in the installed iPhone Home Screen app
- **AND** sanitized iPhone model, tested iOS and Chrome versions, deployed version, production URL, and manual PM pass/fail evidence is recorded without identity values or real-account traces
- **AND** desktop Chromium evidence does not substitute for the actual installed-app online/offline checks; Safari-specific manual acceptance is not required
- **AND** this change remains incomplete until actual installation/offline/update evidence passes
