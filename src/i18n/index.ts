import { createInstance, type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { ptBR } from './pt-BR';
import { detectLocale, type Locale } from './locale';

export const i18n = createInstance();

export async function initializeI18n(instance: I18n = i18n, locale: Locale = detectLocale()) {
  await instance.use(initReactI18next).init({
    resources: { en: { translation: en }, 'pt-BR': { translation: ptBR } },
    lng: locale,
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt-BR'],
    load: 'currentOnly',
    returnEmptyString: false,
    interpolation: { escapeValue: false },
  });
  const syncDocument = () => {
    document.documentElement.lang = instance.language === 'pt-BR' ? 'pt-BR' : 'en';
    document.title = instance.t(($) => $.common.title);
  };
  instance.on('languageChanged', syncDocument);
  syncDocument();
  return instance;
}
