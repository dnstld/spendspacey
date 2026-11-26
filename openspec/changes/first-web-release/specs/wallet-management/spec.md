# Wallet management delta

## Purpose

Give enrolled family members access to their existing wallets and let them manage their own personal wallets from the web.

## ADDED Requirements

### Requirement: Wallet access is membership scoped

An authenticated member SHALL see and use only wallets they currently belong to. The server SHALL enforce membership for wallet and financial operations. The wallet select SHALL display names and switch all dependent data and currency together.

#### Scenario: Access changes
- **WHEN** a previously selected wallet is unavailable to the current account
- **THEN** its financial data is concealed and an available wallet or a create-wallet state is presented

#### Scenario: Switch wallet
- **WHEN** a user selects a wallet they belong to
- **THEN** transaction and category amounts use that wallet's currency and delayed results from the prior wallet cannot overwrite the new view

### Requirement: Personal wallet creation

Wallet creation SHALL require a nonblank name and a currency in BRL, USD, or EUR, with BRL preselected. The web creation contract SHALL impose no wallet count ceiling. A confirmed creation SHALL select the new wallet. Currency SHALL remain immutable after creation.

#### Scenario: Create a fourth wallet
- **WHEN** a member with three wallets creates a wallet with a name and EUR
- **THEN** exactly one wallet is created with membership for that account and it becomes active with EUR

### Requirement: Independent wallet settings

Carteiras SHALL show a full-width form for each wallet with a name field, visible read-only currency, its own save action, and an active indicator on the selected wallet. Nova carteira SHALL add an inline creation form. Eligible personal wallets SHALL expose a hide action with explicit confirmation. Hidden wallets SHALL remain in Carteiras with a restore action. The visibility preference SHALL apply to the current account in the web app only. Shared wallets SHALL have no hide action.

#### Scenario: Manage an inactive wallet
- **WHEN** the user renames an inactive wallet
- **THEN** the rename appears in its card and selector while the current selection stays active

#### Scenario: Hide a personal wallet
- **WHEN** the user confirms hiding a personal wallet and the server confirms it
- **THEN** that wallet disappears from the account's web selector and its records remain intact
- **AND** if it was active, the app selects an available wallet

#### Scenario: Restore a hidden wallet
- **WHEN** the user restores a hidden wallet from Carteiras
- **THEN** that wallet becomes available in the account's web selector
