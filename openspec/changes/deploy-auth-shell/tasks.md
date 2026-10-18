# Tasks

Change 1/4. Local implementation is authorized; external execution remains pending. Target Cloudflare Pages Free; no PWA, profiles, private data persistence, backend mutation, schema/RLS change, or Cloudflare runtime/storage product belongs here.

## 1. Delivery configuration and verification

- [x] 1.1 Prepare minimal Pages static header configuration and a documented settings table: GitHub integration, production branch `main`, repository root, React/Vite static build, `pnpm install --frozen-lockfile && pnpm build`, output `dist`, Pages v3, existing `.node-version=24.21.0`, and `PNPM_VERSION=10.27.0`. Verify production build and published-file inventory, no top-level `404.html` or catch-all rewrite, native SPA callback fallback, proper MIME/security/cache headers, and no Functions, Workers, server runtime, Wrangler application, or Cloudflare database/storage products.
- [x] 1.2 Add a fail-closed preview-authentication guard derived from Pages' supplied build metadata, with localized feedback and no new custom application variable. Verify synthetic production/local sign-in and callback behavior remain usable while preview/missing-branch builds start neither Google OAuth nor callback exchange; do not register preview/wildcard URLs.
- [x] 1.3 Write the Pages/provider/phone/rollback runbook with the exact design tables, public-input/private-credential boundary, accepted-merge-to-`main` production policy, optional restricted previews, native fallback, and deferred custom domain. Verify local callback retention and Google/Supabase URL distinctions, keep signups disabled throughout, and correct stale Phase 1 wording without altering archived evidence.
- [ ] 1.4 Run existing format/lint/type/unit/config/synthetic-build/Chromium/secret checks and strict change validation. Verify focused guard/delivery tests pass, no private inputs/fixtures or unrelated features are bundled, and CI remains synthetic without deployment credentials. Obtain review/acceptance and merge the accepted delivery work into `main` before production publication.

## 2. PM-owned production configuration and acceptance

- [ ] 2.1 After the accepted merge, authorize the Pages GitHub integration for this repository and configure Cloudflare Pages Free with production `main`, root project, static pnpm build, and `dist`. Set the nonsecret pnpm toolchain selector and only `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` as application build variables; never place Google credentials, Supabase secret/service-role keys, database credentials, or other private values in Cloudflare. Verify Node `24.21.0`/pnpm `10.27.0` in build logs, deployed accepted `main` revision, and assigned `https://<project>.pages.dev` production origin. Keep custom domains deferred and do not promote a preview.
- [ ] 2.2 Have the PM set Google's authorized JavaScript origin to the production Pages origin while retaining Google's redirect URI `https://<supabase-project-ref>.supabase.co/auth/v1/callback`; set Supabase Site URL to the production Pages origin, retain `http://localhost:5173/auth/callback`, and add exact `https://<project>.pages.dev/auth/callback`. Verify new-user signups remain disabled before, during, and after configuration/smoke; current-origin client callback, existing scopes/enrollment, no preview wildcards, and no record/policy changes.
- [ ] 2.3 Verify actual production reachability, native direct callback fallback including query-bearing requests, build-asset bytes/MIME, HTML revalidation, callback no-store/no-referrer, hashed-asset caching, and security headers without a hosting-login/certificate interstitial. If previews are enabled, verify Google sign-in/callback exchange are unavailable there. Record sanitized revision/URL/header outcomes; local Vite preview is insufficient.
- [ ] 2.4 Have the enrolled PM perform the final online production smoke in Google Chrome on an iPhone: sign in, confirm identity display, sign out, and confirm the returned login screen, with language preference preserved. Verify sanitized iPhone model/tested iOS and Chrome versions/revision/URL/pass-fail evidence and static rollback instructions; leave incomplete until the PM report passes and confirm signups stayed disabled.

## Local execution evidence

Tasks 1.1–1.3 are complete for local configuration, synthetic build/browser checks, and documentation. Actual Pages settings, assigned hostname, hosted MIME/routing/headers, provider configuration, publication, and PM iPhone smoke remain unverified under tasks 2.1–2.4. Task 1.4's local checks pass, but its required review/acceptance and merge into `main` remain pending, so its checkbox stays unchecked. See [the local verification record](../../../docs/deploy-auth-shell-verification.md).

## Workflow follow-up

- Review and accept the published increment, then synchronize its durable specs through the appropriate sync/archive workflow.
- Only after publication, phone acceptance, integration, and spec synchronization begin `installable-offline-shell`, followed by `online-profiles` and `offline-profiles`.
