// Read traffic of the store: catalogue pages, searches, product pages, stock and the report.
// Arrival-rate driven, so the request rate is the same whatever the response time — which is
// what makes two runs (for example with and without the cache) comparable.
//
// Phases: warm-up → steady load → spike to PEAK_RPS → recovery.
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

const STEADY_RPS = Number(__ENV.STEADY_RPS || 200);
const PEAK_RPS = Number(__ENV.PEAK_RPS || 800);
const STEADY = __ENV.STEADY_DURATION || '60s';
const SPIKE = __ENV.SPIKE_DURATION || '20s';

export const options = {
  summaryTrendStats: TREND_STATS,
  scenarios: {
    browse: {
      executor: 'ramping-arrival-rate',
      startRate: Math.ceil(STEADY_RPS / 10),
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: [
        { target: STEADY_RPS, duration: '15s' }, // warm-up
        { target: STEADY_RPS, duration: STEADY }, // steady load
        { target: PEAK_RPS, duration: '5s' }, // the spike arrives fast
        { target: PEAK_RPS, duration: SPIKE },
        { target: STEADY_RPS, duration: '5s' },
        { target: STEADY_RPS, duration: '20s' }, // recovery
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    // Listed so each endpoint gets its own line in the summary.
    'http_req_duration{endpoint:catalogue}': ['p(95)<300'],
    'http_req_duration{endpoint:search}': ['p(95)<300'],
    'http_req_duration{endpoint:product}': ['p(95)<300'],
    'http_req_duration{endpoint:stock}': ['p(95)<300'],
    'http_req_duration{endpoint:report}': ['p(95)<500'],
    dropped_iterations: ['count<50'],
    // Stage 1 = steady load, 3 = spike, 5 = recovery.
    ...stageThresholds({ 1: 'p(95)<200', 3: 'p(95)<300', 5: 'p(95)<200' }),
  },
};

const SEARCHES = ['lamp', 'keyboard', 'audio', 'desk', 'wireless', 'smart'];
const SORTS = ['name', 'featured', 'price-asc', 'price-desc'];

export function setup() {
  const response = http.get(`${API}/products`);
  if (response.status !== 200) {
    throw new Error(`The API at ${API} is not answering (status ${response.status})`);
  }
  const products = response.json('data');
  if (products.length === 0) {
    throw new Error('The catalogue is empty: seed it first');
  }
  return { ids: products.map((product) => product.id), pages: Math.ceil(products.length / 8) };
}

function read(endpoint, path) {
  const response = http.get(`${API}${path}`, {
    headers: { 'X-Forwarded-For': clientAddress(__VU) },
    tags: { endpoint },
  });
  check(response, { 'status is 200': (r) => r.status === 200 });
}

export default function ({ ids, pages }) {
  tagStage();
  const roll = Math.random();
  if (roll < 0.45) {
    const page = 1 + Math.floor(Math.random() * pages);
    read('catalogue', `/products?page=${page}&pageSize=8&sort=${pick(SORTS)}`);
  } else if (roll < 0.6) {
    read('search', `/products?search=${pick(SEARCHES)}&pageSize=6`);
  } else if (roll < 0.8) {
    read('product', `/products/${pick(ids)}`);
  } else if (roll < 0.9) {
    read('stock', `/products/${pick(ids)}/stock`);
  } else {
    read('report', `/reports/summary?days=${pick([7, 14, 30])}`);
  }
}

export function handleSummary(data) {
  return summarize(data);
}
