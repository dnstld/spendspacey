# Proposal

## Why

Spendspacey currently has only a README and OpenSpec initialization. Establishing a localized authentication foundation now gives later expense and offline features a tested entry point without prematurely adding those features.

## What Changes

- Bootstrap a React, TypeScript, and Vite application using pnpm with Node 24, React Router, Tailwind CSS, and only the shadcn/ui components needed for this shell.
- Add Google-only Supabase authentication with an explicit browser PKCE callback, persistent sessions, race-safe initialization, and current-session sign-out.
- Show Spendspacey identity, language selection, and Google login when signed out; show only Google name, email, avatar, language selection, and sign-out when signed in, plus necessary loading and error states.
- Bundle typed English and Brazilian Portuguese translations. Prefer an explicit persisted selection, otherwise reevaluate device preferences on launch; map every Portuguese variant to `pt-BR` and fall back to English.
- Validate only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, with no secrets committed or bundled.
- Add formatting, linting, type checking, unit/integration tests, Chromium browser tests, production-build verification, and GitHub Actions checks using synthetic authentication fixtures.
- Document development-provider setup and a final manual PM sign-in/sign-out smoke test using exactly `http://localhost:5173/auth/callback`. Use a development Supabase project and Google testing mode, restricted to the PM's account through provider/Auth configuration.
- Include the existing OpenSpec initialization files (`openspec/config.yaml`, the spec/archive placeholders, existing `.agents/skills/openspec-*` files, and `.agents/skills/.openspec-target`) and this change's planning artifacts in the eventual Phase 1 PR.

Phase 1 excludes expenses, dashboards, application database tables, profiles, PWA installation, service workers, Dexie, offline synchronization, deployment, production callbacks, and additional login methods. Production deployment and callbacks belong to Phase 2. No offline-launch or offline-authentication guarantee is introduced.

## Capabilities

### New Capabilities

- `user-auth`: Google authentication, callback recovery, session lifecycle, and the minimal identity shell.
- `localization`: Supported-locale resolution, explicit preference persistence, localized UI, and typed bundled resources.

### Modified Capabilities

None; no durable capability specs exist yet.

## Impact

- Introduces application source, package/lockfile and toolchain configuration, automated tests, CI, and setup documentation in this greenfield repository.
- Uses Supabase-managed Auth records only; no application schema, migrations, server, or custom OAuth service is required.
- Requires PM-owned Google and development Supabase configuration. Google testing mode alone does not enforce a single-account audience for basic identity scopes. Keep Supabase signups enabled until the PM's first Google authentication succeeds and the identity is confirmed in Auth; review the inventory and stop for PM resolution of unexpected identities without automatic deletion. Only then disable signups. The disabled setting and PM-only Auth inventory are operational evidence of enrollment restriction. Final PM application acceptance requires only enrolled-PM sign-in, confirmation of the minimal identity screen, sign-out, and confirmation of the signed-out Google-login screen, with signups disabled throughout. No second identity is required. Session restoration, localization persistence, callback cancellation/recovery, and unknown-user error handling remain automated checks. If initial enrollment fails before the PM exists, keep signups enabled while correcting OAuth; if disabled prematurely, temporarily re-enable them, enroll and confirm the PM, resolve inventory findings, then disable again.
- Keeps real credentials, tokens, and the PM's account address out of tracked files. Automated checks need no real provider credentials.
