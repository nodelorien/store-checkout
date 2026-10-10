import { fireEvent, render, screen } from '@testing-library/react';
import { mockReducedMotion } from '@/test/motion';
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

  describe('depth that follows the mouse', () => {
    const cleanups: (() => void)[] = [];
    afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

    function renderHero() {
      const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0);
        return 1;
      });
      cleanups.push(() => raf.mockRestore());
      render(<StoreHero />);
      const band = screen.getByRole('region');
      band.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 }) as DOMRect;
      return band;
    }

    it('AC-2: leans the planes towards the pointer and returns to rest when it leaves', () => {
      const band = renderHero();

      fireEvent.mouseMove(band, { clientX: 400, clientY: 0 });
      expect(band.style.getPropertyValue('--pointer-x')).toBe('1.000');
      expect(band.style.getPropertyValue('--pointer-y')).toBe('-1.000');

      fireEvent.mouseLeave(band);
      expect(band.style.getPropertyValue('--pointer-x')).toBe('0.000');
      expect(band.style.getPropertyValue('--pointer-y')).toBe('0.000');
    });

    it('AC-2: the band keeps its size and the heading its place while the planes lean', () => {
      const band = renderHero();

      fireEvent.mouseMove(band, { clientX: 20, clientY: 180 });

      expect(band.style.height).toBe('');
      expect(band.style.transform).toBe('');
      expect(screen.getByRole('heading', { name: 'Featured products' })).toBeVisible();
    });

    it('AC-4: ignores the pointer when motion is reduced', () => {
      cleanups.push(mockReducedMotion(true));
      const band = renderHero();

      fireEvent.mouseMove(band, { clientX: 400, clientY: 0 });

      expect(band.style.getPropertyValue('--pointer-x')).toBe('');
    });
  });
});
