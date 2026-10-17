import { useTranslation } from 'react-i18next';
import type { AuthMessage } from './errors';

export function Feedback({ message }: { message: AuthMessage | null }) {
  const { t } = useTranslation();
  return message ? (
    <p role="alert" className="text-sm leading-relaxed text-red-800">
      {t(($) => $.errors[message])}
    </p>
  ) : null;
}
