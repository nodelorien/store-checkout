import { STORAGE_KEY, clear, load, save } from './storage';

describe('storage', () => {
  afterEach(() => jest.restoreAllMocks());

  it('round-trips a value under the versioned key', () => {
    expect(save({ version: 1 })).toBe(true);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{"version":1}');
    expect(load()).toEqual({ version: 1 });
  });

  it('returns undefined when nothing is stored', () => {
    expect(load()).toBeUndefined();
  });

  it('returns undefined when the stored value is not JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');

    expect(load()).toBeUndefined();
  });

  it('clear removes the key', () => {
    save({ version: 1 });
    clear();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('AC-7: tolerates a storage that throws (quota, private mode)', () => {
    const denied = () => {
      throw new DOMException('denied', 'QuotaExceededError');
    };
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied);

    expect(load()).toBeUndefined();
    expect(save({ version: 1 })).toBe(false);
    expect(() => clear()).not.toThrow();
  });
});
