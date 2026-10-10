import { render, screen } from '@testing-library/react';
import { buildProduct } from '@/test/builders';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  it('AC-3: an available product responds to the pointer', () => {
    render(<ProductCard product={buildProduct({ stock: 4 })} onPay={jest.fn()} />);

    expect(screen.getByRole('article')).toHaveAttribute('data-interactive', 'true');
    expect(screen.getByRole('button', { name: /pay with credit card/i })).toBeEnabled();
  });

  it('AC-3: a sold-out product stays still and cannot be bought', () => {
    render(<ProductCard product={buildProduct({ stock: 0 })} onPay={jest.fn()} />);

    expect(screen.getByRole('article')).toHaveAttribute('data-interactive', 'false');
    expect(screen.getByRole('button', { name: /pay with credit card/i })).toBeDisabled();
  });

  it('AC-1: its picture drifts within the margin by which it overfills the frame', () => {
    render(<ProductCard product={buildProduct()} onPay={jest.fn()} />);
    const layer = screen.getByTestId('image-parallax');

    expect(layer.style.getPropertyValue('--parallax-from')).toBe('-16px');
    expect(layer.style.getPropertyValue('--parallax-to')).toBe('16px');
  });
});
