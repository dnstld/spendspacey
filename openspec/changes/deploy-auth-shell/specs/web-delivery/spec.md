# Spec Delta

## Purpose

Deliver the existing localized authentication shell through Cloudflare Pages Free at a stable production origin and verify online phone authentication before installation or profile features.

## ADDED Requirements

### Requirement: Stable HTTPS application delivery

The application SHALL use Cloudflare Pages Free GitHub-integrated static delivery at its assigned production `*.pages.dev` origin, with repository root, production branch `main`, and output `dist`. Native Pages SPA fallback SHALL reach the Vite application at `/auth/callback`. Custom domains and Cloudflare runtime/database/storage products SHALL remain excluded.

#### Scenario: Phone opens the hosted shell
- **WHEN** the PM visits the production URL in Google Chrome on an iPhone with connectivity
- **THEN** the existing signed-out shell loads without certificate warnings or a hosting-login interstitial
- **AND** direct `/auth/callback` navigation reaches the Vite application while actual scripts, styles, images, and fonts have their expected bytes and content types
- **AND** no top-level `404.html` or catch-all rewrite disables or replaces Pages' native SPA fallback
- **AND** unknown non-asset paths may receive the generic SPA entry rather than a guaranteed 404

#### Scenario: Build configuration is inspected
- **WHEN** the Pages production build is reviewed
- **THEN** the root project uses `pnpm install --frozen-lockfile && pnpm build` and publishes `dist`
- **AND** supported Pages configuration pins Node `24.21.0` from `.node-version` and pnpm `10.27.0` using `PNPM_VERSION`, with actual versions verified in build logs
- **AND** the only application build variables are `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; toolchain selectors are separate nonsecret platform configuration
- **AND** no Google credential, Supabase secret/service-role key, database credential, other private value, local environment file, real session payload, or test fixture is supplied to Cloudflare or published
- **AND** no Functions, Workers, server runtime, Wrangler application, or Cloudflare database/storage product is introduced

### Requirement: Hosted authentication uses exact registered origins

Production PKCE SHALL use the current-origin application callback, with exact Google and Supabase settings and the local callback retained. New-user signups SHALL remain disabled throughout production configuration and smoke testing. Existing provider scopes, enrolled-user controls, authentication methods, and current-session sign-out SHALL be preserved.

#### Scenario: Enrolled PM signs in and out online
- **WHEN** the PM signs in from production in Chrome on the iPhone
- **THEN** OAuth returns to the same registered Pages origin, the minimal authenticated identity screen appears, and callback parameters are scrubbed
- **AND** current-session sign-out returns to the login screen without revoking independent sessions
- **AND** the chosen English/Brazilian Portuguese preference is preserved

#### Scenario: Provider configuration is reviewed
- **WHEN** the PM configures the final production origin
- **THEN** Google's authorized JavaScript origin is `https://<project>.pages.dev`
- **AND** Google's authorized redirect URI remains `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
- **AND** Supabase Site URL is `https://<project>.pages.dev`
- **AND** Supabase Redirect URLs retain `http://localhost:5173/auth/callback` and add exact `https://<project>.pages.dev/auth/callback`, without preview wildcards
- **AND** the client derives its callback from the current origin instead of hardcoding localhost
- **AND** signups remain disabled throughout configuration and smoke testing, with no new Auth project or enrollment broadening
- **AND** unexpected access findings are referred to the PM without automatic deletion or policy changes

### Requirement: Production and preview delivery have distinct authorization

Production deployment SHALL originate only from accepted changes merged into `main`. Optional PR previews SHALL NOT enable Google sign-in or callback exchange for arbitrary preview URLs, and SHALL NOT be promoted directly to production. Provider allowlists SHALL NOT be broadened for previews.

#### Scenario: Accepted change is deployed
- **WHEN** a new production deployment is created
- **THEN** GitHub-integrated Pages builds an accepted merged `main` revision at the assigned production hostname
- **AND** required CI/review precedes merge and the deployed revision is recorded

#### Scenario: PR receives a preview
- **WHEN** a non-production Pages build is opened
- **THEN** Google sign-in and callback exchange are disabled with localized feedback, including when branch classification is unavailable
- **AND** synthetic/static review remains possible without adding a Google origin or Supabase preview redirect
- **AND** preview/unclassified artifacts remain denied even at the canonical production origin
- **AND** localhost development uses a separate dev/test artifact while the production artifact denies every loopback rehost

#### Scenario: Pages metadata establishes the canonical origin
- **WHEN** any Pages build is compiled
- **THEN** missing or invalid `CF_PAGES_URL` fails the build, including previews and missing-branch builds
- **AND** the raw URL requires HTTPS/default port, no credentials/query/fragment/non-root path, and valid unambiguous `<project>.pages.dev` or `<deployment>.<project>.pages.dev` ASCII DNS labels
- **AND** the canonical origin is derived as `https://<project>.pages.dev` from validated platform metadata, never arbitrary runtime host input
- **AND** exactly two application configuration inputs remain: the Supabase URL and publishable key; no third public variable or full environment is exposed

