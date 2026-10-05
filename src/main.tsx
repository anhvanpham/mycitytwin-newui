import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Locally bundled rounded headings and clear reading text.
import '@fontsource-variable/nunito/wght.css';
import '@fontsource-variable/manrope/wght.css';
import './styles/global.css';
import App from './App';
import './styles/mobile.css';
import './styles/typography.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
