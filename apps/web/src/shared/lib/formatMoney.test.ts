import { formatMoney } from './formatMoney';

/** Intl uses a non-breaking space between the sign and the amount; normalise it for assertions. */
const plain = (value: string) => value.replace(/\s/g, ' ');

describe('formatMoney', () => {
  it('AC-9: formats integer cents as COP without decimals', () => {
    expect(plain(formatMoney(12990000))).toBe('$ 129.900');
  });

  it.each([
    [0, '$ 0'],
    [250000, '$ 2.500'],
    [14040000, '$ 140.400'],
    [100000000, '$ 1.000.000'],
    [12345, '$ 123'],
  ])('formats %d cents as %s', (cents, expected) => {
    expect(plain(formatMoney(cents))).toBe(expected);
  });

  it('treats a non-finite amount as zero instead of rendering NaN', () => {
    expect(plain(formatMoney(Number.NaN))).toBe('$ 0');
  });

  it('supports another currency code', () => {
    expect(formatMoney(100000, 'USD')).toContain('1.000');
  });
});
