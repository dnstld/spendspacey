# Spec Delta

## Purpose

Present Spendspacey consistently in English or Brazilian Portuguese using device preferences until the user explicitly chooses a language, with translations available locally and checked for completeness.

## ADDED Requirements

### Requirement: Resolve supported device languages deterministically

The application SHALL support only `en` and `pt-BR`. Without a valid explicit preference, it SHALL reevaluate device languages in preference order at each launch, mapping English variants to `en` and every Portuguese variant to `pt-BR`. If none matches, it SHALL use English.

#### Scenario: Brazilian and non-Brazilian Portuguese
- **WHEN** the first supported device preference is `pt`, `pt-BR`, `pt-PT`, or another Portuguese locale
- **THEN** the application selects canonical locale `pt-BR`

#### Scenario: Ordered device preferences
- **WHEN** device preferences are `fr-FR`, `en-GB`, and `pt-BR`, with no explicit selection
- **THEN** the unsupported French preference is skipped and English is selected

#### Scenario: Unsupported or unavailable device preferences
- **WHEN** there is no valid explicit preference and device preferences are empty, unavailable, or all unsupported
- **THEN** the application selects `en`

#### Scenario: Device preferences change between launches
- **WHEN** the user has never explicitly selected a language and their device preference changes from English to Portuguese before the next launch
- **THEN** the next launch selects `pt-BR` without a previously detected language overriding it

### Requirement: Persist only explicit language choices

The application SHALL offer English and Brazilian Portuguese selection in signed-out, signed-in, and callback/recovery views. It SHALL persist only a user's explicit selection and prefer a valid persisted selection over device detection. Authentication actions SHALL preserve this preference.

#### Scenario: Explicit preference overrides the device
- **WHEN** the user explicitly selects `pt-BR` on an English device and reloads
- **THEN** Brazilian Portuguese remains selected

#### Scenario: Detection does not create a preference
- **WHEN** a language is selected through device matching or English fallback
- **THEN** the application does not write an explicit preference to persistent storage

#### Scenario: Preference survives authentication
- **WHEN** the user selects a language, completes the authentication round trip, signs out, and reloads
- **THEN** that explicit language remains selected throughout

#### Scenario: Invalid persisted value
- **WHEN** persistent preference storage contains a value other than `en` or `pt-BR`
- **THEN** the value is ignored and device resolution followed by English fallback determines the language

#### Scenario: Preference storage is unavailable
- **WHEN** preference storage cannot be read or written
- **THEN** startup continues through device resolution and English fallback
- **AND** an explicit selection still changes the language for the current page runtime without crashing

### Requirement: Localized UI is ready before display

The application SHALL bundle both locales and complete localization initialization before rendering application UI. All application-owned labels, loading/error feedback, accessible names, and document title SHALL use the selected locale. The document language SHALL match its canonical locale.

#### Scenario: First render
- **WHEN** the resolved launch locale is `pt-BR`
- **THEN** the first application render uses Brazilian Portuguese rather than showing untranslated keys or an English-first flash
- **AND** the document language is `pt-BR` and its title is localized

#### Scenario: Language changes in place
- **WHEN** the user switches between English and Brazilian Portuguese
- **THEN** visible text, accessible names, status/error feedback, document language, and title update without a full-page reload
- **AND** the selector identifies the choices as `English` and `Português (Brasil)`

#### Scenario: External identity and provider pages
- **WHEN** user identity information or an external Google consent page is displayed
- **THEN** the application does not translate the person's name or email or claim control over Google's interface language

### Requirement: English remains the translation fallback

If an individual selected-locale translation is unavailable or empty, the application SHALL resolve the English translation rather than showing an empty label. Normal locale resources SHALL be complete; fallback SHALL not substitute for resource validation.

#### Scenario: Individual Portuguese translation is unavailable
- **WHEN** a Portuguese translation is deliberately removed or emptied in an isolated localization test
- **THEN** the English translation is displayed for that key while the selected locale remains `pt-BR`

### Requirement: Translation access and resource parity are checked

Unknown translation keys SHALL fail static checking. Automated validation SHALL reject missing or extra locale leaf keys, empty translations, and mismatched interpolation placeholders between English and Brazilian Portuguese resources.

#### Scenario: Invalid translation key
- **WHEN** application code refers to a key absent from the canonical translation resource
- **THEN** the type-checking command fails

#### Scenario: Translation resources drift
- **WHEN** a locale has a missing or extra key, an empty value, or different interpolation placeholders
- **THEN** resource validation fails and identifies the affected key
