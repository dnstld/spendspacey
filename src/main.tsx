import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router';
import './index.css';
import { bootstrapAuth } from './lib/bootstrapAuth';
import { I18nextProvider } from 'react-i18next';
import { i18n, initializeI18n } from './i18n';

async function bootstrap() {
  const client = await bootstrapAuth(import.meta.env);
  await initializeI18n();

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
