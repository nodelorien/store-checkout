import { DomainError } from '../errors/domain-error';
import { Result } from '../result/result';

export interface DataEnvelope<T> {
  readonly data: T;
}

/** Carries a `DomainError` from a controller to the exception filter, which renders the envelope. */
export class DomainErrorException extends Error {
  constructor(readonly domainError: DomainError) {
    super(domainError.message);
    this.name = 'DomainErrorException';
  }
}

/** Controller helper: success → `{ data }`, failure → error envelope via the exception filter. */
export function toResponse<T>(result: Result<T, DomainError>): DataEnvelope<T> {
  return result.match<DataEnvelope<T>, never>(
    (data) => ({ data }),
    (error) => {
      throw new DomainErrorException(error);
    },
  );
}
