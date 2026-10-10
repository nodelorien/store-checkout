import { http, HttpResponse } from 'msw';
import { GATEWAY_TOKENIZATION_URL, VISA_NUMBER, buildGatewayTokenResponse } from '@/test/builders';
import { server } from '@/test/server';
import { mapTokenResponse, toTokenRequestBody } from './tokenMapping';
import { tokenizeCard } from './tokenizeCard';
import type { CardInput } from './types';

const config = { tokenizationUrl: GATEWAY_TOKENIZATION_URL, publicKey: 'pub_test_key' };
const card: CardInput = {
  number: VISA_NUMBER,
  cvc: '123',
  expMonth: '08',
  expYear: '30',
  holder: 'Ada Lovelace',
};

describe('tokenizeCard', () => {
  it('AC-8: posts the card to the tokenization URL with the public key as bearer token', async () => {
    let received: { authorization: string | null; contentType: string | null; body: unknown };
    server.use(
      http.post(GATEWAY_TOKENIZATION_URL, async ({ request }) => {
        received = {
          authorization: request.headers.get('Authorization'),
          contentType: request.headers.get('Content-Type'),
          body: await request.json(),
        };
        return HttpResponse.json(buildGatewayTokenResponse(), { status: 201 });
      }),
    );

    const result = await tokenizeCard(config, card);

    expect(received!).toEqual({
      authorization: 'Bearer pub_test_key',
      contentType: 'application/json',
      body: {
        number: VISA_NUMBER,
        cvc: '123',
        exp_month: '08',
        exp_year: '30',
        card_holder: 'Ada Lovelace',
      },
    });
    expect(result).toEqual({
      ok: true,
      token: {
        tokenId: 'tok_test_123',
        brand: 'VISA',
        lastFour: '4242',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    });
  });

  it('AC-10: maps a 422 validation error to our own English message', async () => {
    server.use(
      http.post(GATEWAY_TOKENIZATION_URL, () =>
        HttpResponse.json(
          {
            error: {
              type: 'INPUT_VALIDATION_ERROR',
              messages: { number: ['El número de tarjeta es inválido'] },
            },
          },
          { status: 422 },
        ),
      ),
    );

    const result = await tokenizeCard(config, card);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'CARD_REJECTED',
        message: 'We could not validate your card. Check the details and try again.',
        status: 422,
        requestId: null,
      },
    });
    expect(JSON.stringify(result)).not.toContain('tarjeta');
  });

  it('AC-10: maps a network failure', async () => {
    server.use(http.post(GATEWAY_TOKENIZATION_URL, () => HttpResponse.error()));

    const result = await tokenizeCard(config, card);

    expect(result).toMatchObject({ ok: false, error: { code: 'NETWORK_ERROR', status: null } });
  });

  it.each([401, 500, 503])('maps HTTP %d to a generic tokenization failure', async (status) => {
    server.use(
      http.post(GATEWAY_TOKENIZATION_URL, () => HttpResponse.json({ error: {} }, { status })),
    );

    const result = await tokenizeCard(config, card);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'CARD_TOKENIZATION_FAILED', status },
    });
  });

  it('maps a success response that is not JSON', async () => {
    server.use(http.post(GATEWAY_TOKENIZATION_URL, () => HttpResponse.text('created')));

    const result = await tokenizeCard(config, card);

    expect(result).toMatchObject({ ok: false, error: { code: 'CARD_TOKENIZATION_FAILED' } });
  });

  it('maps a success response with an unexpected shape', async () => {
    server.use(
      http.post(GATEWAY_TOKENIZATION_URL, () => HttpResponse.json({ data: { id: 'tok' } })),
    );

    const result = await tokenizeCard(config, card);

    expect(result).toMatchObject({ ok: false, error: { code: 'CARD_TOKENIZATION_FAILED' } });
  });

  it('rejects a token for a brand the store does not accept', async () => {
    server.use(
      http.post(GATEWAY_TOKENIZATION_URL, () =>
        HttpResponse.json(buildGatewayTokenResponse({ brand: 'AMEX' }), { status: 201 }),
      ),
    );

    const result = await tokenizeCard(config, card);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'CARD_BRAND_UNSUPPORTED', message: 'Only VISA and MasterCard are accepted.' },
    });
  });

  it('never returns card data in a failure', async () => {
    server.use(http.post(GATEWAY_TOKENIZATION_URL, () => HttpResponse.error()));

    const serialised = JSON.stringify(await tokenizeCard(config, card));

    expect(serialised).not.toContain(VISA_NUMBER);
    expect(serialised).not.toContain('Ada Lovelace');
  });
});

describe('token mapping', () => {
  it('builds the request body with the gateway field names', () => {
    expect(Object.keys(toTokenRequestBody(card))).toEqual([
      'number',
      'cvc',
      'exp_month',
      'exp_year',
      'card_holder',
    ]);
  });

  it('normalises the brand casing and ignores extra fields', () => {
    const mapped = mapTokenResponse(
      buildGatewayTokenResponse({
        brand: 'mastercard',
        last_four: '4444',
        exp_month: '08',
        exp_year: '30',
        card_holder: 'Ada Lovelace',
        validity_ends_at: '2099-01-03T00:00:00.000Z',
      }),
    );

    expect(mapped).toEqual({
      kind: 'token',
      token: {
        tokenId: 'tok_test_123',
        brand: 'MASTERCARD',
        lastFour: '4444',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    });
  });

  it.each([
    ['null', null],
    ['no data', { status: 'CREATED' }],
    ['an empty id', buildGatewayTokenResponse({ id: '' })],
    ['a malformed last four', buildGatewayTokenResponse({ last_four: '42' })],
    ['an unparseable expiry', buildGatewayTokenResponse({ expires_at: 'never' })],
  ])('rejects %s', (_label, body) => {
    expect(mapTokenResponse(body)).toEqual({ kind: 'invalid' });
  });
});
