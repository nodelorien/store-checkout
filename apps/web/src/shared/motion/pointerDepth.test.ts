import { pointerPosition } from './pointerDepth';

describe('pointerPosition', () => {
  const box = { left: 100, top: 50, width: 400, height: 200 };

  it('AC-2: is at rest in the middle of the box', () => {
    expect(pointerPosition(300, 150, box)).toEqual({ x: 0, y: 0 });
  });

  it('AC-2: reaches −1 and 1 at the edges and never goes beyond them', () => {
    expect(pointerPosition(100, 50, box)).toEqual({ x: -1, y: -1 });
    expect(pointerPosition(500, 250, box)).toEqual({ x: 1, y: 1 });
    expect(pointerPosition(-900, 9000, box)).toEqual({ x: -1, y: 1 });
  });

  it('stays at rest over a box with no size', () => {
    expect(pointerPosition(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});
