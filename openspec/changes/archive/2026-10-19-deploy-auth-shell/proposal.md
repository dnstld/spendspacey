# Proposal

## Why

Spendspacey's localized authentication shell only runs locally. Publish that product surface on Cloudflare Pages Free so the PM can sign in and out in Chrome on an iPhone before installation or profile features are added.

## What Changes

- Sequence **1 of 4**, after completed Phase 1. Replaces the deployment portion of [the superseded combined plan](../../ship-installable-offline-profiles/proposal.md).
- Use Cloudflare Pages Free with GitHub repository integration, production branch `main`, repository root, React/Vite static output `dist`, and the existing pnpm build script. Pin Node `24.21.0` and pnpm `10.27.0` through supported Pages configuration.
- Start with the assigned production `https://<project>.pages.dev` origin. Preserve native Pages SPA fallback for direct `/auth/callback`; add appropriate static response headers.
- Supply only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as application build variables. Toolchain selectors are separate nonsecret platform configuration; no private credentials belong in Cloudflare.
- Record exact Google-origin, Google-to-Supabase redirect, Supabase Site URL, and local/production application callback settings. Keep new-user signups disabled and derive the application callback from the current origin.
- Deploy production only from accepted changes merged into `main`. PR previews are optional and must not enable Google sign-in on arbitrary preview URLs.
- Derive a canonical-origin policy from validated Pages `CF_PAGES_URL`, failing Pages builds with missing/invalid metadata. Production artifacts authorize only the exact canonical origin; deployment-specific, unrelated, and loopback rehosting deny Auth before client construction. Preview/unclassified artifacts deny everywhere; separate local development/test artifacts retain localhost support. Provider allowlists alone are insufficient.
- Validate raw Supabase DNS origins before normalization/CSP generation. Generate immutable headers only for existing emitted fingerprinted files, with query-independent Pages matching and enforced 100-rule/2,000-character limits; missing/fallback paths remain non-immutable.
- Require synthetic CI, actual hosted delivery checks, and the PM's final online production sign-in, identity-display, sign-out, and returned-login-screen smoke test in Chrome on an iPhone, recording tested iOS and Chrome versions. Document static rollback.
- Share callback route metadata between routing and early `matchRoutes` recognition. Scrub all router-recognized variants on denied/no-client exits while preserving authorized capture-before-cleanup, history state/length, and unrelated URLs.

No manifest, browser service worker, installation guarantee, profile query, private application persistence, mutation, schema/RLS change, new Auth project, custom domain, or expense feature is included. Cloudflare Functions, Workers, server runtime, Wrangler application, and Cloudflare database/storage products are excluded. This plan configures or publishes nothing.

## Capabilities

### New Capabilities

- `web-delivery`: Static production delivery, restricted previews, exact authentication configuration, safe headers, and real-phone online acceptance.

### Modified Capabilities

None. Existing `user-auth` and `localization` behavior remains applicable at authorized origins; the client derives its callback from the authorized active origin. Origin restrictions belong to delivery, while canonical production and separate local authentication retain the existing contract.

## Impact

Work touches Pages project settings, static header generation, a canonical-origin authentication policy, raw URL validation, deployment documentation, and focused synthetic/hosted verification. Reuse the frozen lockfile, existing Linux CI, and exactly two public Supabase inputs; platform-supplied origin metadata is not a third application variable. Add no application dependency or database operation. Reviewer corrections supersede the initial preview-boolean guard and broad immutable asset rule; native SPA fallback remains unchanged.

Completion unblocks [installable-offline-shell](../../installable-offline-shell/proposal.md), followed by [online-profiles](../../online-profiles/proposal.md) and [offline-profiles](../../offline-profiles/proposal.md). The latter two display only the current user's read-only profile. Cloudflare/GitHub access and the assigned `pages.dev` hostname remain execution prerequisites, not unresolved product decisions. Home Screen installation is introduced and manually accepted in change 2.
