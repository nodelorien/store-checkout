import {
  formatCardNumber,
  formatCvc,
  formatExpiry,
  isExpiryInFuture,
  onlyNumeric,
  parseExpiry,
} from './cardFormat';

describe('formatCardNumber', () => {
  it.each([
    ['', ''],
    ['4', '4'],
    ['4242', '4242'],
    ['42424', '4242 4'],
    ['4242424242424242', '4242 4242 4242 4242'],
    ['4242-4242 4242.4242', '4242 4242 4242 4242'],
    ['4242424242424242999999', '4242 4242 4242 4242 999'],
    ['abc', ''],
  ])('formats "%s" as "%s"', (input, expected) => {
    expect(formatCardNumber(input)).toBe(expected);
  });
});

describe('formatCvc', () => {
  it('keeps at most three numeric characters', () => {
    expect(formatCvc('12a345')).toBe('123');
  });
});

describe('onlyNumeric', () => {
  it('drops everything else', () => {
    expect(onlyNumeric(' 12-34/x ')).toBe('1234');
  });
});

describe('formatExpiry', () => {
  it.each([
    ['', '', ''],
    ['1', '', '1'],
    ['5', '', '05/'],
    ['0', '', '0'],
    ['12', '1', '12/'],
    ['12/', '12', '12/'],
    ['12/3', '12/', '12/3'],
    ['1230', '', '12/30'],
    ['12/305', '12/30', '12/30'],
    ['08 / 30', '', '08/30'],
  ])('typing "%s" after "%s" gives "%s"', (value, previous, expected) => {
    expect(formatExpiry(value, previous)).toBe(expected);
  });

  it('lets the user delete the slash', () => {
    expect(formatExpiry('12', '12/')).toBe('12');
  });
});

describe('parseExpiry', () => {
  it.each([
    ['08/30', { month: '08', year: '30' }],
    ['12/99', { month: '12', year: '99' }],
    [' 01 / 27 ', { month: '01', year: '27' }],
  ])('parses "%s"', (value, expected) => {
    expect(parseExpiry(value)).toEqual(expected);
  });

  it.each(['', '13/30', '00/30', '1/30', '12/3', '12-30', '1230', 'ab/cd'])(
    'rejects "%s"',
    (value) => {
      expect(parseExpiry(value)).toBeNull();
    },
  );
});

describe('isExpiryInFuture', () => {
  const now = new Date(2026, 9, 9); // 9 October 2026

  it.each([
    ['10', '26', true],
    ['11', '26', true],
    ['01', '27', true],
    ['09', '26', false],
    ['12', '25', false],
  ])('%s/%s → %s', (month, year, expected) => {
    expect(isExpiryInFuture({ month, year }, now)).toBe(expected);
  });
});
