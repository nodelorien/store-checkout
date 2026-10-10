import { AppRoutes } from './app/router';
import { AppShell } from './shared/ui/templates/AppShell';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';

export function App() {
  return (
    <AppShell>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </AppShell>
  );
}
