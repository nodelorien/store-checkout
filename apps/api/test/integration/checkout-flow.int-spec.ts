import { randomUUID } from 'node:crypto';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import request from 'supertest';
import { TOKENS } from './support/gateway-stub';
import { aProductItem, IntegrationApp, startIntegrationApp } from './support/integration-app';

/**
 * The whole purchase through HTTP: real controllers, use cases, DynamoDB repositories (atomic
 * writes and indexes included), Redis cache and gateway adapter. Only the gateway is a stand-in.
 */
describe('checkout flow (integration)', () => {
  let it_: IntegrationApp;
  let client = 0;

  /** A fresh client address per request keeps the rate limiter out of the way. */
  const address = (): string => `10.0.${Math.floor(client / 250)}.${(client++ % 250) + 1}`;
  const api = () => request(it_.app.getHttpServer());
  const get = (path: string) => api().get(`/api/v1${path}`).set('X-Forwarded-For', address());

  const purchase = (productId: string, overrides: Record<string, unknown> = {}) => ({
    productId,
    quantity: 1,
    cardToken: TOKENS.approved,
    cardBrand: 'VISA',
    cardLastFour: '4242',
    installments: 1,
    acceptanceToken: 'acceptance-token-for-tests',
    customer: { fullName: 'Ada Lovelace', email: 'ada@example.com', phone: '+573001234567' },
    delivery: {
      addressLine1: 'Cra 7 # 71-21',
      city: 'Bogotá',
      region: 'Cundinamarca',
      country: 'CO',
    },
    ...overrides,
  });

  const pay = (body: Record<string, unknown>, idempotencyKey?: string) => {
    const call = api().post('/api/v1/transactions').set('X-Forwarded-For', address());
    return (idempotencyKey ? call.set('Idempotency-Key', idempotencyKey) : call).send(body);
  };

  const newProduct = async (stock = 5, priceInCents = 12_990_000): Promise<string> => {
    const product = aProductItem({ stock, priceInCents, name: `Lamp ${randomUUID().slice(0, 6)}` });
    await it_.putProduct(product);
    return product.id;
  };

  beforeAll(async () => {
    it_ = await startIntegrationApp({ CACHE_TTL_REPORTS_SECONDS: '1' });
  });

  afterAll(async () => {
    await it_.close();
  });

  beforeEach(() => {
    it_.gateway.reset();
  });

  it('approves a payment: stock, delivery and customer are written together', async () => {
    const productId = await newProduct(5);

    const response = await pay(purchase(productId, { quantity: 2, installments: 3 })).expect(201);
    const transaction = response.body.data;

    expect(transaction).toMatchObject({
      status: 'APPROVED',
      quantity: 2,
      amounts: {
        subtotalInCents: 25_980_000,
        baseFeeInCents: 250_000,
        deliveryFeeInCents: 800_000,
        totalInCents: 27_030_000,
      },
      card: { brand: 'VISA', lastFour: '4242' },
    });
    expect(transaction.reference).toMatch(/^TX-\d{8}-[A-Z0-9]{8}$/);
    expect(await it_.stockOf(productId)).toBe(3);

    // The gateway was charged the server-side total, once.
    expect(it_.gateway.charges).toHaveLength(1);
    expect(it_.gateway.charges[0]).toMatchObject({
      reference: transaction.reference,
      amountInCents: 27_030_000,
    });

    const stored = await get(`/transactions/${transaction.id}`).expect(200);
    expect(stored.body.data).toMatchObject({
      status: 'APPROVED',
      deliveryId: transaction.deliveryId,
    });

    const delivery = await get(`/transactions/${transaction.id}/delivery`).expect(200);
    expect(delivery.body.data).toMatchObject({
      id: transaction.deliveryId,
      status: 'PENDING',
      quantity: 2,
      address: { addressLine1: 'Cra 7 # 71-21', city: 'Bogotá' },
    });

    const customer = await get(`/customers/${transaction.customerId}`).expect(200);
    expect(customer.body.data.email).toBe('ada@example.com');
  });

  it('corrects the delivery address while the order is being prepared', async () => {
    const productId = await newProduct();
    const { body } = await pay(purchase(productId)).expect(201);

    const patched = await api()
      .patch(`/api/v1/deliveries/${body.data.deliveryId}`)
      .set('X-Forwarded-For', address())
      .send({ addressLine1: 'Calle 100 # 8A-55', addressLine2: 'Torre C' })
      .expect(200);

    expect(patched.body.data.address).toMatchObject({
      addressLine1: 'Calle 100 # 8A-55',
      addressLine2: 'Torre C',
      city: 'Bogotá',
    });
    const reread = await get(`/deliveries/${body.data.deliveryId}`).expect(200);
    expect(reread.body.data.address.addressLine1).toBe('Calle 100 # 8A-55');
  });

  it('declines a payment without touching stock or creating a delivery', async () => {
    const productId = await newProduct(5);

    const response = await pay(purchase(productId, { cardToken: TOKENS.declined })).expect(201);

    expect(response.body.data).toMatchObject({
      status: 'DECLINED',
      statusMessage: 'Insufficient funds',
      deliveryId: null,
    });
    expect(await it_.stockOf(productId)).toBe(5);
    const delivery = await get(`/transactions/${response.body.data.id}/delivery`).expect(404);
    expect(delivery.body.error.code).toBe('DELIVERY_NOT_FOUND');
  });

  it('follows a payment that is pending at first until the gateway approves it', async () => {
    const productId = await newProduct(4);

    const response = await pay(purchase(productId, { cardToken: TOKENS.slow })).expect(201);

    expect(response.body.data.status).toBe('APPROVED');
    expect(it_.gateway.charges[0].reads).toBeGreaterThanOrEqual(1);
    expect(await it_.stockOf(productId)).toBe(3);
  });

  it('charges once when the same Idempotency-Key is sent twice', async () => {
    const productId = await newProduct(5);
    const key = randomUUID();

    const first = await pay(purchase(productId), key).expect(201);
    const replay = await pay(purchase(productId), key).expect(200);

    expect(replay.body.data.id).toBe(first.body.data.id);
    expect(it_.gateway.charges).toHaveLength(1);
    expect(await it_.stockOf(productId)).toBe(4);
  });

  it('refuses a purchase beyond the stock before charging anything', async () => {
    const productId = await newProduct(1);

    const response = await pay(purchase(productId, { quantity: 2 })).expect(409);

    expect(response.body.error.code).toBe('OUT_OF_STOCK');
    expect(it_.gateway.charges).toHaveLength(0);
  });

  it('never sells the last unit twice when two buyers pay at the same time', async () => {
    const productId = await newProduct(1);

    const [a, b] = await Promise.all([
      pay(
        purchase(productId, {
          customer: { fullName: 'Buyer One', email: 'one@example.com', phone: '+573001111111' },
        }),
      ),
      pay(
        purchase(productId, {
          customer: { fullName: 'Buyer Two', email: 'two@example.com', phone: '+573002222222' },
        }),
      ),
    ]);
    const statuses = [a.body.data.status, b.body.data.status].sort();

    // The conditional write lets exactly one approval through; the other ends in ERROR.
    expect(statuses).toEqual(['APPROVED', 'ERROR']);
    expect(await it_.stockOf(productId)).toBe(0);
    const loser = a.body.data.status === 'ERROR' ? a.body.data : b.body.data;
    expect(loser.deliveryId).toBeNull();
  });

  it('stores the attempt as ERROR when the gateway rejects or is down', async () => {
    const productId = await newProduct(5);

    const rejected = await pay(purchase(productId, { cardToken: TOKENS.rejected })).expect(422);
    expect(rejected.body.error.code).toBe('PAYMENT_GATEWAY_REJECTED');

    it_.gateway.failWithStatus = 503;
    const down = await pay(purchase(productId)).expect(502);
    expect(down.body.error.code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');

    const details = down.body.error.details as Array<{ field: string; message: string }>;
    const transactionId = details.find((detail) => detail.field === 'transactionId')!.message;
    it_.gateway.failWithStatus = undefined;
    const stored = await get(`/transactions/${transactionId}`).expect(200);
    expect(stored.body.data.status).toBe('ERROR');
    expect(await it_.stockOf(productId)).toBe(5);
  });

  it('rejects card data sent to the API', async () => {
    const productId = await newProduct();

    const response = await pay(
      purchase(productId, { number: '4242424242424242', cvc: '123' }),
    ).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(it_.gateway.charges).toHaveLength(0);
  });

  describe('catalogue cache', () => {
    const key = (): string => `catalogue:${it_.tables.products}`;
    const stockInCatalogue = async (productId: string): Promise<number> => {
      const { body } = await get('/products').expect(200);
      return (body.data as Array<{ id: string; stock: number }>).find(
        (product) => product.id === productId,
      )!.stock;
    };

    it('serves the catalogue from Redis and refreshes it when a payment is approved', async () => {
      const productId = await newProduct(7);
      await it_.redis.del(key());

      expect(await stockInCatalogue(productId)).toBe(7);
      const ttl = await it_.redis.ttl(key());
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);

      // A change behind the cache's back is not visible: the answer really comes from Redis.
      await it_.dynamo.send(
        new UpdateCommand({
          TableName: it_.tables.products,
          Key: { id: productId },
          UpdateExpression: 'SET stock = :s',
          ExpressionAttributeValues: { ':s': 6 },
        }),
      );
      expect(await stockInCatalogue(productId)).toBe(7);
      // The single-product stock is never cached.
      expect((await get(`/products/${productId}/stock`).expect(200)).body.data.stock).toBe(6);

      await pay(purchase(productId)).expect(201);

      expect(await it_.redis.exists(key())).toBe(0);
      expect(await stockInCatalogue(productId)).toBe(5);
    });

    it('keeps the cached catalogue when a payment is declined', async () => {
      const productId = await newProduct(3);
      await it_.redis.del(key());
      await stockInCatalogue(productId);

      await pay(purchase(productId, { cardToken: TOKENS.declined })).expect(201);

      expect(await it_.redis.exists(key())).toBe(1);
    });

    it('searches, sorts and pages over the cached catalogue', async () => {
      await it_.redis.del(key());
      const marker = `zz${randomUUID().slice(0, 6)}`;
      for (const [name, priceInCents] of [
        ['B', 300],
        ['A', 100],
        ['C', 200],
      ] as const) {
        await it_.putProduct(aProductItem({ name: `${marker} ${name}`, priceInCents }));
      }

      const page = await get(`/products?search=${marker}&sort=price-desc&pageSize=2`).expect(200);

      expect(page.body.data.map((product: { name: string }) => product.name)).toEqual([
        `${marker} B`,
        `${marker} C`,
      ]);
      expect(page.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    });
  });

  it('reports the sales of the day from stored transactions, without personal data', async () => {
    // Priced far above the rest so it is certainly among the top products of the day.
    const productId = await newProduct(9, 900_000_000);
    await pay(purchase(productId, { quantity: 2 })).expect(201);
    await pay(purchase(productId, { cardToken: TOKENS.declined })).expect(201);
    // Let a report cached by an earlier read expire (1 s in this suite).
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const { body } = await get('/reports/summary?days=1').expect(200);
    const top = (body.data.topProducts as Array<{ productId: string }>).find(
      (entry) => entry.productId === productId,
    );

    expect(top).toMatchObject({ unitsSold: 2, revenueInCents: 1_801_050_000 });
    expect(body.data.totals.approvedOrders).toBeGreaterThanOrEqual(1);
    expect(body.data.totals.totalAttempts).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(body)).not.toContain('ada@example.com');
    expect(await it_.redis.keys(`sales:${it_.tables.transactions}:*`)).toHaveLength(1);
  });
});
