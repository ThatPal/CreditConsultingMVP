import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { NavigationProtection } from './NavigationProtection';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { LiveUpdates } from './LiveUpdates';
import { theme } from './theme';

const queryClient = new QueryClient();
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <NavigationProtection>
        <App />
      </NavigationProtection>
    ),
  },
]);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LiveUpdates>
              <RouterProvider router={router} />
            </LiveUpdates>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
