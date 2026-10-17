# Design

## Context

The repository contains `README.md`, untracked OpenSpec initialization, and project-local OpenSpec skills. There is no package manifest, application, test suite, CI configuration, or existing capability spec. See [proposal.md](proposal.md) for motivation and scope; behavior is defined in [user-auth](specs/user-auth/spec.md) and [localization](specs/localization/spec.md).

A design is warranted because provider configuration, browser redirects, persisted state, and localization cross module boundaries and affect authentication correctness. The only live Phase 1 application origin is `http://localhost:5173`; automated browser tests use synthetic configuration independently of the live provider.

## Goals / Non-Goals

**Goals:** Keep a small module boundary around authentication and localization, prevent initialization/callback races, make failures recoverable, and verify application behavior without depending on Google in CI.

**Non-Goals:** No general authentication framework, global state library, remote translation service, custom OAuth server, or future offline infrastructure. The proposal's excluded product features remain excluded. Production build verification is a local/CI check, not deployment work.

## Decisions

### 1. Small Vite application and two routes

Use React/TypeScript with Vite, pnpm, and Node 24. Pin an exact pnpm version in `packageManager`, declare Node 24 in the runtime/engine configuration, pin installed package versions, and commit `pnpm-lock.yaml`. Select compatible current package versions during implementation rather than freezing speculative versions in this plan.

Use React Router declarative mode with `/` and `/auth/callback`. Keep the callback reachable regardless of session state; it must not be redirected merely because restoration initially returns no session. Unknown routes replace to `/`. A root screen renders the appropriate auth view, avoiding separate login/profile routes or route guards with no protected content to guard. Retain React Strict Mode.

Suggested responsibility layout:

| Location | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Initialization, providers, routes |
| `src/auth/` | Provider/hook, identity screen, callback screen and shared exchange helper |
| `src/components/LanguageSelect.tsx` | Shared native language control |
| `src/components/ui/` | Only required shadcn components |
| `src/lib/env.ts`, `src/lib/supabase.ts` | Pure configuration parser and singleton client |
| `src/i18n/` | Resolution, initialization, `en`/`pt-BR` resources and type augmentation |
| `src/index.css` | Tailwind/theme styling |
| Colocated `*.test.*`, `e2e/` | Unit/component tests and Chromium scenarios |

