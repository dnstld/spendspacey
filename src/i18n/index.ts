import { createInstance, type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ptBR } from './pt-BR';

export const i18n = createInstance();

export async function initializeI18n(instance: I18n = i18n) {
  await instance.use(initReactI18next).init({
    resources: { 'pt-BR': { translation: ptBR } },
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR'],
    load: 'currentOnly',
    returnEmptyString: false,
    interpolation: { escapeValue: false },
  });
  document.documentElement.lang = 'pt-BR';
  document.title = instance.t(($) => $.common.title);
  return instance;
}
