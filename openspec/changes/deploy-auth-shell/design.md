# Design

## Context

See [proposal.md](proposal.md) and [web-delivery](specs/web-delivery/spec.md). This is change 1/4, based on completed Phase 1 at merge `3d40fd9`. The repository is a static React/Vite SPA with `/`, `/auth/callback`, current-origin PKCE redirects, bundled languages, and synthetic Linux CI. Its production script is `pnpm build` (`tsc --noEmit && vite build`); `build:test` supplies synthetic configuration and is not the production command.

## Goals / Non-Goals

**Goals:** Deliver the existing auth shell on Cloudflare Pages Free and prove online production authentication in Chrome on the PM's iPhone.

**Non-Goals:** Cloudflare Functions, Workers, server runtime, Wrangler application, Cloudflare database/storage products, custom domains, PWA features, profiles, IndexedDB, or backend changes. A browser service worker belongs only to the next increment and is not a Cloudflare Worker.

## Decisions

### 1. Git-integrated static Pages delivery

The PM selected Cloudflare Pages Free, replacing the prior Vercel proposal. Connect the existing GitHub repository through Pages' GitHub integration, with repository root as project root and `main` explicitly selected as production branch. Build static React/Vite assets into `dist`. Use the assigned `https://<project>.pages.dev` production hostname initially; custom domain work is deferred. [GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)

Production follows reviewed, accepted changes merged into `main`; a branch/PR candidate is never promoted directly to production. Preserve review and required CI before merge. Git integration starts builds on branch updates, so link/enable the first production build only once the delivery change is accepted and merged. Later increments follow the same policy. PR previews may be enabled separately for static review.

### 2. Exact toolchain and public application configuration

Use supported Pages build settings:

