import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { DemoProvider } from './app/demo-store';
import { PRODUCT } from './app/product';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }
  }
});

registerSW({
  immediate: true,
  onOfflineReady: () => window.dispatchEvent(new CustomEvent('app-offline-ready'))
});

document.title = PRODUCT.name;

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Application root element is missing.');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DemoProvider>
        <App />
      </DemoProvider>
    </QueryClientProvider>
  </StrictMode>
);
