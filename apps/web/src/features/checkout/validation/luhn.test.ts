import { isLuhnValid } from './luhn';

describe('isLuhnValid', () => {
  it.each(['4242424242424242', '5555555555554444', '2223003122003222', '4000056655665556', '0'])(
    'accepts %s',
    (value) => {
      expect(isLuhnValid(value)).toBe(true);
    },
  );

  it.each([
    ['one wrong check value', '4242424242424241'],
    ['two swapped neighbours', '4242424242424224'],
    ['spaces', '4242 4242 4242 4242'],
    ['letters', '4242abcd42424242'],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    expect(isLuhnValid(value)).toBe(false);
  });
});
