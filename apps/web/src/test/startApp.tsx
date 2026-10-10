import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { bootstrapStore } from '@/app/bootstrap';
import { STORAGE_KEY } from '@/app/persistence/storage';
import { renderWithProviders } from './renderWithProviders';

export const currentPath = () => screen.getByTestId('location').textContent ?? '/';
export const storedSnapshot = () => window.localStorage.getItem(STORAGE_KEY);

/**
 * Boots the whole app the way `main.tsx` does (store preloaded from `localStorage`), and lets a
 * test simulate a browser refresh: the page is hidden (snapshot flushed), everything in memory is
 * thrown away, and the app boots again at the same URL from what was persisted.
 */
export function startApp(route = '/') {
  const browserTab = new EventTarget();
  const store = bootstrapStore(browserTab as unknown as Window);
  const user = userEvent.setup({ delay: null });
  const view = renderWithProviders(<App />, { store, route });

  return {
    store,
    user,
    refresh(nextRoute: string = currentPath()) {
      browserTab.dispatchEvent(new Event('pagehide'));
      view.unmount();
      return startApp(nextRoute);
    },
  };
}
