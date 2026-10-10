import { detectCardBrand, isUnsupportedBrand } from './cardBrand';

describe('detectCardBrand', () => {
  it.each([
    ['4', 'VISA'],
    ['4242 4242 4242 4242', 'VISA'],
    ['51', 'MASTERCARD'],
    ['55', 'MASTERCARD'],
    ['5555 5555 5555 4444', 'MASTERCARD'],
    ['2221', 'MASTERCARD'],
    ['2229', 'MASTERCARD'],
    ['2230', 'MASTERCARD'],
    ['2299', 'MASTERCARD'],
    ['2300', 'MASTERCARD'],
    ['2699', 'MASTERCARD'],
    ['2700', 'MASTERCARD'],
    ['2719', 'MASTERCARD'],
    ['2720', 'MASTERCARD'],
  ])('AC-2: "%s" is %s', (number, brand) => {
    expect(detectCardBrand(number)).toBe(brand);
  });

  it.each(['', '5', '2', '22', '222', '50', '56', '2220', '2721', '2800', '34', '6011', 'abcd'])(
    'AC-2: "%s" is not a supported brand (yet)',
    (number) => {
      expect(detectCardBrand(number)).toBeNull();
    },
  );
});

describe('isUnsupportedBrand', () => {
  it.each([
    ['', false],
    ['5', false],
    ['222', false],
    ['4', false],
    ['3782', true],
    ['6011 1111', true],
    ['2220', true],
    ['2221', false],
    ['5100', false],
  ])('"%s" → %s', (number, expected) => {
    expect(isUnsupportedBrand(number)).toBe(expected);
  });
});
