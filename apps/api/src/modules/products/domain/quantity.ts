import { DomainError, DomainErrors } from '../../../shared/errors/domain-error';
import { err, ok, Result } from '../../../shared/result/result';

export const MAX_QUANTITY_PER_ORDER = 10;

/** Units of one product in an order (BR-03). */
export class Quantity {
  private constructor(readonly value: number) {}

  static create(value: number): Result<Quantity, DomainError> {
    if (!Number.isInteger(value) || value < 1 || value > MAX_QUANTITY_PER_ORDER) {
      return err(
        DomainErrors.invalidField(
          'quantity',
          `quantity must be an integer between 1 and ${MAX_QUANTITY_PER_ORDER}`,
        ),
      );
    }
    return ok(new Quantity(value));
  }
}
