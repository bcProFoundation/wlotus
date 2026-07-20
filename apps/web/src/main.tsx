import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LocaleProvider } from './i18n/LocaleContext';
import { PullToRefresh } from './lib/PullToRefresh';
import { registerPwaAutoUpdate } from './lib/pwaUpdate';
import './styles.css';

registerPwaAutoUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <PullToRefresh>
        <App />
      </PullToRefresh>
    </LocaleProvider>
  </StrictMode>,
);
