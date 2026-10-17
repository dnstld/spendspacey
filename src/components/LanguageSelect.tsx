import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { isLocale, saveLocale } from '@/i18n/locale';

export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const id = useId();
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <label htmlFor={id}>{t(($) => $.common.language)}</label>
      <select
        id={id}
        value={i18n.resolvedLanguage}
        className="min-h-11 max-w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => {
          const locale = event.target.value;
          if (!isLocale(locale)) return;
          saveLocale(locale);
          void i18n.changeLanguage(locale);
        }}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="pt-BR" lang="pt-BR">
          Português (Brasil)
        </option>
      </select>
    </div>
  );
}
