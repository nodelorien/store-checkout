import { render, screen } from '@testing-library/react';
import { Money } from './Money';

describe('Money', () => {
  it('renders formatted cents', () => {
    render(<Money amountInCents={800000} />);

    expect(screen.getByText(/8\.000/)).toHaveTextContent(/^\$\s8\.000$/);
  });

  it('accepts sx overrides', () => {
    render(<Money amountInCents={100} sx={{ fontWeight: 700 }} />);

    expect(screen.getByText(/1/)).toHaveStyle({ fontWeight: 700 });
  });
});
