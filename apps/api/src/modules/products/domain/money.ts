import { DomainError, DomainErrors } from '../../../shared/errors/domain-error';
import { err, ok, Result } from '../../../shared/result/result';

export type Currency = 'COP';
export const DEFAULT_CURRENCY: Currency = 'COP';

/** Integer cents in one currency. Never a float (AGENTS.md rule 4). */
export class Money {
  private constructor(
    readonly amountInCents: number,
    readonly currency: Currency,
  ) {}

  static of(
    amountInCents: number,
    currency: Currency = DEFAULT_CURRENCY,
  ): Result<Money, DomainError> {
    if (!Number.isSafeInteger(amountInCents) || amountInCents < 0) {
      return err(
        DomainErrors.invalidField('amountInCents', 'amount must be a non-negative integer'),
      );
    }
    return ok(new Money(amountInCents, currency));
  }

  add(other: Money): Result<Money, DomainError> {
    return Money.of(this.amountInCents + other.amountInCents, this.currency);
  }

  multiply(factor: number): Result<Money, DomainError> {
    if (!Number.isInteger(factor) || factor < 0) {
      return err(DomainErrors.invalidField('factor', 'factor must be a non-negative integer'));
    }
    return Money.of(this.amountInCents * factor, this.currency);
  }
}
