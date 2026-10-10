import { Logger } from '@nestjs/common';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { testConfig } from '../../../../../test/helpers/test-config';
import { ChargeInput } from '../../application/ports/payment-gateway.port';
import { describeGatewayError, HttpPaymentGatewayAdapter } from './http-payment-gateway.adapter';
import { buildIntegritySignature } from './integrity-signature';

const config = testConfig();
const BASE = config.gateway.baseUrl;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const charge: ChargeInput = {
  reference: 'TX-20261009-ABCDEFGH',
  amountInCents: 14_040_000,
  currency: 'COP',
  customerEmail: 'ada@example.com',
  cardToken: 'tok_test_card_123',
  installments: 3,
  acceptanceToken: 'acceptance-jwt',
};

function setup(...responses: Array<Response | Error>) {
  const fetchFn = jest.fn<Promise<Response>, [string, RequestInit]>();
  for (const response of responses) {
    if (response instanceof Error) {
      fetchFn.mockRejectedValueOnce(response);
    } else {
      fetchFn.mockResolvedValueOnce(response);
    }
  }
  const adapter = new HttpPaymentGatewayAdapter(config, fetchFn as unknown as typeof fetch);
  return { adapter, fetchFn };
}

let warn: jest.SpyInstance;

beforeEach(() => {
  warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

const loggedText = (): string => JSON.stringify(warn.mock.calls);

describe('HttpPaymentGatewayAdapter.getAcceptance', () => {
  const merchant = {
    data: {
      presigned_acceptance: {
        acceptance_token: 'acc-jwt',
        permalink: 'https://gateway.test/terms.pdf',
        type: 'END_USER_POLICY',
      },
      presigned_personal_data_auth: { acceptance_token: 'pd-jwt', permalink: 'https://x/y.pdf' },
    },
  };

  it('AC-8: reads the acceptance token from the merchant endpoint without authentication', async () => {
    const { adapter, fetchFn } = setup(json(200, merchant));

    expect(expectOk(await adapter.getAcceptance())).toEqual({
      token: 'acc-jwt',
      permalink: 'https://gateway.test/terms.pdf',
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BASE}/merchants/pub_test_key`);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('AC-8: falls back to the header-based endpoint when the path-based one answers 404', async () => {
    const { adapter, fetchFn } = setup(
      json(404, { error: { type: 'NOT_FOUND_ERROR', reason: 'gone' } }),
      json(200, merchant),
    );

    expect(expectOk(await adapter.getAcceptance()).token).toBe('acc-jwt');
    const [url, init] = fetchFn.mock.calls[1];
    expect(url).toBe(`${BASE}/merchants/info`);
    expect(init.headers).toMatchObject({ 'x-merchant-public-key': 'pub_test_key' });
  });

  it.each([
    ['a 5xx', [json(503, {})]],
    ['a 4xx', [json(401, { error: { type: 'INVALID_ACCESS_TOKEN', reason: 'bad key' } })]],
    ['a network failure', [new TypeError('fetch failed')]],
    ['a 404 on both endpoints', [json(404, {}), json(404, {})]],
    ['a body without presigned_acceptance', [json(200, { data: {} })]],
    ['a body without data', [json(200, [])]],
    [
      'a token that is not a string',
      [json(200, { data: { presigned_acceptance: { acceptance_token: 1 } } })],
    ],
  ])('AC-6: returns PAYMENT_GATEWAY_UNAVAILABLE on %s', async (_name, responses) => {
    const { adapter } = setup(...responses);

    expectErr(await adapter.getAcceptance(), 'PAYMENT_GATEWAY_UNAVAILABLE');
  });
});

describe('HttpPaymentGatewayAdapter.createCharge', () => {
  it('AC-4: posts the snake_case charge with the private key and the integrity signature', async () => {
    const { adapter, fetchFn } = setup(
      json(201, { data: { id: 'gw-1', status: 'PENDING', status_message: null } }),
    );

    const result = expectOk(await adapter.createCharge(charge));

    expect(result).toEqual({ id: 'gw-1', status: 'PENDING', statusMessage: undefined });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BASE}/transactions`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Bearer prv_test_key',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      amount_in_cents: 14_040_000,
      currency: 'COP',
      customer_email: 'ada@example.com',
      reference: 'TX-20261009-ABCDEFGH',
      signature: buildIntegritySignature({
        reference: 'TX-20261009-ABCDEFGH',
        amountInCents: 14_040_000,
        currency: 'COP',
        integritySecret: 'test_integrity_secret',
      }),
      acceptance_token: 'acceptance-jwt',
      payment_method: { type: 'CARD', token: 'tok_test_card_123', installments: 3 },
    });
  });

  it('AC-4: maps a final status and its message', async () => {
    const { adapter } = setup(
      json(201, { data: { id: 'gw-1', status: 'DECLINED', status_message: 'Insufficient funds' } }),
    );

    expect(expectOk(await adapter.createCharge(charge))).toEqual({
      id: 'gw-1',
      status: 'DECLINED',
      statusMessage: 'Insufficient funds',
    });
  });

  it('AC-5: returns PAYMENT_GATEWAY_REJECTED with a generic message on 4xx', async () => {
    const { adapter } = setup(
      json(422, {
        error: {
          type: 'INPUT_VALIDATION_ERROR',
          messages: {
            acceptance_token: ['already used by ada@example.com'],
            payment_method: { token: ['invalid'] },
          },
        },
      }),
    );

    const error = expectErr(await adapter.createCharge(charge), 'PAYMENT_GATEWAY_REJECTED');

    expect(error.message).toBe('The payment gateway rejected the request');
    expect(error.message).not.toContain('already used');
  });

  it('AC-9: logs the rejection without secrets or personal data', async () => {
    const { adapter } = setup(
      json(422, {
        error: {
          type: 'INPUT_VALIDATION_ERROR',
          messages: { customer_email: ['ada@example.com is invalid'], reference: 'dup' },
        },
      }),
    );

    await adapter.createCharge(charge);

    const logged = loggedText();
    expect(logged).toContain('INPUT_VALIDATION_ERROR');
    expect(logged).toContain('customer_email');
    expect(logged).not.toContain('ada@example.com');
    expect(logged).not.toContain('tok_test_card_123');
    expect(logged).not.toContain('prv_test_key');
    expect(logged).not.toContain('acceptance-jwt');
  });

  it.each([
    ['a 500', json(500, { error: 'oops' })],
    ['a 502 with a non-JSON body', new Response('<html>bad gateway</html>', { status: 502 })],
    ['a 408', json(408, {})],
    ['a 429', json(429, {})],
    ['a timeout', Object.assign(new Error('timed out'), { name: 'TimeoutError' })],
    ['a network failure', new TypeError('fetch failed')],
    ['a body without data.id', json(201, { data: { status: 'PENDING' } })],
    ['a body without data.status', json(201, { data: { id: 'gw-1' } })],
    ['an empty body', new Response(null, { status: 201 })],
  ])('AC-6: returns PAYMENT_GATEWAY_UNAVAILABLE on %s', async (_name, response) => {
    const { adapter } = setup(response);

    expectErr(await adapter.createCharge(charge), 'PAYMENT_GATEWAY_UNAVAILABLE');
  });

  it('AC-6: reports a non-Error rejection as unavailable', async () => {
    const fetchFn = jest.fn().mockRejectedValue('weird');
    const adapter = new HttpPaymentGatewayAdapter(config, fetchFn as unknown as typeof fetch);

    expectErr(await adapter.createCharge(charge), 'PAYMENT_GATEWAY_UNAVAILABLE');
  });

  it('passes an unknown status through and warns', async () => {
    const { adapter } = setup(json(201, { data: { id: 'gw-1', status: 'IN_REVIEW' } }));

    expect(expectOk(await adapter.createCharge(charge)).status).toBe('IN_REVIEW');
    expect(loggedText()).toContain('unknown gateway status');
  });
});

describe('HttpPaymentGatewayAdapter.getCharge', () => {
  it('AC-7: gets the charge with the private key and maps status and message', async () => {
    const { adapter, fetchFn } = setup(
      json(200, { data: { id: 'gw/1', status: 'APPROVED', status_message: null } }),
    );

    expect(expectOk(await adapter.getCharge('gw/1'))).toEqual({
      id: 'gw/1',
      status: 'APPROVED',
      statusMessage: undefined,
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BASE}/transactions/gw%2F1`);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer prv_test_key',
    });
    expect(init.body).toBeUndefined();
  });

  it.each([
    ['a 404', json(404, { error: { type: 'NOT_FOUND_ERROR', reason: 'no such transaction' } })],
    ['a 500', json(500, {})],
    ['a network failure', new TypeError('fetch failed')],
    ['an unexpected body', json(200, { data: null })],
  ])('AC-7: returns PAYMENT_GATEWAY_UNAVAILABLE on %s', async (_name, response) => {
    const { adapter } = setup(response);

    expectErr(await adapter.getCharge('gw-1'), 'PAYMENT_GATEWAY_UNAVAILABLE');
  });
});

describe('describeGatewayError', () => {
  it('AC-9: summarises nested validation messages with redaction', () => {
    expect(
      describeGatewayError({
        error: {
          type: 'INPUT_VALIDATION_ERROR',
          messages: {
            reference: ['already used'],
            payment_method: { token: ['expired'], phone: 'call 3001234567' },
          },
        },
      }),
    ).toEqual({
      type: 'INPUT_VALIDATION_ERROR',
      reason: undefined,
      fields: {
        reference: 'already used',
        'payment_method.token': 'expired',
        'payment_method.phone': 'call [REDACTED]',
      },
    });
  });

  it('AC-9: handles reason-style errors and unknown shapes', () => {
    expect(describeGatewayError({ error: { type: 'NOT_FOUND_ERROR', reason: 'missing' } })).toEqual(
      { type: 'NOT_FOUND_ERROR', reason: 'missing', fields: {} },
    );
    expect(describeGatewayError(undefined)).toEqual({
      type: 'UNKNOWN',
      reason: undefined,
      fields: {},
    });
    expect(describeGatewayError({ error: 'text' }).type).toBe('UNKNOWN');
  });
});
