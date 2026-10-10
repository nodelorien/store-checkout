import { screen } from '@testing-library/react';
import { App } from './App';
import { renderWithProviders } from './test/renderWithProviders';

describe('App shell', () => {
  it('AC-3: shows the store name', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { name: 'Lumen Store' })).toBeInTheDocument();
  });

  it('renders the store name from the Redux state', () => {
    renderWithProviders(<App />, { preloadedState: { app: { storeName: 'Another Store' } } });

    expect(screen.getByRole('heading', { name: 'Another Store' })).toBeInTheDocument();
  });
});
