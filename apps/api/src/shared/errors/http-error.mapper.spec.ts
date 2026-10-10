import { DOMAIN_ERROR_CODES, DomainErrorCode, DomainErrors } from './domain-error';
import { domainErrorToHttp, GENERIC_ERROR_MESSAGE, httpStatusFor } from './http-error.mapper';

describe('httpStatusFor', () => {
  const expected: Record<DomainErrorCode, number> = {
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

  it.each(DOMAIN_ERROR_CODES)('AC-2: maps %s to its documented status', (code) => {
    expect(httpStatusFor(code)).toBe(expected[code]);
  });
});

describe('domainErrorToHttp', () => {
  it('AC-2: renders the envelope with code, message, details and request id', () => {
    const error = DomainErrors.invalidField('quantity', 'quantity must be at least 1');

    expect(domainErrorToHttp(error, 'req-1')).toEqual({
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'quantity must be at least 1',
          details: [{ field: 'quantity', message: 'quantity must be at least 1' }],
          requestId: 'req-1',
        },
      },
    });
  });

  it('AC-3: hides the internal message of persistence errors', () => {
    const { status, body } = domainErrorToHttp(
      DomainErrors.persistence('ProvisionedThroughputExceededException on table x'),
      'req-2',
    );

    expect(status).toBe(500);
    expect(body.error.message).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe('DomainErrors', () => {
  it('builds every error with its code', () => {
    expect(DomainErrors.validation('x').code).toBe('VALIDATION_ERROR');
    expect(DomainErrors.productNotFound().code).toBe('PRODUCT_NOT_FOUND');
    expect(DomainErrors.customerNotFound().code).toBe('CUSTOMER_NOT_FOUND');
    expect(DomainErrors.transactionNotFound().code).toBe('TRANSACTION_NOT_FOUND');
    expect(DomainErrors.deliveryNotFound().code).toBe('DELIVERY_NOT_FOUND');
    expect(DomainErrors.deliveryNotEditable('SHIPPED').code).toBe('DELIVERY_NOT_EDITABLE');
    expect(DomainErrors.gatewayRejected().code).toBe('PAYMENT_GATEWAY_REJECTED');
    expect(DomainErrors.gatewayUnavailable().code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');
    expect(DomainErrors.invalidSignature().code).toBe('INVALID_SIGNATURE');
    expect(DomainErrors.persistence().code).toBe('PERSISTENCE_ERROR');
  });

  it('pluralises the out-of-stock message', () => {
    expect(DomainErrors.outOfStock(0).message).toBe('Only 0 units left');
    expect(DomainErrors.outOfStock(1).message).toBe('Only 1 unit left');
  });
});
