import { DomainError, DomainErrorCode, ErrorDetail } from './domain-error';

/** Codes produced by the HTTP layer itself (never by a use case). */
export type TransportErrorCode =
  'NOT_FOUND' | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'BAD_REQUEST';

export type ErrorCode = DomainErrorCode | TransportErrorCode;

export interface ErrorEnvelope {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details: readonly ErrorDetail[];
    readonly requestId: string;
  };
}

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION_ERROR: 400,
  PRODUCT_NOT_FOUND: 404,
  CUSTOMER_NOT_FOUND: 404,
  TRANSACTION_NOT_FOUND: 404,
  DELIVERY_NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  DELIVERY_NOT_EDITABLE: 409,
  PAYMENT_GATEWAY_REJECTED: 422,
  PAYMENT_GATEWAY_UNAVAILABLE: 502,
  INVALID_SIGNATURE: 401,
  PERSISTENCE_ERROR: 500,
};

export const GENERIC_ERROR_MESSAGE = 'Something went wrong, try again later';

export function httpStatusFor(code: DomainErrorCode): number {
  return STATUS_BY_CODE[code];
}

export function buildErrorEnvelope(
  code: ErrorCode,
  message: string,
  details: readonly ErrorDetail[],
  requestId: string,
): ErrorEnvelope {
  return { error: { code, message, details: [...details], requestId } };
}

/** 5xx answers never expose internals: the message is replaced by a generic one. */
export function domainErrorToHttp(
  error: DomainError,
  requestId: string,
): { status: number; body: ErrorEnvelope } {
  const status = httpStatusFor(error.code);
  const message = error.code === 'PERSISTENCE_ERROR' ? GENERIC_ERROR_MESSAGE : error.message;
  return { status, body: buildErrorEnvelope(error.code, message, error.details, requestId) };
}
