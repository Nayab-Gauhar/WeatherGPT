import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './index.css';

// Apply the stored theme before first paint to avoid a light flash on reload.
try {
  const prefs = JSON.parse(localStorage.getItem('weathergpt:prefs') ?? '{}');
  if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
} catch {
  /* ignore */
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
