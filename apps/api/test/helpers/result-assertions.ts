import { DomainError, DomainErrorCode } from '../../src/shared/errors/domain-error';
import { Result } from '../../src/shared/result/result';

export function expectOk<T, E>(result: Result<T, E>): T {
  if (result.isErr()) {
    throw new Error(`Expected ok, got err: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function expectErr<T>(result: Result<T, DomainError>, code: DomainErrorCode): DomainError {
  if (result.isOk()) {
    throw new Error(`Expected err(${code}), got ok: ${JSON.stringify(result.value)}`);
  }
  expect(result.error.code).toBe(code);
  return result.error;
}
