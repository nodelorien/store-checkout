import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

let shouldCrash = true;

function Fragile() {
  if (shouldCrash) throw new Error('render crash');
  return <p>All good</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldCrash = true;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('renders its children when nothing fails', () => {
    shouldCrash = false;
    render(
      <ErrorBoundary>
        <Fragile />
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('AC-11: shows a recoverable error screen when rendering crashes', async () => {
    render(
      <ErrorBoundary>
        <Fragile />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');

    shouldCrash = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});
