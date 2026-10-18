# Spendspacey

An offline-first personal expense tracking PWA. Phase 1 establishes the localized authentication shell.

The PM-owned development enrollment and four-step sign-in/sign-out smoke are in [the authentication runbook](docs/development-auth.md). The PM confirmed both complete; sanitized evidence is recorded in the [archived change tasks](openspec/changes/archive/2026-10-17-bootstrap-localized-auth-shell/tasks.md).

Use Node **24.21.0** (see `.node-version`) and **pnpm 10.27.0**.

```sh
pnpm install --frozen-lockfile
```

Run all automated checks from a clean checkout without configuring a cloud project:

```sh
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

`build:test`, `test:delivery`, `test:unit`, and `test:e2e` explicitly supply synthetic public configuration from `test/config.ts`, overriding local public values. No real Supabase/Google credentials, account information, or session data are used. `test:config` verifies invalid/extra public configuration and Pages toolchain failures. `spec:validate` uses the pinned development OpenSpec CLI.

`secret:scan` downloads **Gitleaks 8.30.1** on first use, verifies its pinned SHA-256 checksum, and caches it in ignored `.cache/`. It scans the entire proposed Git file inventory, including untracked OpenSpec initialization files, the production build, and Git history with redacted output. It supports macOS/Linux on x64/arm64. Do not commit caches, browser reports/storage exports, `.env.local`, or build output.

Browser checks use **Chromium only** with synthetic Pages production, preview, and missing-branch builds on ports 4173–4175. Run `build:test` and then `test:delivery` before `test:e2e`. Browser fixtures intercept Auth and avatar requests, reject unexpected external requests, and use no real account or OAuth service. Restoration/reload, language persistence, cancellation/recovery, and signup-disabled unknown-user behavior are automated; the final PM smoke remains only enrolled-identity sign-in/sign-out and confirmation of the two screens.

For PM-owned manual development, copy `.env.example` to ignored `.env.local`, fill only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` privately, then run `pnpm dev`. These are public browser values. Never put a Google secret, Supabase secret/service-role key, password, or session token in a tracked file or any `VITE_` variable. Development startup/build reject invalid configuration without printing values. The manual server uses exactly `http://localhost:5173` and fails if that port is occupied. The PM already completed initial enrollment. Keep signups disabled during existing-identity development and production configuration/smoke; the runbook's enrollment instructions are historical.

The Phase 1 PR includes the existing `openspec/config.yaml`, spec/archive placeholders, `.agents/skills/openspec-*` skills, `.agents/skills/.openspec-target`, and the `bootstrap-localized-auth-shell` change artifacts.

Language resolution uses a valid explicit `spendspacey.locale` preference first, then device languages in order, then English. Every Portuguese variant maps to Brazilian Portuguese. Only an explicit language change is persisted; without one, each launch reevaluates the device. Blocked preference storage does not prevent changing the current page language. Both translation resources are bundled and typed; no translation network service is used.

GitHub Actions runs quality/build/delivery/Chromium/secret/strict OpenSpec checks in one Linux job on PRs against `main` and pushes to `main`. Its configuration is synthetic, action references are pinned commits, and it performs no deployment.

Phase 1 excludes expense content, dashboards, editable profiles, application database tables/migrations, PWA installation, service workers, Dexie, offline databases/synchronization, deployment, production callbacks, and extra login methods. There is no offline-launch or offline-authentication guarantee. Supabase-managed Auth records are expected. The Phase 1 change is archived with all 19 tasks complete; its capability specifications are in `openspec/specs/`.

The Google sign-in icon and the 23 KB Google Sans Latin font are bundled locally, so rendering the button needs no Google script/font request. Asset sources and licenses are in [third-party notices](docs/third-party-notices.md).

The first Phase 2 increment prepares **Cloudflare Pages Free** static delivery. See the [deployment runbook](docs/deployment.md) for exact GitHub/main, Node/pnpm, public inputs, native SPA fallback, preview restrictions, provider callbacks, iPhone/Chrome smoke, and rollback. Pages builds on a non-`main` or missing branch disable Google sign-in and callback exchange with localized feedback; local development remains enabled. No external host/provider setup or publication is performed by the local implementation, and production PM evidence remains pending. The later PWA/profile increments remain planning-only.
