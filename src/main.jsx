import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './index.css';

// Apply the stored theme before first paint to avoid a light flash on reload.
let initialTheme = 'light';
try {
  const prefs = JSON.parse(localStorage.getItem('weathergpt:prefs') ?? '{}');
  if (prefs.theme) {
    initialTheme = prefs.theme;
    document.documentElement.dataset.theme = prefs.theme;
  }
} catch {
  /* ignore */
}

/*
 * The Clerk provider is mounted inside <App /> rather than here, because its
 * appearance follows the live theme setting that App owns. `initialTheme` seeds
 * it so the first render already matches.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App initialTheme={initialTheme} />
  </StrictMode>,
);
