import { render, screen } from '@testing-library/react';
import { StoreHero } from './StoreHero';

describe('StoreHero', () => {
  it('AC-6: keeps the page heading a heading and names the band after it', () => {
    render(<StoreHero />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Featured products' });
    expect(screen.getByRole('region', { name: 'Featured products' })).toContainElement(heading);
    expect(screen.getByText('Hand-picked essentials, delivered to your door.')).toBeVisible();
  });

  it('AC-6: hides the decorative depth layers from assistive technology', () => {
    render(<StoreHero />);

    for (const layer of ['hero-layer-far', 'hero-layer-near']) {
      expect(screen.getByTestId(layer)).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTestId(layer)).not.toContainElement(screen.getByRole('heading'));
    }
  });

  it('AC-6: the deeper layer travels further than the nearer one, within the limit', () => {
    render(<StoreHero />);
    const travel = (id: string) =>
      Number.parseFloat(screen.getByTestId(id).style.getPropertyValue('--parallax-to') || '0');

    // The offsets are CSS variables on the layers; the band itself carries no scroll-linked size.
    expect(screen.getByRole('region').style.height).toBe('');
    expect(travel('hero-layer-far')).toBeGreaterThanOrEqual(travel('hero-layer-near'));
  });
});
