# First Spendspacey web release

## Contas integration

The Contas repository owns the existing wallet and finance schema. Its linked project and the existing Spendspacey deployment use the same Supabase project. The enrolled-user and disabled-signup boundary is recorded in the [hosted authentication acceptance](deploy-auth-shell-acceptance.md).

Read-only hosted metadata confirmed the current schema migration at `20260809120000`, membership and date-only transaction projections, member attribution fields, the currency immutability trigger, and the existing three-wallet limit. No finance or account rows were read for schema verification.

The application reads wallet membership scoped to the signed-in user and lets existing Contas policies authorize wallet and finance operations. The wallet member function supplies available names for transaction attribution. Only completed transactions count toward period totals. Reusable descriptions are scoped by wallet and category.

The [release migration](../supabase/migrations/20261125120000_spendspacey_web_wallets.sql) adds the web wallet functions and a transaction save function. The Contas creation and shared-wallet deletion functions keep their behavior. The web create function reuses the wallet bootstrap trigger and accepts a request ID for safe retry. The web delete function locks the wallet, checks eligibility in the same transaction, and removes dependent transactions before deleting the wallet. Authenticated clients may update the wallet name and display preference. Creator identity is protected from client updates, and existing creator values are carried forward. The transaction function uses the authenticated actor, checks the expected account, and compares the saved payload on a retry. An edit keeps the recorded beneficiary when that field is untouched. New beneficiary assignments require current membership.

A disposable local Supabase database ran the full checked-in Contas migration history and the web migration. The [rollback-only SQL test](../supabase/tests/web_wallets.sql) covered the web fourth wallet, legacy limit, invalid currency, immutable currency, unauthenticated grants, denied shared deletion and non-owner deletion, and deletion of a personal wallet containing a linked transaction. Production database review and rollout remain separate steps. Coordinate the migration history with the Contas repository before using its migration push again.

## Release sequence

1. Complete the app checks and independent review.
2. Wait for the project owner to apply the reviewed forward migration to the verified Supabase project. Confirm the functions and grants through metadata. Preserve existing signup and RLS configuration.
3. Publish the approved main revision through the existing [Cloudflare Pages workflow](deployment.md).
4. Check the production origin, worker, sign-in path, and asset delivery. Record the user's separate desktop and installed-phone acceptance after deployment.

The brand mark can fall back to the existing cached app icon. Both Lato weights are embedded in the precached workspace stylesheet so offline launch loads the same fonts. The worker retains its existing static content policy, including precached executable chunks, styles, and Google sign-in assets. The finance client does not cache account or wallet responses for offline access.

Wallet access is rechecked immediately on reconnect and foregrounding. Visible sessions also check every 30 seconds, with a 10-second request deadline. The previous wallet is hidden during foreground and reconnect checks and stays hidden when a check fails or no longer grants access. Drafts remain in memory during temporary access errors and reopen after access is confirmed. A successful check that excludes the wallet clears its draft. Roster changes refresh beneficiary choices in open drafts.
