# First Spendspacey web release

## Why

Spendspacey already delivers a hosted, installable sign-in and profile shell. The approved mobile-first web design brings the everyday Contas transaction and wallet workflows to that shell for the existing family accounts.

## What Changes

- Build the approved Transações, Categorias, and Carteiras screens with the stock Radix/New York shadcn/ui components. Use the fixed wallet and period controls, three-destination floating menu, separate add button, and centered desktop content column from the approved mockup.
- Show current-period expenses and income totals, date-grouped transactions, and the Contas add/edit flow. Include duplicate confirmation, reusable descriptions with expected-amount autofill, and recording on behalf of an existing wallet member.
- Add period-scoped category totals and transaction counts, a two-column card grid, category creation and editing, and a filtered transaction modal for each category.
- Let existing members select wallets and create named wallets with immutable BRL, USD, or EUR currency. Default new wallets to BRL and select them after creation. Support renaming and eligible personal-wallet deletion. Remove the wallet creation ceiling for the web flow through the authorized backend contract.
- **BREAKING** Use Brazilian Portuguese for the entire application, removing English selection and fallback. Continue formatting amounts according to each wallet's currency.
- Preserve a signed-in experience during connectivity loss, with a reconnect notice and unavailable API actions. Keep private financial data out of durable browser caches and write queues.
- Release scope excludes invitations and membership administration, shared-wallet deletion, the Para onde vai screen, charts, balance, monthly goals, forecasts, and recurrence scheduling. Reusable descriptions belong to a single category.

## Capabilities

### New Capabilities

- `finance-workspace` covers signed-in layout, wallet and period controls, spend and income totals, and recovery states.
- `wallet-management` covers existing membership access and the personal-wallet lifecycle.
- `transactions` covers transaction history, entry, editing, attribution, duplicate handling, and reusable descriptions.
- `transaction-categories` covers expense and income categories, period totals and counts, and category transaction drilldown.

### Modified Capabilities

- `localization` establishes Brazilian Portuguese as the sole app locale and defines currency-specific number formatting.
- `user-profile` places the existing read-only own-profile card in Carteiras.
- `user-auth` extends offline session continuity into the authenticated workspace and aligns authentication controls with the sole app locale.
- `installable-app` aligns offline shell and new release acceptance with Brazilian Portuguese.
- `web-delivery` aligns hosted callback acceptance with the sole app locale.

## Impact

The release changes the React shell, shadcn component sources and theme, typed localization, transaction and wallet data access, synthetic browser fixtures, and release checks. It uses the established Contas authorization boundary and the canonical Cloudflare Pages deployment. The legacy wallet creation ceiling is a backend compatibility issue to verify and resolve before release. The offline-profile and invitation-heavy work are outside this release and their local work is preserved.
