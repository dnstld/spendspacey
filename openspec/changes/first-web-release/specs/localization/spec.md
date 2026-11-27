# Localization delta

## ADDED Requirements

### Requirement: Brazilian Portuguese is the application locale

The app SHALL use Brazilian Portuguese for all application-owned interface text regardless of browser preferences or legacy saved language values. Calendar labels and dates SHALL use Brazilian Portuguese, and money SHALL use formatting for the active wallet's currency.

#### Scenario: Browser or saved value is English
- **WHEN** the browser prefers English or a prior version saved an English setting
- **THEN** the first application render and subsequent feedback use Brazilian Portuguese

#### Scenario: Currency changes with the wallet
- **WHEN** the user changes to a wallet with a different currency
- **THEN** the amounts use the currency-specific symbols, placement, and spacing for BRL, USD, or EUR
- **AND** interface language remains Brazilian Portuguese

## MODIFIED Requirements

### Requirement: Localized UI is ready before display

The application SHALL bundle Brazilian Portuguese and complete localization initialization before rendering application UI. All application-owned labels, loading/error feedback, accessible names, and document title SHALL use Brazilian Portuguese. The document language SHALL be `pt-BR`.

#### Scenario: First render
- **WHEN** the application launches
- **THEN** the first render uses Brazilian Portuguese without untranslated keys or an English-first flash
- **AND** the document language is `pt-BR` and its title is localized

#### Scenario: Language changes in place
- **WHEN** the browser language preference changes while the application is open
- **THEN** the interface continues in Brazilian Portuguese and retains its current application state

#### Scenario: External identity and provider pages
- **WHEN** user identity information or an external Google consent page is displayed
- **THEN** the application does not translate the person's name or email or claim control over Google's interface language

### Requirement: Translation access and resource parity are checked

Unknown translation keys SHALL fail static checking. Automated validation SHALL reject invalid or empty application messages and ensure required interpolation values are supplied.

#### Scenario: Invalid translation key
- **WHEN** application code refers to a key absent from the Brazilian Portuguese resource
- **THEN** the type-checking command fails

#### Scenario: Translation resources drift
- **WHEN** a required message is empty or an interpolation value is missing
- **THEN** resource validation fails and identifies the affected key

## REMOVED Requirements

### Requirement: Resolve supported device languages deterministically
**Reason**: The first web release uses Brazilian Portuguese across device settings.
**Migration**: Initialize the interface with `pt-BR`.

### Requirement: Persist only explicit language choices
**Reason**: The fixed application language supersedes the language selector.
**Migration**: Ignore legacy stored selections.

### Requirement: English remains the translation fallback
**Reason**: The sole application resource is Brazilian Portuguese.
**Migration**: Keep the Brazilian Portuguese resource complete and enforce its validity in CI.
