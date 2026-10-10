import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

/** The only error shape allowed in the store and in components: serialisable and safe to show. */
export interface UiError {
  code: string;
  message: string;
  status: number | null;
  requestId: string | null;
}

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'We could not reach the server. Check your connection and try again.',
  VALIDATION_ERROR: 'Some details look invalid. Please review them and try again.',
  OUT_OF_STOCK: 'Sorry, this product just sold out.',
  PAYMENT_GATEWAY_REJECTED: 'The payment was rejected. Check your card details and try again.',
  PAYMENT_GATEWAY_UNAVAILABLE:
    'The payment service is temporarily unavailable. Please try again in a moment.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  NOT_FOUND: 'We could not find what you were looking for.',
  CARD_TOKEN_EXPIRED: 'Your card details expired. Please enter them again.',
  CARD_REJECTED: 'We could not validate your card. Check the details and try again.',
  CHECKOUT_INCOMPLETE: 'Your order is incomplete. Please review your details.',
};

/** Copy is mapped from the code: server messages are never rendered verbatim. */
export function messageForCode(code: string): string {
  if (MESSAGES[code]) return MESSAGES[code];
  if (code.endsWith('_NOT_FOUND')) return MESSAGES.NOT_FOUND ?? DEFAULT_MESSAGE;
  return DEFAULT_MESSAGE;
}

export function createUiError(
  code: string,
  status: number | null = null,
  requestId: string | null = null,
): UiError {
  return { code, message: messageForCode(code), status, requestId };
}

function codeForStatus(status: number): string {
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 502 || status === 503 || status === 504) return 'SERVICE_UNAVAILABLE';
  return 'UNEXPECTED_ERROR';
}

function readEnvelope(data: unknown): { code: string; requestId: string | null } | null {
  if (typeof data !== 'object' || data === null) return null;
  const error = (data as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const { code, requestId } = error as { code?: unknown; requestId?: unknown };
  if (typeof code !== 'string' || code === '') return null;
  return { code, requestId: typeof requestId === 'string' ? requestId : null };
}

/** Normalises anything RTK Query's `fetchBaseQuery` can fail with. */
export function toUiError(error: FetchBaseQueryError): UiError {
  if (typeof error.status === 'number') {
    const envelope = readEnvelope(error.data);
    return envelope
      ? createUiError(envelope.code, error.status, envelope.requestId)
      : createUiError(codeForStatus(error.status), error.status);
  }

  if (error.status === 'PARSING_ERROR') {
    return createUiError(codeForStatus(error.originalStatus), error.originalStatus);
  }

  return createUiError('NETWORK_ERROR');
}

export function isUiError(value: unknown): value is UiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as UiError).code === 'string' &&
    typeof (value as UiError).message === 'string'
  );
}
