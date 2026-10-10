import { screen } from '@testing-library/react';
import { App } from './App';
import { renderWithProviders } from './test/renderWithProviders';

describe('App shell', () => {
  it('AC-1: shows the store name as the page heading', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Lumen Store' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('AC-1: keeps the shell on any route', () => {
    renderWithProviders(<App />, { route: '/somewhere/else' });

    expect(screen.getByRole('heading', { level: 1, name: 'Lumen Store' })).toBeInTheDocument();
  });

  it('AC-10: shows a not-found message with a link back to the store', () => {
    renderWithProviders(<App />, { route: '/nope' });

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to store' })).toHaveAttribute('href', '/');
  });
});
