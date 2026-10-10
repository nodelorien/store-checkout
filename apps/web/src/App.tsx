import { AppRoutes } from './app/router';
import { AppShell } from './shared/components/AppShell';
import { ErrorBoundary } from './shared/components/ErrorBoundary';

export function App() {
  return (
    <AppShell>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </AppShell>
  );
}
