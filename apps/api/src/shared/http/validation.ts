import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ErrorDetail } from '../errors/domain-error';

export class RequestValidationException extends BadRequestException {
  constructor(readonly details: readonly ErrorDetail[]) {
    super('The request is not valid');
  }
}

/** Flattens nested class-validator errors into `{ field: 'customer.email', message }` entries. */
export function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentPath = '',
): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // Never echo submitted values back (they may be card data sent by mistake).
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => new RequestValidationException(flattenValidationErrors(errors)),
  });
}
