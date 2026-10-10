/** Luhn checksum over a string of decimal characters only. */
export function isLuhnValid(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;

  let sum = 0;
  let double = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let n = value.charCodeAt(index) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}
