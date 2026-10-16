import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router';
import './index.css';
import { parsePublicConfig, type PublicConfig } from './lib/env';
import { I18nextProvider } from 'react-i18next';
import { i18n, initializeI18n } from './i18n';

async function bootstrap() {
  await initializeI18n();
  let config: PublicConfig | undefined;
  try {
    config = parsePublicConfig(import.meta.env);
  } catch {
    // Configuration values must never be echoed to the page or console.
  }
  const client = config ? (await import('./lib/supabase')).getSupabase(config) : undefined;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <App client={client} />
        </BrowserRouter>
      </I18nextProvider>
    </StrictMode>,
  );
}

void bootstrap();
