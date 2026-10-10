import { AppRoutes } from './app/router';
import { AccountMenu } from './features/account';
import { AppShell } from './shared/ui/templates/AppShell';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';

export function App() {
  return (
    <AppShell account={<AccountMenu />}>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </AppShell>
  );
}
