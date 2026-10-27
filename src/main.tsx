import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// One locally bundled handwritten font across the interface.
import '@fontsource/comic-neue/400.css';
import '@fontsource/comic-neue/700.css';
import './styles/global.css';
import App from './App';
import './styles/mobile.css';
import './styles/typography.css';
import './styles/pastel-theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
