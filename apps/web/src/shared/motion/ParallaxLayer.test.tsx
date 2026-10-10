import { render, screen } from '@testing-library/react';
import { controlScrollFrames, mockReducedMotion, mockScrollTimelineSupport } from '@/test/motion';
import { ParallaxLayer } from './ParallaxLayer';
import { useScrollProgress } from './useScrollProgress';

function Bar() {
  const { ref, mode } = useScrollProgress<HTMLDivElement>('--bar-shadow', 32);
  return <div ref={ref} data-testid="bar" data-mode={mode} />;
}

describe('ParallaxLayer', () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

  it('AC-7: without native support, one passive scroll listener moves every layer', () => {
    const page = controlScrollFrames();
    cleanups.push(page.restore);

    const { unmount } = render(
      <>
        <ParallaxLayer travel={24} timeline="scroll" range={320} data-testid="far" />
        <ParallaxLayer travel={12} timeline="scroll" range={320} data-testid="near" />
      </>,
    );

    expect(page.scrollListenersAdded()).toHaveLength(1);
    expect(page.scrollListenersAdded()[0][2]).toEqual({ passive: true });
    expect(screen.getByTestId('far')).toHaveAttribute('data-parallax', 'fallback');

    page.scrollTo(160);
    expect(screen.getByTestId('far').style.transform).toBe('translate3d(0, 12.00px, 0)');
    expect(screen.getByTestId('near').style.transform).toBe('translate3d(0, 6.00px, 0)');

    page.scrollTo(5000);
    expect(screen.getByTestId('far').style.transform).toBe('translate3d(0, 24.00px, 0)');

    unmount();
    expect(page.scrollListenersRemoved()).toHaveLength(1);
  });

  it('AC-5: a layer crossing the viewport is measured against its frame and stays within its travel', () => {
    const page = controlScrollFrames();
    cleanups.push(page.restore);
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 667 });

    render(
      <div data-testid="frame">
        <ParallaxLayer travel={8} data-testid="image" />
      </div>,
    );
    const frame = screen.getByTestId('frame');
    const place = (top: number) => {
      frame.getBoundingClientRect = () => ({ top, height: 200 }) as DOMRect;
      page.scrollTo(0);
      return screen.getByTestId('image').style.transform;
    };

    expect(place(667)).toBe('translate3d(0, -8.00px, 0)');
    expect(place(233.5)).toBe('translate3d(0, 0.00px, 0)');
    expect(place(-200)).toBe('translate3d(0, 8.00px, 0)');
    expect(place(-9000)).toBe('translate3d(0, 8.00px, 0)');
  });

  it('AC-7: with native scroll-driven animation no listener is attached', () => {
    const page = controlScrollFrames();
    cleanups.push(page.restore, mockScrollTimelineSupport(true));

    render(<ParallaxLayer travel={24} timeline="scroll" data-testid="far" />);
    page.scrollTo(200);

    expect(page.scrollListenersAdded()).toHaveLength(0);
    expect(screen.getByTestId('far')).toHaveAttribute('data-parallax', 'native');
    expect(screen.getByTestId('far').style.transform).toBe('');
  });

  it('AC-1: with reduced motion layers have no offset and no listener', () => {
    const page = controlScrollFrames();
    cleanups.push(page.restore, mockReducedMotion(true));

    render(
      <>
        <ParallaxLayer travel={24} timeline="scroll" data-testid="far" />
        <Bar />
      </>,
    );
    page.scrollTo(200);

    expect(page.scrollListenersAdded()).toHaveLength(0);
    expect(screen.getByTestId('far')).toHaveAttribute('data-parallax', 'off');
    expect(screen.getByTestId('far').style.transform).toBe('');
    expect(screen.getByTestId('bar').style.getPropertyValue('--bar-shadow')).toBe('');
  });

  it('reports how far the page has scrolled through a range as a CSS variable', () => {
    const page = controlScrollFrames();
    cleanups.push(page.restore);
    render(<Bar />);

    page.scrollTo(16);
    expect(screen.getByTestId('bar').style.getPropertyValue('--bar-shadow')).toBe('0.500');

    page.scrollTo(400);
    expect(screen.getByTestId('bar').style.getPropertyValue('--bar-shadow')).toBe('1.000');
  });
});