#### Scenario: Production bytes are served at different origins
- **WHEN** the same compiled `main` production artifact is served at canonical, deployment-specific, unrelated, and loopback origins
- **THEN** only the exact canonical origin may construct a Supabase Auth client, restore/refresh sessions, initiate OAuth, or exchange callback codes
- **AND** denied origins construct no Auth client and send no Auth requests even with a saved expired session
- **AND** restrictions are enforced before client construction and defensively at authentication actions, independently of provider allowlists
- **AND** denied callback parameters/fragments are scrubbed even with invalid configuration and no client
- **AND** allowed callbacks derive from the authorized active origin, with localized denied feedback elsewhere

#### Scenario: Router-recognized callback variants are scrubbed safely
- **WHEN** a callback path is recognized by React Router from the shared canonical path and matching options, including case, trailing/multiple-slash, and encoded variants
- **THEN** denied/no-client bootstrap immediately replaces it with `/auth/callback`, removing query and fragment without constructing an Auth client or issuing authentication requests
- **AND** authorized bootstrap preserves input until the mounted callback captures it, then the same cleanup canonicalizes the URL without an additional token exchange
- **AND** `history.replaceState` preserves current history state and length, while unrelated and near-match URLs remain exactly unchanged
- **AND** application routing and early recognition consume the same UI/Auth-independent route definition through React Router's matching API, without duplicate matching rules

### Requirement: Hosted response headers protect authentication delivery

Entry HTML SHALL revalidate, hashed assets SHALL support immutable caching, and callback responses SHALL prohibit caching and referrer disclosure. Static security headers SHALL permit shell resources without requiring private browser credentials, arbitrary inline scripts, framing, or analytics. Header configuration SHALL preserve native SPA fallback.

#### Scenario: Supabase URL is validated before headers are emitted
- **WHEN** build configuration or CSP generation receives a Supabase URL
- **THEN** raw validation before URL normalization accepts concrete ASCII/Punycode HTTPS DNS hosts including custom domains, normalizing omitted port and explicit `:443` to the same origin
- **AND** it rejects wildcard/IP hosts, malformed/empty/overlong labels or hostnames, underscores, invalid hyphens, trailing dots, Unicode, nondefault remote ports, credentials, non-root paths, query/fragment delimiters, whitespace/control characters, backslashes, encoded ambiguity, and CSP-significant input
- **AND** only the separate local rule permits explicitly approved HTTP loopbacks `localhost`, `127.0.0.1`, and `[::1]` on port `54321`
- **AND** rejected inputs including `https://*` cannot build, emit headers, or broaden `connect-src`

#### Scenario: Immutable rules follow the actual emitted inventory
- **WHEN** the production build emits fingerprinted assets and generates `_headers`
- **THEN** immutable rules name only existing fingerprinted emitted inventory files with verified bytes, never a broad `/assets/*` pattern or public-directory hash lookalikes
- **AND** missing paths, including plausible hashed `/assets/` names, remain non-immutable with or without query parameters
- **AND** Pages path matching ignores queries, so existing named fingerprinted assets with queries may remain immutable
- **AND** `/`, entry HTML, and ordinary fallback HTML remain revalidated, while `/auth/callback` including queries remains no-store
- **AND** all base/global/generated header rules count toward the 100-rule limit, every line is limited to 2,000 characters, and overflow fails the build
- **AND** automated tests model query-independent matching and actual hosted confirmation remains pending under external delivery acceptance

#### Scenario: Actual hosted headers are checked
- **WHEN** HTML, callback paths including query-bearing requests, and hashed assets are requested from production
- **THEN** entry HTML is not served with long-lived immutable caching
- **AND** callback responses include `Cache-Control: no-store` and `Referrer-Policy: no-referrer`
- **AND** hashed assets can use immutable caching and appropriate CSP/content-type protections do not break authentication or safe avatars
- **AND** static Pages headers require no runtime service or custom CDN cache rule

### Requirement: Publication requires online phone evidence and a rollback path

Completion SHALL require actual production publication and the PM's final online sign-in, identity-display, sign-out, and returned-login-screen smoke test in Chrome on an iPhone. Automated verification alone SHALL NOT satisfy this change. Evidence SHALL be sanitized, and rollback SHALL use a previously accepted complete production build.

#### Scenario: Acceptance is recorded
- **WHEN** production passes routing/header checks and the PM's four-step online smoke
- **THEN** a record identifies the deployed accepted revision, production URL, iPhone model, tested iOS and Chrome versions, and sanitized pass/fail results
- **AND** it contains no account address, profile values, token, callback code, or real-account trace
- **AND** tasks remain incomplete while provider access, publication, or PM phone evidence is unavailable
- **AND** new-user signups remain disabled

#### Scenario: Candidate fails acceptance
- **WHEN** production acceptance fails
- **THEN** the runbook restores a prior accepted complete static production deployment, or stops the first failed publication if none exists
- **AND** no database records, RLS, signup restrictions, or language preferences are changed for rollback
- **AND** installation and offline guarantees remain deferred to the next change
