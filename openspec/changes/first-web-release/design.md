# Design

## Context

The release branch starts at GitHub main `1549022`, which contains the accepted installable shell and online profile code. The existing checkout has separate offline-profile work and a wallet proposal. The approved visual reference is the frozen [interactive mockup](reference/approved-mockup.html.gz). Decompress it to an HTML file to open the sample-data preview in a browser.

## Goals / Non-Goals

**Goals**

- Deliver the full approved flow locally and on the canonical production origin before the user's hands-on review.
- Reuse the existing authenticated PWA foundation and Contas records within their established authorization boundary.
- Use official shadcn/ui components and capture any remaining browser-specific behavior during review.

**Scope boundaries**

- Production stays on the existing hosted origin and uses its accepted publication and authentication boundaries.
- The phone and desktop review follows deployment. The existing local profile and invitation proposal remains a separate checkout.

## Decisions

### Use official components through their documented interfaces

Use the existing Vite and Tailwind setup and the Radix/New York shadcn registry. Review generated files and dependency changes, and replace the adapted Button and Avatar with official versions. Generated component source remains as supplied. Compose Select, Button, Tabs, Card, Dialog, Sheet, Popover, Field, Input, Badge, Separator, AlertDialog, and Empty as needed through their documented interfaces. Use supported global theme tokens and app-level layout for the Contas mark, palette, Lato typography, fixed chrome, responsive width, and scrolling. Use app-owned form state and domain logic for calculator-style input, search ranking, duplicates, and recovery. Keep the current sign-out entry point discoverable from Carteiras, and preserve the existing sign-in button's provider branding via supported composition.

### Reuse the authenticated root and guard wallet-scoped data

Use the existing root document and callback ownership model. Start the signed-in workspace on Transações and keep workspace destinations within the root lifecycle so the service worker's recognized navigation boundary remains bounded. Use the existing SDK identity as the session authority. Treat offline refresh failures as recoverable, disable API-dependent actions while offline, and clear current private UI state on confirmed rejection or account change. No new durable identity copy, financial response cache, or mutation queue is part of the release. Use account and wallet generation guards so delayed responses cannot cross selection changes.

### Align the web data contract with Contas

Use the configured project's existing Auth, records, read projections, and membership enforcement. Add web entry points for creating wallets and saving transactions. The web creation function uses the existing membership bootstrap trigger and imposes no count ceiling. Wallet visibility is a per-account preference stored in a private web schema. A member can hide a personal wallet and restore it later. Existing Contas definitions, policies, and grants are preserved.

Current member attribution is required by the existing transaction trigger. If the historical beneficiary has left the wallet, the form asks the user to set a current beneficiary or explicitly clear the field. The project owner controls verification and execution of the additive web migration.

### Keep formatting and totals at the domain boundary

Use Brazilian Portuguese translations and local calendar dates for display. Use each wallet's currency convention for amounts. Represent amount math in integer minor units and preserve database date-only values across timezones. Use the same period calculation for transaction totals, category counts and totals, and the category transaction list. Keep the selected period above both finance destinations, allowing Transações to open at the current month per the approved behavior.

## Risks and trade-offs

- The stock Select and modal surfaces can behave differently across devices. Verify baseline operability with automated checks and record device-specific findings after the complete release is deployed. Use other documented stock compositions if a later revision needs them.
- Contas's checked-in migrations may differ from production. Inspect schema and grants without reading private finance rows. Reconcile drift with the migration owner and prove a forward path using synthetic accounts.
- The original shell has extensive worker generation and recovery tests. Timebox product-specific browser tests separately, retain the lifecycle/privacy assertions, and update locale assertions to Brazilian Portuguese. A production rollback must use the documented worker-aware procedure.

## Earlier changes

The archived online-profile change records the accepted behavior at revision `1549022`. Its production and installed-app evidence is in [Online profiles](../../../docs/online-profiles.md). The `offline-profiles` and `ship-installable-offline-profiles` proposals remain visible as unfinished work. This release supersedes their durable profile storage goals for the family workspace. The existing checkout keeps the separate wallet-startup-resolution proposal.

## Migration plan

1. Preserve the current checkout and develop on the clean release worktree. Reconcile the already accepted online-profile closure from the local branch and the historical specs on main before final spec synchronization. Record older plans as historical or superseded without marking unexecuted tasks complete.
2. Verify stock components and web flows with synthetic APIs. The project owner verifies and applies the reviewed web migration before deploying the web client.
3. Pass full synthetic verification and independent review, merge to main, and verify the canonical Cloudflare Pages publication and installed PWA behavior. Rollback uses the prior accepted worker-aware deployment and preserves compatible wallet data.
4. Hand over the deployed release for the user's review, including the long wallet-name case and installed phone flow. Record actual acceptance separately from automated evidence.
