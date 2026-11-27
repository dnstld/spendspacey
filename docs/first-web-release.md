# First Spendspacey web release

## Contas integration

The Contas repository owns the existing wallet and finance schema. Its linked project and the existing Spendspacey deployment use the same Supabase project. The enrolled-user and disabled-signup boundary is recorded in the [hosted authentication acceptance](deploy-auth-shell-acceptance.md).

Read-only hosted metadata confirmed the current schema migration at `20260809120000`, membership and date-only transaction projections, member attribution fields, the currency immutability trigger, and the existing three-wallet limit. No finance or account rows were read for schema verification.

The application reads wallet membership scoped to the signed-in user and lets existing Contas policies authorize wallet and finance operations. The wallet member function supplies available names for transaction attribution. Only completed transactions count toward period totals. Reusable descriptions are scoped by wallet and category.

The [proposed web migration](../supabase/migrations/20261125120000_spendspacey_web_wallets.sql) adds dedicated web RPCs for wallet creation, deletion, member and creator lookup, and transaction save. It uses the existing shared records, grants, policies, and integrity rules. The web client calls no native client RPCs. Keep the shared schema, membership bootstrap, RLS helpers, and attribution triggers when retiring native-only endpoints.

Web wallet creation records the authenticated creator in a private table and accepts a request ID for safe retries. The private record is cleaned up when a wallet is deleted through either app. Spendspacey allows permanent deletion when it can verify the caller created the wallet through Spendspacey and is still its sole member. The deletion RPC locks the wallet before checking membership and removes its transactions and the wallet in one transaction. The deletion is visible in both apps. Existing Contas wallets remain available for selection, renaming, and finance edits in Spendspacey.

Transaction saves use existing Contas policies and triggers. The web RPC checks the expected account and compares the saved payload on a retry. An edit keeps a current beneficiary if the field is untouched. When the recorded beneficiary has left the wallet, the web form asks the user to choose a current member or explicitly clear the beneficiary before saving.

The web browser suite uses synthetic API fixtures. The revised migration and [rollback-only SQL checks](../supabase/tests/web_wallets.sql) await database verification under the project owner's control.

## Release sequence

1. Complete the app checks and independent review.
2. Wait for the project owner to verify and apply the reviewed web migration. Confirm its new functions and grants through metadata.
3. Publish the approved main revision through the existing [Cloudflare Pages workflow](deployment.md).
4. Check the web production origin, worker, sign-in path, and asset delivery. Record the user's desktop and installed web app acceptance after deployment.

The brand mark can fall back to the existing cached app icon. Both Lato weights are embedded in the precached workspace stylesheet so offline launch loads the same fonts. The worker retains its existing static content policy, including precached executable chunks, styles, and Google sign-in assets. The finance client does not cache account or wallet responses for offline access.

Wallet access is rechecked immediately on reconnect and foregrounding. Visible sessions also check every 30 seconds, with a 10-second request deadline. The previous wallet is hidden during foreground and reconnect checks and stays hidden when a check fails or no longer grants access. Drafts remain in memory during temporary access errors and reopen after access is confirmed. A successful check that excludes the wallet clears its draft. Roster changes refresh beneficiary choices in open drafts.
