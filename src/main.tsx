import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './hooks/useAuth.tsx';
import { ThemeProvider } from './components/ThemeProvider.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerSW } from 'virtual:pwa-register';
import { initConsoleLogger } from './utils/consoleLogger.ts';

// Initialize advanced error interception
initConsoleLogger();

window.addEventListener('error', (event) => {
  if (event.message?.includes('ResizeObserver')) return;
  if (event.message?.includes('Script error.')) return;
  console.log('WINDOW ERROR:', event.message, event.filename, event.lineno, event.colno, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.log('UNHANDLED REJECTION:', event.reason);
});

// Register the service worker for PWA functionality
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider defaultTheme="system" storageKey="gym-app-theme">
          <App />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

