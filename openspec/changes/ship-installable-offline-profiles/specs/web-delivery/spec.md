> **Superseded planning record — 2026-10-17.** Do not implement or synchronize this historical artifact. Follow the four replacements and current-user-only correction in [the supersession map](../../proposal.md). Original content and task completion state are preserved unchanged below.

>
> **PM decisions — 2026-10-18:** Follow the supersession map above for Cloudflare Pages Free, accepted `main` production delivery, exact Auth configuration with signups disabled, restricted previews, and read-only current-user `/profiles` with separate offline snapshot storage. Historical Vercel, missing-asset-404, and profile-directory directions below are superseded; no Supabase/OAuth/callback/token/profile network response may be runtime-cached by the service worker. The original body remains unchanged.

>
> **Resolved PM scope and device acceptance — 2026-10-18:** Follow the supersession map above: `/profiles` is Supabase `public.profiles`/Data API, displayed on existing `/`, with no `/profiles` application route. Manual PWA acceptance is iPhone/Google Chrome Share → Add to Home Screen, Spendspacey name/icon, standalone Home Screen launch, phase-specific installed-app online/offline checks, and recorded iOS/Chrome versions. Offline profiles require successful authenticated online load/commit, complete close, connectivity removal, and reopen/reload showing only that user's cached profile. Desktop Chromium cannot replace PM evidence. Safari-specific manual acceptance is not required; use standards/feature detection without browser detection. Cloudflare/GitHub access and assigned hostname are execution prerequisites. Original body preserved below.

# Spec Delta

## Purpose

Deliver Spendspacey at a stable HTTPS origin that supports authentication and mobile installation, and verify the installed offline experience on the PM's real phone.

## ADDED Requirements

### Requirement: Stable HTTPS application delivery

The application SHALL be published at one stable HTTPS origin using its production static build and validated public configuration. Hosting SHALL deliver real static files before SPA fallback, preserve direct callback entry, and permit the PM's phone to load the application and worker without a hosting-login interstitial.

#### Scenario: Hosted application is reachable
- **WHEN** the PM visits the published origin on the phone
- **THEN** the signed-out localized application loads over trusted HTTPS without certificate warnings or a hosting account login
- **AND** direct `/auth/callback` navigation reaches the application while manifest, icons, scripts, and styles have their correct content types
- **AND** missing scripts or worker files are not silently served as HTML

#### Scenario: Deployment configuration is inspected
- **WHEN** the hosting build and application bundle are inspected
- **THEN** Node/pnpm and the lockfile follow the repository's supported toolchain and the static build uses the two validated public Supabase inputs
- **AND** no privileged credential, real session payload, local environment file, or test fixture is published

### Requirement: Delivery headers preserve update and privacy behavior

The host SHALL allow prompt revalidation of the application entry document, manifest, and stable service-worker URL while serving content-hashed static assets with immutable caching. Authentication callback delivery SHALL prohibit HTTP caching and referrer disclosure. Security headers SHALL permit only the resources needed by the implemented shell and profiles read.

#### Scenario: Hosted response headers are checked
- **WHEN** the entry document, callback, worker, manifest, and hashed assets are requested from the hosted origin
- **THEN** HTML, manifest, and worker do not receive long-lived immutable caching
- **AND** callback responses have `Cache-Control: no-store` and `Referrer-Policy: no-referrer`
- **AND** hashed assets can use long-lived immutable caching, and the worker has the correct script type and root scope

#### Scenario: Application security headers are checked
- **WHEN** the hosted shell authenticates and reads profiles
- **THEN** its content-security and other delivery headers allow the required static files, worker, Supabase requests, and safe avatar images
- **AND** they do not require a secret in client code, arbitrary inline script execution, framing, or an extra analytics script

### Requirement: Hosted authentication uses exact registered origins

The hosted application SHALL use its exact HTTPS `/auth/callback` URL registered with the existing authentication service. Local development SHALL retain its exact localhost callback. Deployment SHALL preserve existing access controls and SHALL NOT broaden enrollment, add wildcard preview callbacks, or create another Auth project.

#### Scenario: PM signs in at the hosted origin
- **WHEN** the enrolled PM starts Google sign-in from the installed online application
- **THEN** the full-page PKCE flow returns to the same registered hosted origin and `/auth/callback`
- **AND** the session and authorized profiles view become available without losing the browser's verifier
- **AND** no production-domain assumption redirects the PM back to localhost

#### Scenario: Provider configuration is reviewed
- **WHEN** the exact hosted origin and callback are registered
- **THEN** the local callback remains allowed, existing signup restrictions remain unchanged, and Google's redirect to Supabase remains distinct from the application callback
- **AND** unexpected access-control or account-inventory findings are referred to the PM without automatic deletion or restriction changes

### Requirement: Real-phone installation and offline profiles are acceptance gates

Completion SHALL require the PM to install and exercise the hosted application on a real phone. Automated browser checks SHALL complement this evidence and SHALL NOT substitute for installation, standalone relaunch, and an offline refresh showing previously loaded profiles.

#### Scenario: PM completes mobile acceptance
- **WHEN** automated checks pass and the hosted build and exact callbacks are ready
- **THEN** the PM installs using the phone's supported browser installation flow, launches the home-screen icon, signs in online, and loads profiles until both shell and data are ready offline
- **AND** the PM enables airplane mode, refreshes and fully closes/reopens the installed app, and confirms saved profiles and usable English/Brazilian Portuguese behavior
- **AND** after reconnecting the PM confirms refresh and current-session sign-out, and offline reload after sign-out does not show the previous profiles

#### Scenario: Update and presentation are checked on the phone
- **WHEN** a replacement version is made available during acceptance
- **THEN** the PM confirms the update-ready indication and safe close/reopen transition
- **AND** the icon, standalone presentation, touch controls, safe areas, and avatar fallbacks are usable on the actual phone

#### Scenario: Evidence is recorded without private data
- **WHEN** acceptance results are recorded
- **THEN** the record identifies the deployed version, stable URL, phone OS/browser, and sanitized pass/fail outcomes
- **AND** it contains no profile values, account addresses, tokens, callback parameters, browser storage exports, or real-account traces
- **AND** tasks remain incomplete if hosting, provider setup, or actual phone evidence is unavailable

### Requirement: Published changes have a tested recovery path

The delivery runbook SHALL identify the last working deployment and a worker-aware rollback procedure. Reverting hosted files SHALL NOT be represented as removing already installed workers or private local data.

#### Scenario: Rollback is needed
- **WHEN** a published version fails acceptance
- **THEN** the prior complete deployment can be restored at the stable origin and the worker/update recovery path is documented and verified
- **AND** rollback does not change database records, RLS, enrollment settings, or language preference
