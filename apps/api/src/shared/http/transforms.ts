import { Transform } from 'class-transformer';

/** Trims string inputs before validation; other types are left for the validators to reject. */
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
