import { fireEvent, render, screen } from '@testing-library/react';
import { ResponsiveImage } from './ResponsiveImage';

describe('ResponsiveImage', () => {
  it('AC-8: reserves space with intrinsic dimensions and loads lazily by default', () => {
    render(<ResponsiveImage src="/images/products/lamp.svg" alt="Desk lamp" />);

    const image = screen.getByRole('img', { name: 'Desk lamp' });
    expect(image).toHaveAttribute('width', '800');
    expect(image).toHaveAttribute('height', '600');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image.parentElement).toHaveStyle({ position: 'relative', overflow: 'hidden' });
  });

  it('AC-8: loads eagerly with high priority when asked', () => {
    render(<ResponsiveImage src="/a.svg" alt="First" priority="high" />);

    const image = screen.getByRole('img', { name: 'First' });
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });

  it('loads eagerly without raising the priority', () => {
    render(<ResponsiveImage src="/a.svg" alt="Second" priority="eager" />);

    const image = screen.getByRole('img', { name: 'Second' });
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'auto');
  });

  it('AC-8: shows a skeleton until the image has loaded', () => {
    render(<ResponsiveImage src="/a.svg" alt="Lamp" />);

    expect(screen.getByTestId('image-skeleton')).toBeInTheDocument();

    fireEvent.load(screen.getByRole('img', { name: 'Lamp' }));

    expect(screen.queryByTestId('image-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lamp' })).toHaveStyle({ opacity: 1 });
  });

  it('AC-8: shows a labelled placeholder when the image fails', () => {
    render(<ResponsiveImage src="/broken.svg" alt="Lamp" />);

    fireEvent.error(screen.getByRole('img', { name: 'Lamp' }));

    const placeholder = screen.getByRole('img', { name: 'Lamp' });
    expect(placeholder).toHaveTextContent('Image unavailable');
    expect(placeholder.tagName).not.toBe('IMG');
    expect(screen.queryByTestId('image-skeleton')).not.toBeInTheDocument();
  });

  it('shows the placeholder straight away when there is no source', () => {
    render(<ResponsiveImage src="" alt="Lamp" />);

    expect(screen.getByRole('img', { name: 'Lamp' })).toHaveTextContent('Image unavailable');
  });

  it('skips the skeleton for an image that is already complete (cached)', () => {
    const complete = jest
      .spyOn(HTMLImageElement.prototype, 'complete', 'get')
      .mockReturnValue(true);
    const naturalWidth = jest
      .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
      .mockReturnValue(800);

    render(<ResponsiveImage src="/cached.svg" alt="Cached" sx={{ borderRadius: 1 }} />);

    expect(screen.queryByTestId('image-skeleton')).not.toBeInTheDocument();
    complete.mockRestore();
    naturalWidth.mockRestore();
  });

  it('AC-5: a drifting image overfills its frame by exactly the distance it may travel', () => {
    render(<ResponsiveImage src="/lamp.svg" alt="Desk lamp" parallax={8} />);
    const layer = screen.getByTestId('image-parallax');

    expect(layer).toContainElement(screen.getByAltText('Desk lamp'));
    expect(layer.style.getPropertyValue('--parallax-from')).toBe('-8px');
    expect(layer.style.getPropertyValue('--parallax-to')).toBe('8px');
  });

  it('does not wrap the image in a depth layer unless asked', () => {
    render(<ResponsiveImage src="/lamp.svg" alt="Desk lamp" />);

    expect(screen.queryByTestId('image-parallax')).not.toBeInTheDocument();
  });
});
