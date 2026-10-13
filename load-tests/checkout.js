// Purchases end to end: payment configuration, charge, status read and the catalogue afterwards.
// Run it only against an API whose gateway is the local stand-in (run.sh does that): a load test
// must never send traffic to the payment gateway's sandbox.
import http from 'k6/http';
import { check } from 'k6';
import {
  API,
  TREND_STATS,
  clientAddress,
  pick,
  stageThresholds,
  summarize,
  tagStage,
} from './lib/common.js';

const RATE = Number(__ENV.CHECKOUT_RPS || 20);
const PEAK = Number(__ENV.CHECKOUT_PEAK_RPS || 60);

export const options = {
  summaryTrendStats: TREND_STATS,
  scenarios: {
    checkout: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: RATE, duration: '10s' },
        { target: RATE, duration: __ENV.STEADY_DURATION || '45s' },
        { target: PEAK, duration: '5s' },
        { target: PEAK, duration: __ENV.SPIKE_DURATION || '15s' },
        { target: RATE, duration: '10s' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:pay}': ['p(95)<1500'],
    'http_req_duration{endpoint:payment-config}': ['p(95)<800'],
    'http_req_duration{endpoint:transaction}': ['p(95)<300'],
    'http_req_duration{endpoint:catalogue}': ['p(95)<300'],
    checks: ['rate>0.99'],
    // Stage 1 = steady load, 3 = spike (all requests of the purchase together).
    ...stageThresholds({ 1: 'p(95)<1500', 3: 'p(95)<1500' }),
  },
};

export function setup() {
  const response = http.get(`${API}/products`);
  if (response.status !== 200) {
    throw new Error(`The API at ${API} is not answering (status ${response.status})`);
  }
  return { ids: response.json('data').map((product) => product.id) };
}

export default function ({ ids }) {
  tagStage();
  // Every iteration is a different shopper: own address, own e-mail, own idempotency key.
  const shopper = `${__VU}-${__ITER}`;
  const headers = { 'X-Forwarded-For': clientAddress(__VU * 1000 + (__ITER % 1000)) };

  const config = http.get(`${API}/payment-config`, {
    headers,
    tags: { endpoint: 'payment-config' },
  });
  if (!check(config, { 'payment config is 200': (r) => r.status === 200 })) {
    return;
  }

  const payment = http.post(
    `${API}/transactions`,
    JSON.stringify({
      productId: pick(ids),
      quantity: 1,
      cardToken: Math.random() < 0.85 ? 'tok_test_approved' : 'tok_test_declined',
      cardBrand: 'VISA',
      cardLastFour: '4242',
      installments: 1,
      acceptanceToken: config.json('data.acceptance.token'),
      customer: {
        fullName: 'Load Test Shopper',
        email: `shopper-${shopper}@example.com`,
        phone: '+573001234567',
      },
      delivery: {
        addressLine1: 'Cra 7 # 71-21',
        city: 'Bogotá',
        region: 'Cundinamarca',
        country: 'CO',
      },
    }),
    {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Idempotency-Key': `load-${shopper}-${Date.now()}`,
      },
      tags: { endpoint: 'pay' },
    },
  );
  const paid = check(payment, {
    'payment is 201': (r) => r.status === 201,
    'payment is final': (r) => ['APPROVED', 'DECLINED'].includes(r.json('data.status')),
  });
  if (!paid) {
    return;
  }

  const status = http.get(`${API}/transactions/${payment.json('data.id')}`, {
    headers,
    tags: { endpoint: 'transaction' },
  });
  check(status, { 'transaction is 200': (r) => r.status === 200 });

  const catalogue = http.get(`${API}/products?page=1&pageSize=8`, {
    headers,
    tags: { endpoint: 'catalogue' },
  });
  check(catalogue, { 'catalogue is 200': (r) => r.status === 200 });
}

export function handleSummary(data) {
  return summarize(data);
}
