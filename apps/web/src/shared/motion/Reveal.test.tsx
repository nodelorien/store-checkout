import { render, screen } from '@testing-library/react';
import { installViewportObserver, mockReducedMotion } from '@/test/motion';
import { Reveal, revealSx } from './Reveal';

describe('Reveal', () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

  it('AC-2: shows a section once, the first time it enters the viewport', () => {
    const { observers, restore } = installViewportObserver();
    cleanups.push(restore);

    render(<Reveal data-testid="section">Delivery details</Reveal>);
    const section = screen.getByTestId('section');

    // Rendered and readable from the start; only its presentation is pending.
    expect(screen.getByText('Delivery details')).toBeInTheDocument();
    expect(section).toHaveAttribute('data-reveal', 'pending');
    expect(observers[0].observe).toHaveBeenCalledWith(section);

    observers[0].enter(false);
    expect(section).toHaveAttribute('data-reveal', 'pending');

    observers[0].enter();
    expect(section).toHaveAttribute('data-reveal', 'shown');
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it('AC-2: does not replay after scrolling away and back', () => {
    const { observers, restore } = installViewportObserver();
    cleanups.push(restore);
    render(<Reveal data-testid="section">Card details</Reveal>);

    observers[0].enter();
    observers[0].enter(false);
    observers[0].enter();

    expect(screen.getByTestId('section')).toHaveAttribute('data-reveal', 'shown');
    expect(observers).toHaveLength(1);
  });

  it('AC-3: shows everything at once when the browser cannot observe the viewport', () => {
    render(<Reveal data-testid="section">Order summary</Reveal>);

    expect(screen.getByTestId('section')).toHaveAttribute('data-reveal', 'static');
    expect(revealSx('static')).toEqual({});
  });

  it('AC-1: shows everything at once when motion is reduced', () => {
    const { observers, restore } = installViewportObserver();
    cleanups.push(restore, mockReducedMotion(true));

    render(<Reveal data-testid="section">Order summary</Reveal>);

    expect(screen.getByTestId('section')).toHaveAttribute('data-reveal', 'static');
    expect(observers).toHaveLength(0);
  });

  it('AC-2: hides only through opacity and transform, and staggers siblings', () => {
    expect(revealSx('pending', 2)).toEqual({
      opacity: 0,
      transform: 'translate3d(0, 12px, 0)',
      transition: expect.stringContaining('100ms') as string,
    });
    expect(revealSx('shown')).toMatchObject({ opacity: 1, transform: 'none' });
  });
});
