# Transaction categories delta

## Purpose

Organize wallet transactions and let users review activity by spending and income category for a selected period.

## ADDED Requirements

### Requirement: Category cards show period activity

Categorias SHALL display Gastos and Entradas tabs, a Nova categoria action, and two columns of cards. Each card SHALL show the category name, total, and number of transactions for the selected period. Cards SHALL sort by total descending with zero-activity categories last. The sole period picker SHALL stay in the fixed app header.

#### Scenario: Switch periods and tabs
- **WHEN** the user chooses a historical period and switches from Gastos to Entradas
- **THEN** each amount and count reflects the selected wallet, period, and type
- **AND** categories with zero matching transactions remain available

### Requirement: Category creation and editing

Nova categoria SHALL open a Contas-style form with Despesa selected by default, a Receita option, a focused name field, and an explicit create action enabled for a nonblank name. The app SHALL support renaming, archiving, and restoring categories. Archived categories SHALL remain attributable on past transactions.

#### Scenario: Add a new income category
- **WHEN** the user changes the form to Receita, supplies a name, and confirms
- **THEN** the app shows the created category in Entradas with zero activity

#### Scenario: Create from the transaction form
- **WHEN** the user creates or restores a matching category through the picker
- **THEN** that category is selected and the transaction draft remains intact

### Requirement: Category cards expose independent actions

Each card SHALL expose separate edit and show-transactions buttons. Show-transactions SHALL open a modal limited to that category, wallet, and period, using the transaction list's date groups and localized empty feedback.

#### Scenario: Review a category with records
- **WHEN** the user opens a card's transaction list
- **THEN** the modal shows only matching records and the selected period
- **AND** closing the modal returns focus to the card action where available
