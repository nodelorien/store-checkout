import { render, screen } from '@testing-library/react';
import { StockChip, stockLabel } from './StockChip';

describe('StockChip', () => {
  it.each([
    [0, 'Sold out'],
    [-1, 'Sold out'],
    [1, 'Only 1 left'],
    [3, 'Only 3 left'],
    [4, '4 in stock'],
    [120, '120 in stock'],
  ])('labels stock %d as "%s"', (stock, label) => {
    expect(stockLabel(stock)).toBe(label);

    render(<StockChip stock={stock} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('AC-8: highlights and announces a stock value that changes while it is on screen', () => {
    const { rerender } = render(<StockChip stock={12} />);
    expect(screen.queryByTestId('stock-highlight')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<StockChip stock={11} />);

    expect(screen.getByText('11 in stock')).toBeInTheDocument();
    expect(screen.getByTestId('stock-highlight')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Stock updated: 11 in stock');
  });

  it('AC-8: does not highlight a stock value that did not change', () => {
    const { rerender } = render(<StockChip stock={12} />);

    rerender(<StockChip stock={12} />);

    expect(screen.queryByTestId('stock-highlight')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('AC-8: highlights again, once, on each later change', () => {
    const { rerender } = render(<StockChip stock={3} />);

    rerender(<StockChip stock={2} />);
    const first = screen.getByTestId('stock-highlight');
    rerender(<StockChip stock={0} />);

    expect(screen.getAllByTestId('stock-highlight')).toHaveLength(1);
    expect(screen.getByTestId('stock-highlight')).not.toBe(first);
    expect(screen.getByRole('status')).toHaveTextContent('Stock updated: Sold out');
  });
});
