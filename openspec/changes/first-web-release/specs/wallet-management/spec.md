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

Carteiras SHALL show a full-width form for each wallet with a name field, visible read-only currency, its own save action, and an active indicator on the selected wallet. Nova carteira SHALL add an inline creation form. Spendspacey SHALL expose permanent deletion with explicit confirmation for web-created wallets when the authenticated creator is their sole member. The server SHALL recheck both conditions while holding the wallet lock. Both clients SHALL reflect the deletion of shared records.

#### Scenario: Manage an inactive wallet
- **WHEN** the user renames an inactive wallet
- **THEN** the rename appears in its card and selector while the current selection stays active

#### Scenario: Delete a personal wallet
- **WHEN** the verified creator confirms permanent deletion of a web-created wallet and is still its sole member
- **THEN** the wallet and its transactions are removed from the shared data
- **AND** if it was active, the web app selects an available wallet

#### Scenario: Membership changes during deletion
- **WHEN** another member joins a wallet before the server's deletion check
- **THEN** deletion is denied and the wallet and its records remain available
