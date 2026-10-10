import { createUuid } from './uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const fillWithOnes = <T extends ArrayBufferView | null>(array: T): T => {
  if (array instanceof Uint8Array) array.fill(0xff);
  return array;
};

describe('createUuid', () => {
  it('uses the platform generator when available', () => {
    const randomUUID = jest.fn(() => '11111111-1111-4111-8111-111111111111');

    expect(createUuid({ randomUUID, getRandomValues: fillWithOnes })).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('falls back to random bytes in non-secure contexts', () => {
    const id = createUuid({ getRandomValues: fillWithOnes });

    expect(id).toMatch(UUID_V4);
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('generates different identifiers with the default generator', () => {
    expect(createUuid()).not.toBe(createUuid());
  });
});
