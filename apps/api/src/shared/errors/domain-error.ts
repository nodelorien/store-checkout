/** Error vocabulary shared by every module. HTTP mapping lives in `http-error.mapper.ts`. */

export const DOMAIN_ERROR_CODES = [
  'VALIDATION_ERROR',
  'PRODUCT_NOT_FOUND',
  'CUSTOMER_NOT_FOUND',
  'TRANSACTION_NOT_FOUND',
  'DELIVERY_NOT_FOUND',
  'OUT_OF_STOCK',
  'DELIVERY_NOT_EDITABLE',
  'PAYMENT_GATEWAY_REJECTED',
  'PAYMENT_GATEWAY_UNAVAILABLE',
  'INVALID_SIGNATURE',
  'PERSISTENCE_ERROR',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export interface ErrorDetail {
  readonly field: string;
  readonly message: string;
}

export interface DomainError<C extends DomainErrorCode = DomainErrorCode> {
  readonly code: C;
  readonly message: string;
  readonly details: readonly ErrorDetail[];
}

function make<C extends DomainErrorCode>(
  code: C,
  message: string,
  details: readonly ErrorDetail[] = [],
): DomainError<C> {
  return { code, message, details };
}

export const DomainErrors = {
  validation: (message: string, details: readonly ErrorDetail[] = []) =>
    make('VALIDATION_ERROR', message, details),
  invalidField: (field: string, message: string) =>
    make('VALIDATION_ERROR', message, [{ field, message }]),
  productNotFound: () => make('PRODUCT_NOT_FOUND', 'Product not found'),
  customerNotFound: () => make('CUSTOMER_NOT_FOUND', 'Customer not found'),
  transactionNotFound: () => make('TRANSACTION_NOT_FOUND', 'Transaction not found'),
  deliveryNotFound: () => make('DELIVERY_NOT_FOUND', 'Delivery not found'),
  outOfStock: (available: number) =>
    make('OUT_OF_STOCK', `Only ${available} ${available === 1 ? 'unit' : 'units'} left`),
  deliveryNotEditable: (status: string) =>
    make('DELIVERY_NOT_EDITABLE', `The delivery can no longer be changed (status ${status})`),
  gatewayRejected: (message = 'The payment gateway rejected the request') =>
    make('PAYMENT_GATEWAY_REJECTED', message),
  gatewayUnavailable: (message = 'The payment gateway is not available, try again later') =>
    make('PAYMENT_GATEWAY_UNAVAILABLE', message),
  invalidSignature: () => make('INVALID_SIGNATURE', 'The event signature is not valid'),
  persistence: (message = 'The data store is not available') => make('PERSISTENCE_ERROR', message),
} as const;
