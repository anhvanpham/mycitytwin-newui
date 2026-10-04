import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Rounded typography for the whole interface; see tokens.css.
import '@fontsource-variable/nunito/wght.css';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
