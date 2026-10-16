# Development authentication and PM acceptance

OpenSpec change: `bootstrap-localized-auth-shell`. **Tasks 6.2 and 6.3 require the PM and remain pending.** Automated development does not create, configure, or modify Google or Supabase projects.

## Development configuration (PM-owned)

Use a dedicated **development** Supabase project. Keep Google OAuth in **Testing**, with only the PM's Google account listed as a test user. Enable only the Google login provider; disable email/password, anonymous sign-in, and other providers. Request only `openid`, email, and profile scopes. Do not request Google offline access, use One Tap, or add another application login method.

Configure these two different redirects:

| Setting                               | Development value                                                                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Google authorized JavaScript origin   | `http://localhost:5173`                                                                                                                         |
| Google authorized redirect URI        | The development Supabase project's callback from its Google provider settings: `https://<development-project-ref>.supabase.co/auth/v1/callback` |
| Supabase Site URL                     | `http://localhost:5173`                                                                                                                         |
| Supabase allowed application redirect | Exactly `http://localhost:5173/auth/callback`                                                                                                   |

Store the Google client ID/secret only in the relevant provider consoles. Copy `.env.example` to ignored `.env.local` and privately fill only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Use a modern publishable key, never a secret/service-role key or legacy JWT key. Public Vite configuration is bundled into the browser; changing it requires restarting Vite/rebuilding.

The local command `pnpm dev` binds to localhost port **5173** and fails if the port is occupied. Use the same browser, origin, and device throughout OAuth because PKCE requires the stored verifier. No production, preview, wildcard callback, deployment, or database migration is needed. Production deployment/callbacks are deferred to Phase 2.

## Initial enrollment and access restriction — Task 6.2

[Google exempts identity-only scopes from testing-user restrictions](https://support.google.com/cloud/answer/15549945?hl=en). Listing only the PM in Testing does **not** by itself restrict basic identity authentication. Use Supabase's [new-signup setting](https://supabase.com/docs/guides/auth/general-configuration) and managed Auth inventory as operational restriction evidence.

1. Keep Supabase **Allow new users to sign up** enabled while the PM completes the first successful Google sign-in.
2. Confirm the enrolled PM Google identity exists in **Supabase Auth**. A browser redirect alone is not confirmation.
3. Inspect the inventory. If an unexpected identity exists, **stop for PM resolution**. Never delete or alter unexpected identities automatically. Continue only after the PM resolves the inventory and confirms only the expected PM identity remains.
4. Only after identity confirmation and resolved inventory review, disable **Allow new users to sign up**.
5. Confirm and record, without account details, that signups are disabled and the Auth inventory is PM-only. These settings are the operational evidence that new identities cannot enroll. No second/unknown Google identity login is required.
6. Prepare a signed-out application state for the final smoke. Keep signups disabled throughout that smoke.

### Enrollment recovery

- If initial Google authentication fails **before the PM identity exists**, keep signups **enabled** while the PM corrects OAuth configuration.
- If signups were disabled prematurely and the PM is absent from Auth, temporarily **re-enable** them, enroll the PM successfully, confirm the identity, review the inventory, and disable signups again only after the inventory review is resolved.
- Unexpected identities always require PM resolution; never delete them automatically.
- Once the PM identity is confirmed and inventory resolved, keep signups disabled while diagnosing subsequent existing-identity login failures. Do not reopen enrollment merely because a later smoke step fails.
- Never leave the signup setting blocking the PM's initial enrollment. After recovery, inspect the disabled-signup setting/PM-only inventory and repeat only the four-step smoke below. Automated checks still must pass.

No application tables, profile record, custom access hook, frontend email allowlist, or extra environment variable is involved.

## Final manual application smoke — Task 6.3

After automated checks and Task 6.2 pass, the PM performs **only** these four application acceptance steps at `http://localhost:5173`, with signups disabled throughout:

1. Sign in with the enrolled PM Google identity.
2. Confirm the minimal authenticated identity screen appears: Google name, email, avatar/fallback, language selector, and sign-out button.
3. Sign out.
4. Confirm the signed-out Google-login screen appears: Spendspacey identity, language selector, and Google sign-in button.

Record sanitized pass/fail evidence only. Do not capture account addresses, profile details, tokens, callback codes, browser storage exports, or real-account traces in the repository/PR. Do not check off 6.2/6.3 until their PM work actually passes; do not archive the change beforehand.

## Automated boundary

Session restoration/reload, explicit language persistence through redirects/sign-out, callback cancellation/recovery, and signup-disabled error handling for unknown synthetic identities are automated unit/component/Chromium checks. They are not extra PM smoke requirements. Tests use synthetic public configuration, static Auth response fixtures, and the real client at request boundaries; they neither authenticate a second real identity nor test Supabase internals. Disabled signups plus PM-only inventory supply the operational restriction evidence.

Phase 1 adds no expense/dashboard/profile UI, application database tables, PWA installation, service worker, Dexie, offline database/synchronization, deployment, or additional login method. There is no offline-launch/authentication guarantee. Supabase-managed Auth records are expected.
