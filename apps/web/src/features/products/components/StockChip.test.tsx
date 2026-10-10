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
});
