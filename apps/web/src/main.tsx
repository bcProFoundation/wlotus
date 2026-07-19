import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PullToRefresh } from './lib/PullToRefresh';
import { registerPwaAutoUpdate } from './lib/pwaUpdate';
import './styles.css';

registerPwaAutoUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PullToRefresh>
      <App />
    </PullToRefresh>
  </StrictMode>,
);
