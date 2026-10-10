import { DomainError } from '../../../shared/errors/domain-error';
import { FeesConfig } from '../../../shared/ports/fees-config.port';
import { Result } from '../../../shared/result/result';
import { Money } from '../../products/domain/money';
import { Quantity } from '../../products/domain/quantity';

export interface AmountsProps {
  readonly subtotalInCents: number;
  readonly baseFeeInCents: number;
  readonly deliveryFeeInCents: number;
  readonly totalInCents: number;
}

export const Amounts = {
  /**
   * BR-01: `total = price × quantity + base fee + delivery fee`, all integer cents.
   * Inputs are the stored price and the server-side fees — never request data (BR-02).
   */
  calculate(price: Money, quantity: Quantity, fees: FeesConfig): Result<AmountsProps, DomainError> {
    return price.multiply(quantity.value).andThen((subtotal) =>
      Money.of(fees.baseFeeInCents).andThen((baseFee) =>
        Money.of(fees.deliveryFeeInCents).andThen((deliveryFee) =>
          subtotal
            .add(baseFee)
            .andThen((partial) => partial.add(deliveryFee))
            .map((total) => ({
              subtotalInCents: subtotal.amountInCents,
              baseFeeInCents: baseFee.amountInCents,
              deliveryFeeInCents: deliveryFee.amountInCents,
              totalInCents: total.amountInCents,
            })),
        ),
      ),
    );
  },
};
