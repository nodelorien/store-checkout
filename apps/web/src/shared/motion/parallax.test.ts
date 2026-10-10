import {
  clamp01,
  layerTravel,
  scrollOffset,
  staggerDelay,
  viewOffset,
  viewProgress,
} from './parallax';
import { motion } from './tokens';

describe('depth maths', () => {
  it('AC-4: a layer crossing the viewport has no offset at the middle of its range', () => {
    expect(viewOffset(0.5, 24)).toBe(0);
  });

  it('AC-4: the offset is proportional to the depth of the layer', () => {
    const shallow = viewOffset(1, layerTravel(0.25));
    const deep = viewOffset(1, layerTravel(0.5));

    expect(deep).toBeCloseTo(shallow * 2);
    expect(layerTravel(1)).toBe(motion.parallax.maxTravel);
  });

  it.each([-3, -0.01, 0, 0.3, 1, 1.01, 40, Number.NaN, Number.POSITIVE_INFINITY])(
    'AC-4: progress %p never moves a layer beyond its maximum travel',
    (progress) => {
      expect(Math.abs(viewOffset(progress, 24))).toBeLessThanOrEqual(24);
    },
  );

  it('AC-4: depth outside 0–1 is clamped to the maximum travel', () => {
    expect(layerTravel(7)).toBe(motion.parallax.maxTravel);
    expect(layerTravel(-2)).toBe(0);
    expect(layerTravel(0.5, 10)).toBe(5);
  });

  it('AC-5: an image never drifts further than the margin by which it overfills its frame', () => {
    const overfill = 8;

    for (let step = -20; step <= 120; step += 1) {
      expect(Math.abs(viewOffset(step / 100, overfill))).toBeLessThanOrEqual(overfill);
    }
    expect(viewOffset(0, overfill)).toBe(-overfill);
    expect(viewOffset(1, overfill)).toBe(overfill);
  });

  it('measures how far an element has crossed the viewport', () => {
    expect(viewProgress(667, 200, 667)).toBe(0);
    expect(viewProgress(-200, 200, 667)).toBe(1);
    expect(viewProgress(233.5, 200, 667)).toBeCloseTo(0.5);
    expect(viewProgress(5000, 200, 667)).toBe(0);
    expect(viewProgress(0, 0, 0)).toBe(0);
  });

  it('ties a layer to the page scroll, from rest at the top to its full travel', () => {
    expect(scrollOffset(0, 320, 24)).toBe(0);
    expect(scrollOffset(160, 320, 24)).toBe(12);
    expect(scrollOffset(9000, 320, 24)).toBe(24);
    expect(scrollOffset(-50, 320, 24)).toBe(0);
    expect(scrollOffset(100, 0, 24)).toBe(0);
  });

  it('AC-2: staggers at most six items by at most 60 ms each', () => {
    const delays = Array.from({ length: 12 }, (_, index) => staggerDelay(index));

    expect(delays[0]).toBe(0);
    expect(delays[1] - delays[0]).toBeLessThanOrEqual(60);
    expect(new Set(delays).size).toBe(6);
    expect(Math.max(...delays)).toBe(delays[5]);
    expect(staggerDelay(-4)).toBe(0);
  });

  it('clamps to the 0–1 range', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});
