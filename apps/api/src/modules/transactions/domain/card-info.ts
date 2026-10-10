import { DomainError, DomainErrors } from '../../../shared/errors/domain-error';
import { err, ok, Result } from '../../../shared/result/result';

export const CARD_BRANDS = ['VISA', 'MASTERCARD'] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];
export const MAX_INSTALLMENTS = 36;

export interface CardInfoProps {
  readonly brand: CardBrand;
  readonly lastFour: string;
  readonly installments: number;
}

/**
 * The only card facts our system ever holds: brand, last four digits and installments.
 * The card number, CVC and expiry never reach the API (AGENTS.md rule 3).
 */
export const CardInfo = {
  create(
    brand: string,
    lastFour: string,
    installments: number,
  ): Result<CardInfoProps, DomainError> {
    const normalisedBrand = String(brand ?? '').toUpperCase();
    if (!(CARD_BRANDS as readonly string[]).includes(normalisedBrand)) {
      return err(DomainErrors.invalidField('cardBrand', 'cardBrand must be VISA or MASTERCARD'));
    }
    if (!/^[0-9]{4}$/.test(String(lastFour ?? ''))) {
      return err(DomainErrors.invalidField('cardLastFour', 'cardLastFour must be 4 digits'));
    }
    if (!Number.isInteger(installments) || installments < 1 || installments > MAX_INSTALLMENTS) {
      return err(
        DomainErrors.invalidField(
          'installments',
          `installments must be an integer between 1 and ${MAX_INSTALLMENTS}`,
        ),
      );
    }
    return ok({ brand: normalisedBrand as CardBrand, lastFour, installments });
  },
};
