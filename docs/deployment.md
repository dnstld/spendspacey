# Cloudflare Pages auth-shell deployment

Change `deploy-auth-shell`, increment 1 of 4. **No Pages project, assigned hostname, deployment, provider configuration, or production PM smoke has been completed by local implementation.** Tasks 2.1–2.4 stay pending until actual execution evidence exists. Cloudflare/GitHub access and the assigned hostname are execution prerequisites.

This increment delivers the existing English/Brazilian Portuguese authentication/identity shell. PWA installation, offline launch, manifest/icons/service worker, profiles, and offline data remain later changes. The phone smoke here is online in Chrome on an iPhone; Home Screen installation begins in change 2.

## Review and publication order

1. Pass synthetic checks, review, and accept the implementation; merge into `main` before linking/enabling the first production build. Pages' GitHub integration can publish immediately when connected. Never publish the feature branch directly to production.
2. The PM authorizes the Pages GitHub integration for this repository on **Cloudflare Pages Free**, limiting GitHub App access to the intended repository. This local implementation does not change repository settings.
3. Explicitly select production branch `main`, configure the static build below, and obtain the assigned `https://<project>.pages.dev` origin. Custom domains/DNS are deferred.
4. The PM configures exact authentication URLs, checks actual hosted delivery, and completes the four-step online phone smoke. CI does not replace these gates.

Every later production build must also originate from an accepted change merged into `main`, with existing review/CI requirements preserved. Do not directly upload/promote a PR preview to production.

## Pages settings

| Setting           | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Hosting           | Cloudflare Pages Free, GitHub integration                |
| Production branch | `main`                                                   |
| Framework         | React/Vite static SPA                                    |
| Project root      | Repository root; leave the root-directory override empty |
| Build image       | Pages v3                                                 |
| Build command     | `pnpm install --frozen-lockfile && pnpm build`           |
| Build output      | `dist`                                                   |
| Node              | Existing root `.node-version`: `24.21.0`                 |
| pnpm selector     | Pages platform toolchain setting `PNPM_VERSION=10.27.0`  |
| Initial origin    | Assigned `https://<project>.pages.dev`                   |

Use the same toolchain pins for optional previews. `PNPM_VERSION` is a nonsecret platform selector, not an application input. Retain `packageManager: pnpm@10.27.0` and the frozen lockfile. Do not rely on platform defaults, `engines`, or lockfile inference. Pages installs dependencies before the build; the explicit install enforces the frozen lockfile again. Vite rejects mismatched Node/pnpm versions on Pages and prints version diagnostics: verify these in the actual build log. `pnpm build` type checks and creates production assets; **do not publish `build:test` output**, which contains synthetic configuration.

Only these two application variables are browser-safe build inputs:

| Application variable            | Placeholder                                  |
| ------------------------------- | -------------------------------------------- |
| `VITE_SUPABASE_URL`             | `https://<supabase-project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_<public-key>`                |

The PM enters public values privately in Pages settings; they are compiled into browser code and are not secrets. Never commit real values or `.env.local`. Extra `VITE_` inputs are rejected before bundling. Never place Google credentials, Supabase secret/service-role keys, database credentials, tokens, or other private values in Cloudflare, source, or build output. GitHub Actions needs no deployment credential. Leave Pages-supplied `CF_PAGES`, `CF_PAGES_BRANCH`, and `CF_PAGES_URL` unmodified; they are not custom application variables. No third `VITE_` input or runtime hostname-derived allowlist is used.

Validate `VITE_SUPABASE_URL` before URL normalization: accept ASCII/Punycode HTTPS DNS hostnames, including custom Auth domains, with an optional root slash and omitted port or explicit `:443` (both normalize to the same origin). Reject wildcards, IP literals, malformed/empty/overlong DNS labels or hosts, underscores, invalid hyphens, trailing dots, Unicode, credentials, non-root paths, queries/fragments, nondefault remote ports, whitespace/control characters, backslashes, percent-encoded ambiguity, and CSP-significant input. Only the separate local artifact permits `http://localhost:54321`, `http://127.0.0.1:54321`, or `http://[::1]:54321` (optional root slash). The header generator revalidates the origin before inserting it in `connect-src`; rejected values never produce headers.

Do not add Pages Functions, Cloudflare Workers, SSR/server runtime, Wrangler application/configuration, Cloudflare databases/storage, or runtime bindings. `build/pages.ts` runs only during Vite builds; its code is not a deployed request handler.

