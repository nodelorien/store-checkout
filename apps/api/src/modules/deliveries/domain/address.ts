import { DomainError, DomainErrors, ErrorDetail } from '../../../shared/errors/domain-error';
import { err, ok, Result } from '../../../shared/result/result';

export interface AddressProps {
  readonly addressLine1: string;
  readonly addressLine2?: string;
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly postalCode?: string;
}

export const SUPPORTED_COUNTRY = 'CO';
const POSTAL_CODE = /^[A-Za-z0-9]{4,10}$/;

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const optional = (value: unknown): string | undefined => clean(value) || undefined;

/** Delivery address. Only Colombia is served. */
export class Address {
  private constructor(private readonly props: AddressProps) {}

  static create(
    raw: Partial<AddressProps>,
    fieldPrefix = 'delivery',
  ): Result<Address, DomainError> {
    const props: AddressProps = {
      addressLine1: clean(raw.addressLine1),
      addressLine2: optional(raw.addressLine2),
      city: clean(raw.city),
      region: clean(raw.region),
      country: clean(raw.country).toUpperCase(),
      postalCode: optional(raw.postalCode),
    };

    const problems: ErrorDetail[] = [];
    const check = (valid: boolean, field: string, message: string): void => {
      if (!valid) {
        problems.push({ field: `${fieldPrefix}.${field}`, message });
      }
    };
    const between = (value: string, min: number, max: number): boolean =>
      value.length >= min && value.length <= max;

    check(
      between(props.addressLine1, 5, 120),
      'addressLine1',
      'addressLine1 must have 5 to 120 characters',
    );
    check(
      (props.addressLine2 ?? '').length <= 120,
      'addressLine2',
      'addressLine2 must have at most 120 characters',
    );
    check(between(props.city, 2, 60), 'city', 'city must have 2 to 60 characters');
    check(between(props.region, 2, 60), 'region', 'region must have 2 to 60 characters');
    check(props.country === SUPPORTED_COUNTRY, 'country', `country must be ${SUPPORTED_COUNTRY}`);
    check(
      props.postalCode === undefined || POSTAL_CODE.test(props.postalCode),
      'postalCode',
      'postalCode must have 4 to 10 letters or digits',
    );

    return problems.length > 0
      ? err(DomainErrors.validation('The delivery address is not valid', problems))
      : ok(new Address(props));
  }

  toProps(): AddressProps {
    return { ...this.props };
  }
}
