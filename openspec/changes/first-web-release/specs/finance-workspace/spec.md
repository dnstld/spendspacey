# Finance workspace delta

## Purpose

Provide a consistent, mobile-first workspace for reviewing and managing the selected wallet's records.

## ADDED Requirements

### Requirement: Fixed wallet and period controls

The signed-in workspace SHALL place the logo, active wallet selector, and applicable period selector in a fixed header aligned to the main content. The main content SHALL occupy at most one-third of the app width in the wide desktop layout and use the available width on phones.

#### Scenario: Scroll while browsing transactions or categories
- **WHEN** the user scrolls a transaction or category list
- **THEN** the wallet and period controls remain visible
- **AND** only the transaction rows scroll within Transações, leaving the period controls and totals in place

#### Scenario: Open wallet management
- **WHEN** the user opens Carteiras
- **THEN** the header shows the wallet selector and the period selector is hidden

### Requirement: Floating navigation and transaction creation

The workspace SHALL expose Transações, Categorias, and Carteiras in a floating bottom navigation pill. The pill SHALL use accessible icon-only controls on phones and include text labels on desktop. Transações SHALL offer a separate add-transaction button to the right of the navigation pill.

#### Scenario: Navigate on a phone
- **WHEN** the user selects a new destination in the pill
- **THEN** the destination opens and the active item is indicated using visual and accessible state

### Requirement: Shared calendar period selection

The period picker SHALL support Hoje, Este mês, Este ano, Últimos 7 dias, and a historical year with either a month or Ano todo. Transações SHALL open with the current calendar month selected. Within Categorias, changing category type SHALL retain the period. Period boundaries SHALL use the user's local calendar.

#### Scenario: Select a historical month
- **WHEN** the user chooses a year and month in the picker
- **THEN** the picker closes and the results reflect that period for the active wallet

### Requirement: Recoverable workspace states

Empty and error states SHALL present an illustration, title, description, and a relevant action where available. Requests requiring connectivity SHALL be unavailable while the app knows it is offline. A failed save SHALL retain the transaction draft and permit a deliberate retry when connectivity is available.

#### Scenario: Load or save fails
- **WHEN** a network failure prevents loading or saving
- **THEN** the affected surface presents localized recovery feedback and a usable retry action when applicable
