import { http, HttpResponse } from 'msw';
import { createAppStore } from '@/app/store';
import { baseApi } from '@/shared/api/baseApi';
import type { CardInput } from '@/shared/gateway/types';
import { createActionRecorder } from '@/test/actionRecorder';
import {
  API_URL,
  GATEWAY_TOKENIZATION_URL,
  VISA_NUMBER,
  buildGatewayTokenResponse,
  errorEnvelope,
} from '@/test/builders';
import { server } from '@/test/server';
import { delivery, paymentInfoState } from '@/test/states';
import { loadPaymentConfig, submitPaymentInfo } from './thunks';

const card: CardInput = {
  number: VISA_NUMBER,
  cvc: '987',
  expMonth: '08',
  expYear: '30',
  holder: 'Ada Holder Lovelace',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('submitPaymentInfo', () => {
  it('AC-8: tokenizes the card and moves to the summary with token, delivery and key', async () => {
    const store = createAppStore(paymentInfoState());

    const ok = await store.dispatch(submitPaymentInfo(card, delivery));

    expect(ok).toBe(true);
    expect(store.getState().checkout).toMatchObject({
      step: 'SUMMARY',
      card: {
        tokenId: 'tok_test_123',
        brand: 'VISA',
        lastFour: '4242',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
      delivery,
      acceptedTerms: true,
      submission: { status: 'idle', error: null },
    });
    expect(store.getState().checkout.idempotencyKey).toMatch(UUID);
  });

  it('AC-9: card data never appears in the state or in any dispatched action', async () => {
    const recorder = createActionRecorder();
    const store = createAppStore(paymentInfoState(), { extraMiddleware: [recorder.middleware] });
    const states: string[] = [];
    store.subscribe(() => states.push(JSON.stringify(store.getState())));

    await store.dispatch(submitPaymentInfo(card, delivery));

    expect(recorder.types()).toEqual(
      expect.arrayContaining(['checkout/tokenizationStarted', 'checkout/paymentInfoSubmitted']),
    );
    for (const serialised of [...recorder.actions, ...states]) {
      expect(serialised).not.toContain(VISA_NUMBER);
      expect(serialised).not.toContain('Ada Holder Lovelace');
      expect(serialised).not.toMatch(/"(number|cvc|exp_month|exp_year|card_holder|holder)"/);
    }
  });

  it('AC-9: card data is not leaked on a failed tokenization either', async () => {
    server.use(
      http.post(GATEWAY_TOKENIZATION_URL, () => HttpResponse.json({ error: {} }, { status: 422 })),
    );
    const recorder = createActionRecorder();
    const store = createAppStore(paymentInfoState(), { extraMiddleware: [recorder.middleware] });

    await store.dispatch(submitPaymentInfo(card, delivery));

    expect(recorder.actions.join('\n')).not.toContain(VISA_NUMBER);
    expect(JSON.stringify(store.getState())).not.toContain(VISA_NUMBER);
  });

  it('AC-10: a rejected card keeps the step and stores a UiError', async () => {
    server.use(
      http.post(GATEWAY_TOKENIZATION_URL, () => HttpResponse.json({ error: {} }, { status: 422 })),
    );
    const store = createAppStore(paymentInfoState());

    const ok = await store.dispatch(submitPaymentInfo(card, delivery));

    expect(ok).toBe(false);
    expect(store.getState().checkout).toMatchObject({
      step: 'PAYMENT_INFO',
      card: null,
      idempotencyKey: null,
      submission: { status: 'failed', error: { code: 'CARD_REJECTED' } },
    });
  });

  it('AC-14: fails without calling the gateway when the payment config is unavailable', async () => {
    let gatewayCalls = 0;
    server.use(
      http.get(`${API_URL}/payment-config`, () =>
        HttpResponse.json(errorEnvelope('PAYMENT_GATEWAY_UNAVAILABLE'), { status: 502 }),
      ),
      http.post(GATEWAY_TOKENIZATION_URL, () => {
        gatewayCalls += 1;
        return HttpResponse.json(buildGatewayTokenResponse(), { status: 201 });
      }),
    );
    const store = createAppStore(paymentInfoState());

    const ok = await store.dispatch(submitPaymentInfo(card, delivery));

    expect(ok).toBe(false);
    expect(gatewayCalls).toBe(0);
    expect(store.getState().checkout.submission).toMatchObject({
      status: 'failed',
      error: { code: 'PAYMENT_CONFIG_UNAVAILABLE' },
    });
  });

  it('AC-13: ignores a second submission while tokenizing', async () => {
    let gatewayCalls = 0;
    server.use(
      http.post(GATEWAY_TOKENIZATION_URL, () => {
        gatewayCalls += 1;
        return HttpResponse.json(buildGatewayTokenResponse(), { status: 201 });
      }),
    );
    const store = createAppStore(paymentInfoState());

    const [first, second] = await Promise.all([
      store.dispatch(submitPaymentInfo(card, delivery)),
      store.dispatch(submitPaymentInfo(card, delivery)),
    ]);

    expect([first, second]).toEqual([true, false]);
    expect(gatewayCalls).toBe(1);
  });
});

describe('loadPaymentConfig', () => {
  it('uses the cache by default and refetches when a fresh copy is required', async () => {
    let requests = 0;
    server.use(
      http.get(`${API_URL}/payment-config`, () => {
        requests += 1;
        return HttpResponse.json({
          data: { acceptance: { token: `acceptance-${requests}` } },
        });
      }),
    );
    const store = createAppStore();
    // Keep a subscription so the cache entry stays alive, as a mounted component would.
    const subscription = store.dispatch(baseApi.endpoints.getPaymentConfig.initiate());
    await subscription;

    const cached = await loadPaymentConfig(store.dispatch);
    const fresh = await loadPaymentConfig(store.dispatch, { fresh: true });

    expect(cached?.acceptance.token).toBe('acceptance-1');
    expect(fresh?.acceptance.token).toBe('acceptance-2');
    expect(requests).toBe(2);
    subscription.unsubscribe();
  });

  it('returns null when the request fails', async () => {
    server.use(http.get(`${API_URL}/payment-config`, () => HttpResponse.error()));

    expect(await loadPaymentConfig(createAppStore().dispatch)).toBeNull();
  });
});
