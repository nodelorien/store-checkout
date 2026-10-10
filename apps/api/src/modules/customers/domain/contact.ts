import { DomainError, DomainErrors } from '../../../shared/errors/domain-error';
import { err, ok, Result } from '../../../shared/result/result';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

/** Normalised (trimmed, lower-cased) e-mail address; the natural key of a customer. */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Email, DomainError> {
    const value = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (value.length > 254 || !EMAIL_PATTERN.test(value)) {
      return err(DomainErrors.invalidField('email', 'email must be a valid e-mail address'));
    }
    return ok(new Email(value));
  }
}

/** E.164-like phone number; spaces, dashes and parentheses are dropped. */
export class Phone {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Phone, DomainError> {
    const value = String(raw ?? '').replace(/[\s()-]/g, '');
    if (!PHONE_PATTERN.test(value)) {
      return err(
        DomainErrors.invalidField('phone', 'phone must have 7 to 15 digits, optionally with +'),
      );
    }
    return ok(new Phone(value));
  }
}

export class FullName {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<FullName, DomainError> {
    const value = String(raw ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (value.length < 3 || value.length > 100) {
      return err(DomainErrors.invalidField('fullName', 'fullName must have 3 to 100 characters'));
    }
    return ok(new FullName(value));
  }
}
