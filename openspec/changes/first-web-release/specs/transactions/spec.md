# Transactions delta

## Purpose

Let wallet members record and correct spending and income quickly while seeing their transactions and totals for the selected period.

## ADDED Requirements

### Requirement: Period totals and date-grouped history

Transações SHALL show separate, current-period Gastos and Entradas amounts and a newest-first list grouped by local transaction date. Transaction rows SHALL show the category, optional description, amount, and available attribution. Opening a row SHALL open its populated edit form.

#### Scenario: Review a mixed period
- **WHEN** the selected period contains both income and expense records
- **THEN** each contributes only to its corresponding total
- **AND** the list groups rows by date with localized Hoje or Ontem labels when applicable

### Requirement: Contas transaction entry

The form SHALL offer expense or income, a date defaulting to today, calculator-style currency entry, one category, and an optional description. Shared wallets SHALL offer Em nome de for existing members. The form SHALL preserve its draft while the user browses and creates categories or selects a description.

#### Scenario: Enter a transaction for a family member
- **WHEN** a user enters an amount, creates a missing category, and picks another member
- **THEN** the form retains the amount, selects the new category, and the saved transaction records both actor and beneficiary
- **AND** a beneficiary outside the current wallet is rejected

### Requirement: Reusable descriptions are category scoped

Para quê SHALL support one-time typed text and selecting or saving reusable items within the chosen category. A saved item with an expected amount SHALL fill an empty amount field. Changing category SHALL clear the old item link.

#### Scenario: Pick a reusable item with an expected amount
- **WHEN** the user picks a reusable item while the amount field is empty
- **THEN** the item fills the description and amount
- **AND** selecting a reusable item with an amount already entered preserves that amount

### Requirement: Duplicate confirmation and edit recovery

Before creating an expense or income entry, the app SHALL flag existing same-wallet matches by date, amount, and category. The user SHALL be able to return to the draft or explicitly save anyway. A failed save SHALL keep the draft available for deliberate retry.

#### Scenario: Duplicate entry
- **WHEN** a match exists
- **THEN** the confirmation shows the matching transaction's amount, date, category, description, and available attribution
- **AND** only explicit confirmation creates the additional transaction