Use Tailwind's Vite integration; add shadcn components individually, starting with button/avatar only as needed. Use a labeled native select for two languages. Keep Google's button logo and treatment consistent with its [branding guidance](https://developers.google.com/identity/branding-guidelines). Avoid importing a component catalog or adding abstraction layers for hypothetical features.

### 2. Explicit browser PKCE callback ownership

Create one `@supabase/supabase-js` client after configuration validation. Set `flowType: 'pkce'`, `detectSessionInUrl: false`, `persistSession: true`, and `autoRefreshToken: true`. Use the SDK's normal browser persistence; do not copy tokens into another store. An explicit callback gives application-owned errors a visible boundary. Automatic SDK URL exchange is an alternative, but must not run alongside manual exchange.

```text
localhost:5173/ --> Supabase authorize --> Google
Google --> development Supabase /auth/v1/callback
       --> localhost:5173/auth/callback?code=...
SPA callback --> Supabase code exchange --> SPA /
```

Call Google `signInWithOAuth` with the current origin plus `/auth/callback`; for manual use this is exactly `http://localhost:5173/auth/callback`. Pin the development server to port 5173 with `strictPort` so an occupied port produces an error instead of a broken redirect. Request basic identity scopes only; do not request Google offline access or retain provider tokens separately. There is no Google SDK, popup, One Tap, SSR package, or application callback server.

The callback parses query and fragment errors before exchanging a code. A module-scoped helper shares one exchange promise/result for the current code across Strict Mode remounts. It runs outside auth-event callbacks. On success, replace navigation to `/`; on failure, scrub the URL and show an error key with return/fresh-sign-in actions. A bare callback also offers recovery. Do not automatically retry used/expired codes, accept arbitrary return URLs, or erase an already valid session merely because a callback failed. Interrupted page reloads may require fresh login.

References: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

### 3. One provider reconciles session state

Represent initialization, authenticated, unauthenticated, and recoverable restoration error distinctly. Pending sign-in/sign-out and operation messages are separate from the session state. Store message keys rather than already translated error strings so language changes update existing feedback.

Subscribe to `onAuthStateChange` before the initial `getSession` read. Handle `INITIAL_SESSION` idempotently; update from `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, and `USER_UPDATED`. Track a small revision/generation so a late initial result cannot replace a newer event, and ignore results from disposed effect instances. Unsubscribe on cleanup. Do not navigate on every `SIGNED_IN` notification; root rendering follows state and only callback completion navigates. The callback screen remains pending while its exchange is pending even if restoration finds no session.

Keep subscription callbacks synchronous and limited to state reconciliation. Awaiting another Supabase operation there can deadlock; see [Supabase troubleshooting](https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0). Let the SDK own refresh scheduling and cross-tab notifications. `getSession` supplies browser display state, not authorization for future backend operations.

Use `signOut({ scope: 'local' })` explicitly; the SDK default is global. Disable repeated actions while pending. Follow actual SDK state on failure and offer retry rather than optimistically claiming sign-out. Never clear all local storage. Derive display identity from session user metadata/email, render as text, validate avatar URLs for image use, and provide missing-field/image fallbacks. No profile record is created.

### 4. Bundled typed resources and explicit-only persistence

Use i18next/react-i18next with one namespace grouped by concerns, English canonical resources, and Brazilian Portuguese resources bundled as TypeScript objects. Derive `CustomTypeOptions` from the English resource shape and explicitly enable typed selector access. Avoid a handwritten key union or dynamic user/provider strings as translation keys. Validate equal leaf keys, nonempty values, and interpolation-placeholder parity; resource shape checking must allow different translated string values.

Use a small pure locale resolver rather than the browser detector plugin. Read `spendspacey.locale`; accept only canonical `en` or `pt-BR`. Otherwise inspect `navigator.languages` in order, falling back to `navigator.language` when needed. Match language tags case-insensitively: any English variant maps to `en`, any Portuguese variant including `pt-PT` maps to `pt-BR`; skip unsupported/invalid entries and ultimately choose `en`. Only an explicit selection writes storage. Do not add URL language parameters, locale routes, cookies, account preferences, or a system-language reset option in this phase.

Configure supported languages `en`/`pt-BR`, English fallback, full canonical-locale lookup, and empty-string fallback. Await initialization before rendering the app; update document title and `<html lang>` at startup and on change. Localize controls, status/errors, and accessibility text; leave identity values and the Spendspacey brand unchanged. Failed preference reads/writes are nonfatal; a selection still works in memory. Authentication storage failure is separate and must surface a recoverable authentication error, not silently promise persistence.

Reference: [i18next resource typing](https://www.i18next.com/overview/typescript).

### 5. Two public environment inputs and early validation

Use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A shared pure parser checks required values, a valid origin without credentials/path/query/fragment, HTTPS except loopback development/test URLs, and a nonempty `sb_publishable_` key. Reject legacy JWT and secret/service-role keys rather than supporting unnecessary compatibility. Syntax checks do not establish that a key or provider configuration works.

Call the parser from Vite configuration using loaded environment values so invalid configuration fails development startup and production build. Reuse it before browser client creation; initialize localization first so a browser configuration failure can render safely. Report names, never values. No schema-validation dependency is needed for two fields.

Ignore `.env` and mode/local variants except a placeholder-only `.env.example`; do not track actual provider configuration, tokens, credentials, build artifacts, browser storage state, or real-account test traces. CI supplies two synthetic public values. Do not expose the entire process environment through Vite. A publishable key is public by design; all privileged credentials remain outside the client/repository. References: [Vite environment handling](https://vite.dev/guide/env-and-mode), [Supabase keys](https://supabase.com/docs/guides/getting-started/api-keys).

### 6. Small tests at application boundaries

Use Vitest, React Testing Library, and a DOM test environment. Mock the Supabase module's small used surface for provider/component tests; no separate auth interface framework is necessary. Cover the spec's outcomes, particularly event/restoration ordering, subscription cleanup, callback exchange deduplication, local sign-out, safe failures, locale precedence/persistence, configuration errors, resource parity, and identity fallbacks. An isolated type-check fixture must prove unknown translation keys are rejected.

Use Playwright Chromium only, including narrow/wide viewport checks, against the production build served locally. At a separate loopback test port, derive callback origin from that test page; this synthetic test URL is not a live Supabase allowlist entry and does not change the manual callback. Install request interception before navigation. Use a few static Auth response fixtures and a direct mocked authorization redirect back to the callback, with an SDK-created verifier, only for the callback journey. Other authenticated scenarios can reuse synthetic stored state. Stub avatar requests and fail unexpected Auth network requests. No real keys, production bypass flags, elaborate fake server, Google automation, SDK refresh algorithm tests, or snapshot catalog.

Browser scenarios cover signed-out UI in both locales, explicit selection through reload/redirect, authenticated identity and reload, callback error recovery, sign-out, and keyboard/narrow-screen usability. Unit/component tests own exhaustive error variants and races; browser tests need not duplicate them all. Mocking proves app integration, not provider setup. [Playwright request interception](https://playwright.dev/docs/mock) supplies the needed boundary.

Automated tests retain coverage of session restoration/reload, localization persistence, callback cancellation/recovery, and localized handling of signup-disabled rejections for synthetic unknown identities. Small rejection fixtures check application behavior without authenticating another real Google identity or testing Supabase internals. Configuration inspection of disabled signups and the PM-only Auth inventory supplies the operational evidence that new identities cannot enroll.

### 7. One CI workflow with explicit checks

Use Prettier, ESLint with TypeScript/React Hooks rules, explicit TypeScript checking, Vitest non-watch execution, Vite production build, Chromium Playwright, and a lightweight secret scan. Avoid formatting rules duplicated in ESLint, arbitrary coverage gates, extra browser/OS matrices, and deployment jobs.

Expose commands such as `format:check`, `lint`, `typecheck`, `test:unit`, `build`, and `test:e2e`. One Linux GitHub Actions job runs on pull requests and default-branch pushes: Node 24/pinned pnpm, frozen-lockfile install, formatting/lint/type/unit checks, build, install Chromium with system dependencies, and browser tests against that build. Include secret scanning without real credentials; retain only synthetic failure reports/traces. Use read-only contents permission, verified action commit pins, a job timeout, pnpm-store caching, and cancellation of superseded runs. Validate this OpenSpec change with the CLI during implementation review; do not require a new OpenSpec CI integration merely to initialize the application.

### 8. Development provider setup and final manual acceptance

The PM owns the live account and console configuration. Use a dedicated development Supabase project, Google-only sign-in, Google testing mode with only the PM listed, and basic identity scopes. Register `http://localhost:5173` as the Google application origin and the development Supabase project's `/auth/v1/callback` as Google's redirect URI. In Supabase, set the local Site URL and allow exactly `http://localhost:5173/auth/callback`; do not register production callbacks or wildcard preview URLs.

Google explicitly exempts basic identity scopes from its testing-user restriction. Therefore, that list alone cannot fulfill the single-account decision. Keep other login providers disabled. During the final manual setup window, follow this sequence:

1. Keep Supabase **Allow new users to sign up** enabled until the PM successfully completes the first Google authentication.
2. Confirm that the PM's Google identity exists in Supabase Auth; an attempted login or browser redirect alone is not confirmation.
3. Inspect the Auth inventory for unexpected identities. If any exist, stop setup and acceptance for PM resolution; do not delete or alter those identities automatically. Continue only after the PM resolves the inventory and confirms that only the expected PM identity remains.
4. Disable new signups only after the PM identity is confirmed and the inventory review is resolved.
5. Prepare a signed-out application state and conduct the final sign-in/sign-out smoke below with the enrolled PM identity while signups remain disabled. Record the disabled-signup setting and PM-only Auth inventory as operational evidence that new identities cannot enroll; no second or unknown Google identity is required.

If initial enrollment fails before the PM identity exists, keep signups enabled while correcting OAuth configuration. If signups were disabled prematurely and the PM identity is absent, temporarily re-enable them, complete the PM's first Google authentication, confirm the identity and review the inventory, then disable signups again. Never leave the environment with signups disabled while the PM still needs initial enrollment. An unexpected-identity finding always pauses work for PM resolution without automatic deletion.

This uses managed Auth configuration only, adding no tables, hooks, custom service, or frontend email allowlist. References: [Google audience exception](https://support.google.com/cloud/answer/15549945?hl=en), [Supabase signup control](https://supabase.com/docs/guides/auth/general-configuration).

After all automated checks pass and initial enrollment/configuration inspection is complete, the PM's only manual application acceptance test at `http://localhost:5173` is the following, with signups disabled throughout:

1. Sign in with the enrolled PM Google identity.
2. Confirm the minimal authenticated identity screen appears.
3. Sign out.
4. Confirm the signed-out Google-login screen appears.

Session restoration, language persistence, reload, callback cancellation/recovery, and unknown-user error handling remain covered by automated tests as described in Decision 6. No second-identity test is required for Phase 1 completion. Keep account addresses and tokens out of the recorded result; a sanitized pass/fail note plus operational configuration evidence suffices. This planning change neither configures external projects nor runs that smoke.

## Risks / Trade-offs

- Browser-readable persisted tokens are exposed to successful script injection -> render identity as text, avoid unnecessary scripts/HTML injection, never log session payloads, and revisit hosting security headers in Phase 2.
- Origin changes, blocked storage, simultaneous sign-ins, expired/reused codes, or interrupted callbacks can lose the PKCE verifier -> pin the manual origin, show safe localized recovery, and begin a fresh login rather than building custom recovery infrastructure.
- Initialization may need network refresh -> show loading/retry honestly; do not claim offline authentication or offline launch. A currently open page showing cached identity is not a new authorization guarantee.
- Google testing mode is not an account allowlist for identity scopes -> use a controlled initial enrollment window, confirm the PM in Auth, stop for PM resolution of unexpected identities without automatic deletion, then disable signups. Inspect that setting and the PM-only inventory as enrollment-restriction evidence; the final PM application smoke covers only sign-in/sign-out and the two resulting screens.
- Disabling signups before the PM identity exists prevents initial enrollment -> keep them enabled during initial OAuth troubleshooting; if disabled prematurely, temporarily re-enable them, enroll and confirm the PM, review the inventory, then disable them again. Never leave initial PM enrollment blocked by the signup setting.
- Request fixtures can drift from SDK contracts -> keep the used response shapes small, automate restoration/localization/callback and unknown-user error handling, inspect access-restriction configuration, and run the final enrolled-PM sign-in/sign-out smoke. Do not test SDK internals or require another real identity to compensate.
- Chromium-only checks leave other browsers unverified -> record Chromium as the Phase 1 acceptance browser and revisit the browser matrix later.

## Migration Plan

No data migration or deployment is involved. Implementation adds the application and tooling around the existing README. Include the existing OpenSpec configuration, placeholders, `.agents/skills/openspec-*` files, `.agents/skills/.openspec-target`, and all scaffolded change artifacts in the eventual PR; preserve them rather than reinitializing OpenSpec. Do not archive incomplete tasks.

Recovery depends on whether the PM identity exists in Supabase Auth. If initial enrollment fails and that identity is absent, keep **Allow new users to sign up** enabled while correcting OAuth. If the setting was disabled prematurely, temporarily re-enable it, complete the first Google authentication, confirm the PM identity, and review the inventory before disabling it again. If unexpected identities are found, stop for PM resolution without automatic deletion. Once the PM identity is confirmed and the inventory resolved, keep signups disabled while diagnosing subsequent existing-identity login failures; do not reopen enrollment merely because a later smoke step fails. Reconfirm the disabled-signup setting and PM-only inventory as operational restriction evidence, then repeat only the four-step enrolled-PM sign-in/sign-out smoke for manual application acceptance. Automated restoration, localization-persistence, callback cancellation/recovery, and unknown-user handling checks must still pass; no second-identity test blocks completion. Never leave the environment in a state that prevents the PM's initial enrollment.

Application rollback is a normal reversal of the eventual implementation change; there is no application database or production rollout to reverse.

## Open Questions

No product or architecture decisions remain open. The PM must supply the actual development project configuration and use their Google account privately for final acceptance. Exact compatible dependency/tool versions and wording of localized feedback can be chosen during implementation without changing this plan.
