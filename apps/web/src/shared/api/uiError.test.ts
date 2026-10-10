import { createUiError, isUiError, messageForCode, toUiError } from './uiError';

describe('toUiError', () => {
  it('AC-3: keeps the code and request id of an error envelope and maps friendly copy', () => {
    const error = toUiError({
      status: 409,
      data: {
        error: { code: 'OUT_OF_STOCK', message: 'Only 0 units left', details: [], requestId: 'r1' },
      },
    });

    expect(error).toEqual({
      code: 'OUT_OF_STOCK',
      message: 'Sorry, this product just sold out.',
      status: 409,
      requestId: 'r1',
    });
  });

  it('AC-3: never renders the server message verbatim', () => {
    const error = toUiError({
      status: 500,
      data: { error: { code: 'PERSISTENCE_ERROR', message: 'table tx-prod unreachable' } },
    });

    expect(error.message).toBe('Something went wrong. Please try again.');
    expect(error.requestId).toBeNull();
  });

  it.each([
    [404, 'NOT_FOUND'],
    [429, 'RATE_LIMITED'],
    [502, 'SERVICE_UNAVAILABLE'],
    [500, 'UNEXPECTED_ERROR'],
  ])('derives the code from HTTP %d when there is no envelope', (status, code) => {
    expect(toUiError({ status, data: undefined }).code).toBe(code);
  });

  it.each([null, 'text', { error: null }, { error: { code: 42 } }, { error: { code: '' } }])(
    'ignores a malformed envelope: %p',
    (data) => {
      expect(toUiError({ status: 400, data }).code).toBe('UNEXPECTED_ERROR');
    },
  );

  it('maps a non-JSON body to the original HTTP status', () => {
    const error = toUiError({
      status: 'PARSING_ERROR',
      originalStatus: 502,
      data: '<html>',
      error: 'SyntaxError',
    });

    expect(error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 502 });
  });

  it.each(['FETCH_ERROR', 'TIMEOUT_ERROR'] as const)('maps %s to a network error', (status) => {
    expect(toUiError({ status, error: 'failed' })).toEqual({
      code: 'NETWORK_ERROR',
      message: 'We could not reach the server. Check your connection and try again.',
      status: null,
      requestId: null,
    });
  });
});

describe('messageForCode', () => {
  it('has specific copy for resource not-found codes', () => {
    expect(messageForCode('TRANSACTION_NOT_FOUND')).toBe(
      'We could not find what you were looking for.',
    );
  });
});

describe('isUiError', () => {
  it('recognises a UiError and rejects anything else', () => {
    expect(isUiError(createUiError('NETWORK_ERROR'))).toBe(true);
    expect(isUiError(new Error('boom'))).toBe(false);
    expect(isUiError(null)).toBe(false);
    expect(isUiError('NETWORK_ERROR')).toBe(false);
  });
});
