export const LOCALE_STORAGE_KEY = 'spendspacey.locale';
export type Locale = 'en' | 'pt-BR';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'pt-BR';
}

export function resolveLocale(
  preference: unknown,
  languages: readonly string[] = [],
  language?: string,
): Locale {
  if (isLocale(preference)) return preference;
  for (const tag of languages.length ? languages : language ? [language] : []) {
    try {
      const base = new Intl.Locale(tag).language;
      if (base === 'pt') return 'pt-BR';
      if (base === 'en') return 'en';
    } catch {
      // Invalid device tags are skipped, just like unsupported languages.
    }
  }
  return 'en';
}

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
type GetStorage = () => PreferenceStorage;

export function detectLocale(
  getStorage: GetStorage = () => window.localStorage,
  languages: readonly string[] = navigator.languages,
  language = navigator.language,
): Locale {
  let preference: string | null = null;
  try {
    preference = getStorage().getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Language selection stays available when browser storage is blocked.
  }
  return resolveLocale(preference, languages, language);
}

export function saveLocale(locale: Locale, getStorage: GetStorage = () => window.localStorage) {
  try {
    getStorage().setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The current selection still applies in memory for this page runtime.
  }
}