Sources: [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [version overrides](https://developers.cloudflare.com/pages/configuration/build-image/), [GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/).

## Native SPA delivery and headers

Keep `dist/index.html` and **no top-level `404.html`, catch-all `_redirects`, framework adapter, or server handler**. Native Pages SPA fallback serves the entry at direct `/auth/callback` URLs, including query-bearing requests. The client owns PKCE, URL scrubbing, and recovery. Unknown paths may receive generic HTML; missing scripts are not guaranteed to return 404. Check the actual referenced build inventory instead of replacing native fallback.

`public/_headers` is copied into `dist`; Vite substitutes the validated public Supabase origin into CSP and appends exact immutable rules from the emitted bundle inventory, checking that every named file exists with the emitted bytes. Public-directory filenames that merely resemble hashes are not inventory entries. Deploy resolved `dist/_headers`, never the unresolved source template. Pages interprets this static file. Cache rules are disjoint because matching Pages header values are combined:

| Requests                                         | Browser policy                                            |
| ------------------------------------------------ | --------------------------------------------------------- |
| `/`, `/index.html`, unversioned icon/font assets | `Cache-Control: no-cache` (revalidate)                    |
| `/auth/callback`, including query variants       | `Cache-Control: no-store`, `Referrer-Policy: no-referrer` |
| Exact emitted fingerprinted asset paths          | `Cache-Control: public, max-age=31536000, immutable`      |

There is no broad `/assets/*` cache rule. Other fallback paths, including nonexistent hash-looking assets, retain Pages' native revalidation (`public, max-age=0, must-revalidate`), never immutable caching. Pages matches paths independently of query strings: existing fingerprinted assets remain immutable with a query; unmatched paths remain non-immutable with or without one; `/auth/callback` query variants remain no-store. Entry HTML stays revalidating. Every base and generated rule counts against Pages' 100-rule maximum; every line, including base/security/comment lines, is limited to 2,000 characters. Builds fail on either overflow. No custom CDN cache rule is needed. Global static headers apply no-referrer, nosniff, framing denial, and CSP: self-hosted scripts/styles/fonts, only the configured Supabase connection origin, safe HTTPS avatars, no forms/framing/arbitrary inline scripts. Inline style attributes support the existing component library; inline style elements/scripts remain disallowed. Google OAuth navigates the page without an embedded Google script. Retain avatar URL validation and no-referrer handling.

Sources: [native SPA serving](https://developers.cloudflare.com/pages/configuration/serving-pages/), [static headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Production authentication — PM-owned

**New-user signups stay disabled before, throughout, and after production configuration and smoke testing.** Use the existing enrolled PM identity and Auth project. This is not initial enrollment. Do not reopen signups, create/delete identities, change provider scopes/access restrictions, or alter database/RLS to troubleshoot login. Refer missing identity/access findings to the PM.

| Console setting                        | Exact value                                                               |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Google authorized JavaScript origin    | `https://<project>.pages.dev` (origin only)                               |
| Google authorized redirect URI         | `https://<supabase-project-ref>.supabase.co/auth/v1/callback` (unchanged) |
| Supabase Site URL                      | `https://<project>.pages.dev`                                             |
| Supabase Redirect URLs: retain local   | `http://localhost:5173/auth/callback`                                     |
| Supabase Redirect URLs: add production | `https://<project>.pages.dev/auth/callback`                               |
| New-user signups                       | Disabled throughout configuration and smoke                               |

Google's redirect is the Supabase callback; the Pages application callback is a separate Supabase allowlist entry. Add no preview wildcards or arbitrary preview origins/callbacks. Preserve identity-only scopes (`openid email profile`), existing enrollment controls, PKCE ownership, and current-session-only sign-out. The application derives `${window.location.origin}/auth/callback`; no hardcoded localhost or extra production-URL variable is needed. Complete OAuth in the same phone/browser/origin so the verifier remains available. [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls)

## Canonical-origin enforcement and optional previews

Pages supplies `CF_PAGES=1`, the build branch, and `CF_PAGES_URL`. Every Pages build fails if that URL is missing/invalid. Validate the raw URL as an HTTPS DNS origin: default port only, no credentials, query, fragment, or non-root path. Recognize only `<project>.pages.dev` or `<deployment>.<project>.pages.dev`, with valid ASCII DNS labels and no extra subdomain ambiguity. Derive the canonical `https://<project>.pages.dev` from those validated labels at build time. This trusts platform metadata, never the requesting host, an arbitrary runtime input, or a custom origin setting.

Only Pages `main` builds compile a production policy containing that exact canonical origin. The same production artifact denies authentication at deployment-specific hosts, unrelated hosts, and all loopback origins. Preview/non-`main`/missing-branch builds compile a denied policy and remain denied even at the canonical origin. Non-Pages production builds also deny authentication. A separate development/test policy supports only `http://localhost:5173` and `http://127.0.0.1:4173`; `build:test` uses `--mode development` with synthetic inputs. Never publish a local/test artifact or override Pages metadata.

Check the policy before dynamically importing/constructing the Supabase client, so denied launches cannot restore saved sessions or start automatic refresh. Recheck at client construction, session subscription/restoration/retry, sign-in, sign-out, and callback exchange. Denied screens show localized feedback and disabled sign-in, with no displayed identity. Scrub callback query/fragment input even if invalid configuration means no client exists. Only an authorized active origin may construct `${window.location.origin}/auth/callback`. No full build environment or additional public application variable enters client code.

Verify this behavior on an actual preview when one exists. Do not register previews with Google/Supabase, use real accounts there, override metadata to bypass the guard, or promote preview builds to production. Provider allowlists alone do not enforce this client policy; retain backend authorization, exact provider allowlists, disabled signups, and existing access controls. A hostname change requires a new accepted build with valid Pages metadata; custom domains remain deferred.

## Automated verification

Callback recognition uses the same canonical route definition and matching options as application routing, via React Router's `matchRoutes`. This includes case, trailing/multiple-slash, and encoded equivalents. On denied/no-client exits, bootstrap immediately replaces recognized callback URLs with `/auth/callback`, removing query and fragment. Authorized bootstrap leaves input for mounted capture before the same cleanup runs. Cleanup preserves current history state and length through `replaceState`, makes no additional token exchange, and leaves unrelated/near-match URLs unchanged. Keep registered redirects canonical; recognizing variants requires no additional provider URLs or settings.

Use Node 24.21.0/pnpm 10.27.0:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:config
pnpm build:test
pnpm test:delivery
pnpm exec playwright install chromium
pnpm test:e2e
pnpm secret:scan
pnpm spec:validate
```

All test builds override local values with `test/config.ts`; no real project/account is contacted. Configuration checks reject invalid/extra public inputs, unsafe URLs before any output/headers, invalid/missing Pages metadata, and mismatched tooling. NUL cannot pass through OS environment variables and is covered directly by parser/header tests. `test:delivery` compiles the separate local artifact into `dist` and Pages `main`, preview, and missing-branch artifacts into `.cache/deploy-auth-shell/`. It checks complete inventory, CSP, exact immutable paths, query semantics, unmatched fallback paths, and header limits. Run it before `test:e2e`. Secret scanning includes all four artifacts and repository inventory/history.

Chromium uses ports 4173–4175 and one browser engine to verify existing PKCE/identity/sign-out/localization and preview restrictions. A routed HTTPS fixture serves identical production bytes at canonical, deployment-specific, unrelated, and loopback origins, and preview/unclassified artifacts at canonical; denied cases include saved expired sessions and direct callbacks. Assertions cover zero Auth requests and zero SDK-module loads; unit spies prove no client construction, including invalid configuration. Fixtures enforce built CSP using synthetic traffic. The HTTPS provider fixture returns via a fresh navigation because Playwright does not re-route subsequent HTTP redirect-chain requests; localhost coverage retains HTTP 302 behavior. The test header reader models our exact paths/trailing splats, query-independent matching, combined custom headers, and native revalidation; it is not a Pages emulator. Vite preview does not implement Pages header/fallback semantics. Actual hosted routing/MIME/cache headers, settings, and iPhone acceptance remain pending. CI includes the same checks and strict validation without deployment credentials. OpenSpec is a development-only dependency.

## Actual hosted checks — pending

After an accepted `main` build is published, record its revision/origin. Verify HTTPS without a hosting-login/certificate interstitial, direct callback navigation including synthetic query parameters, complete build assets with proper bytes/MIME, entry/unversioned revalidation, exact hashed-asset immutable rules with/without a query, missing `/assets/` paths (including hash-looking names) staying non-immutable with/without a query, and callback no-store/no-referrer including queries. Check actual CSP/nosniff/framing headers and its resolved Supabase origin. Never retain a real callback code/token in commands or evidence. Unknown paths returning generic HTML are expected; that HTML must not count as a valid script. Verify canonical production authentication and denied authentication on its deployment-specific URL; verify previews separately when present. Tasks 2.1–2.3 require actual settings/host evidence, not local fixtures.

## Final PM online smoke — task 2.4

Open the production Pages URL in **Google Chrome on an iPhone** with connectivity and signups disabled throughout:

1. Sign in with the existing enrolled PM identity.
2. Confirm the minimal identity screen: name, email, avatar/fallback, language selector, and sign-out.
3. Sign out.
4. Confirm the returned Spendspacey login screen and its language selector/Google sign-in.

Preserve language preference and independent sessions. Record only URL, deployed revision, iPhone model, tested iOS and Chrome versions, signup-disabled confirmation, and sanitized four-step pass/fail. Do not record addresses, profile values, tokens/codes, storage exports, or real-account traces. Keep task 2.4 unchecked until the PM reports success. Desktop Chromium is supplemental; Safari-specific manual acceptance is not required. Home Screen installation/offline checks belong to change 2.

## Rollback and follow-up

On failure, stop acceptance and diagnose without broadening enrollment or redirects. If an accepted complete `main` production deployment exists, use Pages' production rollback to restore it at the same assigned origin, then repeat delivery/auth checks. Record only the accepted revision and sanitized reason. Never promote a preview or change database/Auth settings as a static rollback. If no accepted deployment exists, the PM disables automatic production deployment and removes/stops the failed publication through Pages project controls, verifying it is no longer served; do not claim rollback success without verification. [Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)

There is no service worker or data migration here; preserve SDK/language storage. Keep the change unarchived while review/merge, configuration, publication, and PM evidence remain pending. Start `installable-offline-shell` only after this increment's acceptance and durable-spec synchronization. `online-profiles` and `offline-profiles` remain planning-only.
