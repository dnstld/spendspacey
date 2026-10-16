import type { TFunction } from 'i18next';

// Compiled by typecheck; never imported into the application bundle.
export function verifyTranslationKeys(t: TFunction) {
  t(($) => $.auth.signIn);
  // @ts-expect-error Unknown keys must fail static checking, even with a fallback.
  t(($) => $.auth.nonexistent, { defaultValue: 'fallback' });
}