| Setting | Planned value |
| --- | --- |
| Build image | Pages v3 |
| Project root | Repository root; no subdirectory |
| Production branch | `main` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Output directory | `dist` |
| Node | Existing root `.node-version` containing `24.21.0` |
| pnpm | Pages toolchain selector `PNPM_VERSION=10.27.0`, consistent with `packageManager` |
| Application build variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` only |

Pages' automatic dependency installation uses the selected toolchain; the build command explicitly enforces the frozen lockfile before the repository production script. Verify `node --version` and `pnpm --version` in build diagnostics, failing mismatches. Do not rely on platform defaults, `engines`, or lockfile-version inference. `PNPM_VERSION` is a nonsecret platform toolchain selector, not an additional application input. Do not add another custom application variable. [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [supported version overrides](https://developers.cloudflare.com/pages/configuration/build-image/)

Both Supabase values are public browser configuration, compiled into the app. Never place Google credentials, Supabase secret/service-role keys, database credentials, deployment credentials, or other private values in Cloudflare configuration, source, or output. No host credential is needed in repository CI.

Validate the raw Supabase URL before URL normalization: concrete ASCII/Punycode HTTPS DNS hosts (real project URLs or custom domains), optional root slash, omitted/default `:443` port normalized identically. Reject wildcards, IP literals, invalid/empty/overlong DNS labels or hosts, underscores, invalid hyphens, trailing dots, Unicode, credentials, non-root paths, query/fragment delimiters even if empty, nondefault remote ports, whitespace/control characters, backslashes, encoded ambiguity, and CSP-significant input. Revalidate before CSP rendering. Only a separate local artifact permits the explicit HTTP loopbacks `localhost`, `127.0.0.1`, and `[::1]` on port `54321`; no remote/other local-port exception is implied. Reject extra `VITE_` inputs. Errors name configuration fields without printing values.

### 3. Native SPA fallback and static headers

Preserve Pages' native SPA behavior: do not emit a top-level `404.html`, catch-all `_redirects` rewrite, server handler, or framework adapter. Direct `/auth/callback` must load the Vite entry at the requested origin/path. Real build assets must have the expected bytes and MIME types. Unknown paths may receive the generic SPA entry under native fallback; the earlier unconditional missing-script-404 requirement is superseded. Verify the published asset inventory instead of changing fallback to force arbitrary missing paths to 404. [Native SPA behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/)

During apply, use Pages' static `public/_headers` mechanism, copied into `dist`, for HTML/unversioned-asset revalidation, immutable content-hashed assets, callback `Cache-Control: no-store`/`Referrer-Policy: no-referrer`, and appropriate CSP, nosniff, and framing protections. Avoid overlapping cache directives being combined incorrectly. Test headers on actual callback paths including query-bearing requests, not only `index.html`. Permit current self-hosted resources, configured Supabase connections, and safe HTTPS avatars without arbitrary inline scripts or analytics. Do not add CDN cache rules or runtime code to implement these headers. Local Vite preview does not prove Pages behavior. [Static headers](https://developers.cloudflare.com/pages/configuration/headers/)

The agreed correction supersedes the initial broad `/assets/*` immutable rule. Use explicit fingerprinted output names and the final emitted bundle inventory; verify named files exist and match emitted bytes. Append one exact immutable rule per fingerprinted inventory file, excluding public-directory lookalikes and nonexistent paths. Count all base/global/generated rules against the 100-rule maximum and validate every line against 2,000 characters, failing builds on either overflow. Pages path matching ignores queries: existing fingerprinted assets with queries may remain immutable; missing assets (even hash-looking names) and fallback HTML with/without queries must not inherit immutable caching. `/` and entry HTML revalidate, callback query variants remain no-store, and unmatched paths retain native revalidation. Model these semantics in tests; actual hosted confirmation remains pending under task 2.3.

### 4. Exact production authentication settings

The PM performs provider configuration during apply, using the final assigned production origin:

| Configuration | Value |
| --- | --- |
| Google authorized JavaScript origin | `https://<project>.pages.dev` (origin only) |
| Google authorized redirect URI | `https://<supabase-project-ref>.supabase.co/auth/v1/callback` |
| Supabase Site URL | `https://<project>.pages.dev` |
| Supabase Redirect URLs: retain local | `http://localhost:5173/auth/callback` |
| Supabase Redirect URLs: add production | `https://<project>.pages.dev/auth/callback` |
| New-user signups | Disabled throughout configuration and smoke testing |

The Google redirect remains Supabase's callback; the application's Pages callback is a separate allowlisted Supabase redirect. The client must keep deriving `redirectTo` as `${window.location.origin}/auth/callback`, never hardcode localhost or introduce a production-URL application variable. Preserve existing Google scopes/testing/enrolled-user controls, PKCE ownership, scrubbing, and current-session sign-out. Do not create an Auth project, broaden enrollment, or change records/RLS to troubleshoot access. [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls)

Optional PR previews are for static/synthetic review. Do not register wildcard or arbitrary preview origins/callbacks with Google or Supabase. The reviewer-agreed correction supersedes the initial preview boolean: derive a nonsecret authentication policy from platform-supplied `CF_PAGES`, `CF_PAGES_BRANCH`, and validated `CF_PAGES_URL`, with no third browser configuration input. Every Pages build, including previews/missing branches, fails on missing/invalid URL metadata. Require HTTPS/default port, no credentials/query/fragment/non-root path, and valid ASCII DNS labels in exactly `<project>.pages.dev` or `<deployment>.<project>.pages.dev`. Canonicalize to `https://<project>.pages.dev` from the validated labels. Trust platform build metadata, never arbitrary runtime/request host input. Copy only the generated policy to browser code, not the build environment.

A Pages `main` production artifact authorizes only that exact canonical origin; deployment-specific URLs, unrelated origins, and every loopback origin are denied even when serving identical production bytes. Preview/non-`main`/missing-branch artifacts remain denied even at canonical. Unclassified non-Pages production builds deny everywhere. Separate dev/test artifacts permit only `http://localhost:5173` and `http://127.0.0.1:4173`; `build:test` explicitly selects development mode and must never be published. Deny before importing/constructing Supabase, preventing session restoration/persistence/refresh, and defensively gate client construction, session subscription/restoration/retry, sign-in/sign-out, and callback exchange. Show localized feedback with disabled sign-in/no identity, and scrub callback query/fragment input even with invalid config/no client. Derive callbacks only from the authorized active origin. Exact provider allowlists and backend authorization remain necessary but insufficient client-side enforcement. Preview builds must not be promoted to production.

### 5. Online production phone acceptance

Retain synthetic callback/localization/session/sign-out coverage. Compile separate local, production, preview, and unclassified artifacts. Test the same production bytes at canonical, deployment-specific, unrelated, and permitted local-test loopback origins (the production artifact must still deny these); test preview/unclassified bytes at canonical. Seed expired synthetic sessions and callback input in denied cases; assert no SDK-module load, no Auth requests, and unit-spy zero client construction. Also cover invalid configuration/no-client callback scrubbing and defensive actions. Parser and generated-header regressions reject every unsafe URL class; subprocess builds reject invalid URLs/Pages metadata before emitting headers. Header tests cover inventory equality, existing/missing/query/fallback paths and both platform limits. The small header reader models query-independent paths and combined rules/native revalidation; hosted behavior remains separate. Ordinary PR CI uses synthetic values, never real OAuth, host credentials, or live-account traces. Secret scanning covers all emitted variants.

After the accepted merge is deployed and exact production settings are configured, the PM performs the final production smoke in Google Chrome on an iPhone: sign in with the enrolled identity, confirm identity display, sign out, and confirm the returned login screen. Preserve language preference and independent sessions. Record only revision, stable URL, iPhone model, tested iOS and Chrome versions, and sanitized outcomes. Installation/offline behavior is deferred.

## Risks / Trade-offs

- Wrong tool versions or drift -> exact supported pins and build-log verification.
- Callback settings confused with Google's redirect -> explicit configuration table and same-phone production smoke.
- Production bytes are rehosted at deployment/unrelated/loopback origins -> exact compile-time canonical-origin enforcement before client construction; previews deny even at canonical. Metadata overrides are prohibited; an assigned-origin change requires a rebuild.
- Unsafe Supabase input broadens CSP -> raw ASCII DNS validation, default-port normalization, repeated header validation, negative parser/header/build regressions.
- Native fallback returns HTML for an absent asset -> exact emitted-file immutable rules, query-aware matching tests, inventory/MIME checks, and hosted confirmation; preserve native SPA behavior.
- Bundle growth exceeds static header limits -> fail at 100 total rules or 2,000 characters per line rather than publish partial policy; reassess before exceeding the supported budget.
- Initial Git linkage publishes an unaccepted branch -> first production build follows the accepted merge to `main`.
- Public hosting is mistaken for broad backend access -> preserve disabled signups, existing authorization, and minimal public inputs.

## Migration Plan

During apply: implement/test static headers, raw URL validation, and canonical-origin policy, write the runbook, pass CI/review, and merge the accepted change into `main`. Then link/configure Pages Free, verify exact toolchain/build/output/metadata and assigned origin, have the PM configure the production Auth table with signups still disabled, inspect actual delivery/headers, and complete the PM phone smoke. Correct stale pending Phase 1 runbook wording without altering archived evidence.

Rollback restores a previously accepted complete `main` production deployment at the same Pages origin; no worker or data migration exists here. On the first release with no prior accepted deployment, stop/disable the failed publication rather than promote a preview build. Leave publication/provider/phone tasks unchecked until actual evidence exists. After acceptance and spec synchronization, proceed to [installable-offline-shell](../installable-offline-shell/proposal.md).

## Execution prerequisites and evidence

Cloudflare account/GitHub repository authorization and the assigned `pages.dev` production hostname remain execution prerequisites. The acceptance target is decided: iPhone with Google Chrome, with actual iOS/Chrome versions and deployed revision recorded during execution. This first increment tests the online Chrome browser shell; the next increment owns Home Screen installation and its manual acceptance. No unresolved product decision remains here.
