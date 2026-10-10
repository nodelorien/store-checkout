import { http, HttpResponse } from 'msw';
import {
  API_URL,
  GATEWAY_TOKENIZATION_URL,
  buildCatalogue,
  buildDelivery,
  buildGatewayTokenResponse,
  buildPaymentConfig,
  buildTransaction,
} from './builders';

/** Happy-path handlers matching `docs/components/backend/api.md`. Tests override per scenario. */
export const handlers = [
  http.get(`${API_URL}/products`, () => HttpResponse.json({ data: buildCatalogue() })),
  http.get(`${API_URL}/payment-config`, () => HttpResponse.json({ data: buildPaymentConfig() })),
  http.post(`${API_URL}/transactions`, () =>
    HttpResponse.json({ data: buildTransaction() }, { status: 201 }),
  ),
  http.get(`${API_URL}/transactions/:id`, ({ params }) =>
    HttpResponse.json({ data: buildTransaction({ id: String(params.id) }) }),
  ),
  http.get(`${API_URL}/transactions/:id/delivery`, ({ params }) =>
    HttpResponse.json({ data: buildDelivery({ transactionId: String(params.id) }) }),
  ),
  http.post(GATEWAY_TOKENIZATION_URL, () =>
    HttpResponse.json(buildGatewayTokenResponse(), { status: 201 }),
  ),
];
