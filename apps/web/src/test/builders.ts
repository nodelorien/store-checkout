import type {
  Delivery,
  PaymentConfig,
  Product,
  SalesSummary,
  Transaction,
} from '@/shared/api/types';

export const API_URL = 'http://localhost/api/v1';
export const GATEWAY_TOKENIZATION_URL = 'https://gateway.test/v1/tokens/cards';

export const VISA_NUMBER = '4242424242424242';
export const MASTERCARD_NUMBER = '5555555555554444';

export const PRODUCT_ID = '0b9f6a52-2f5e-4d0c-9a57-3a1f5f0c1a01';
export const TRANSACTION_ID = '7d3c1e7a-6b1f-4a43-8f0e-2f1d9a6c5b10';

export function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: PRODUCT_ID,
    name: 'Aurora Desk Lamp',
    description: 'Dimmable LED desk lamp with a warm-to-cool light range.',
    priceInCents: 12990000,
    currency: 'COP',
    imageUrl: '/images/products/aurora-desk-lamp.svg',
    stock: 12,
    ...overrides,
  };
}

/** Mirrors the six products the backend seeds. */
export function buildCatalogue(): Product[] {
  return [
    buildProduct(),
    buildProduct({
      id: '0b9f6a52-2f5e-4d0c-9a57-3a1f5f0c1a02',
      name: 'Nimbus Headphones',
      description: 'Wireless over-ear headphones with active noise cancelling.',
      priceInCents: 45990000,
      imageUrl: '/images/products/nimbus-headphones.svg',
      stock: 8,
    }),
    buildProduct({
      id: '0b9f6a52-2f5e-4d0c-9a57-3a1f5f0c1a03',
      name: 'Terra Backpack',
      description: 'Water-resistant 22 L backpack with a padded laptop sleeve.',
      priceInCents: 18990000,
      imageUrl: '/images/products/terra-backpack.svg',
      stock: 20,
    }),
    buildProduct({
      id: '0b9f6a52-2f5e-4d0c-9a57-3a1f5f0c1a04',
      name: 'Pulse Smartwatch',
      description: 'Fitness smartwatch with heart-rate tracking and a 7-day battery.',
      priceInCents: 69990000,
      imageUrl: '/images/products/pulse-smartwatch.svg',
      stock: 5,
    }),
    buildProduct({
      id: '0b9f6a52-2f5e-4d0c-9a57-3a1f5f0c1a05',
      name: 'Ember Coffee Grinder',
      description: 'Conical burr grinder with 30 grind settings.',
      priceInCents: 32990000,
      imageUrl: '/images/products/ember-coffee-grinder.svg',
      stock: 1,
    }),
    buildProduct({
      id: '0b9f6a52-2f5e-4d0c-9a57-3a1f5f0c1a06',
      name: 'Drift Mechanical Keyboard',
      description: 'Compact 75% mechanical keyboard with hot-swappable switches.',
      priceInCents: 38990000,
      imageUrl: '/images/products/drift-mechanical-keyboard.svg',
      stock: 0,
    }),
  ];
}

export function buildPaymentConfig(overrides: Partial<PaymentConfig> = {}): PaymentConfig {
  return {
    publicKey: 'pub_test_key',
    tokenizationUrl: GATEWAY_TOKENIZATION_URL,
    acceptance: {
      token: 'acceptance-token-123',
      permalink: 'https://gateway.test/terms.pdf',
    },
    currency: 'COP',
    baseFeeInCents: 250000,
    deliveryFeeInCents: 800000,
    ...overrides,
  };
}

export function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: TRANSACTION_ID,
    reference: 'TX-20261009-7K2M9QXA',
    status: 'APPROVED',
    statusMessage: null,
    product: {
      id: PRODUCT_ID,
      name: 'Aurora Desk Lamp',
      imageUrl: '/images/products/aurora-desk-lamp.svg',
    },
    quantity: 1,
    amounts: {
      subtotalInCents: 12990000,
      baseFeeInCents: 250000,
      deliveryFeeInCents: 800000,
      totalInCents: 14040000,
    },
    currency: 'COP',
    card: { brand: 'VISA', lastFour: '4242' },
    customerId: '5a0d3a51-58f4-4a53-9c63-0f3f8d2f7c11',
    deliveryId: '9c1b4c7e-3f0a-4c0f-8b43-6f5e7d8c9a12',
    createdAt: '2026-10-09T15:00:00.000Z',
    resolvedAt: '2026-10-09T15:00:02.000Z',
    ...overrides,
  };
}

export function buildDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: '9c1b4c7e-3f0a-4c0f-8b43-6f5e7d8c9a12',
    transactionId: TRANSACTION_ID,
    customerId: '5a0d3a51-58f4-4a53-9c63-0f3f8d2f7c11',
    productId: PRODUCT_ID,
    quantity: 1,
    address: {
      addressLine1: 'Cra 7 # 71-21',
      addressLine2: 'Apto 501',
      city: 'Bogotá',
      region: 'Cundinamarca',
      country: 'CO',
      postalCode: '110231',
    },
    status: 'PENDING',
    createdAt: '2026-10-09T15:00:02.000Z',
    updatedAt: '2026-10-09T15:00:02.000Z',
    ...overrides,
  };
}

export function buildSalesSummary(overrides: Partial<SalesSummary> = {}): SalesSummary {
  return {
    currency: 'COP',
    range: { from: '2026-10-04', to: '2026-10-10', days: 7 },
    totals: {
      revenueInCents: 60_120_000,
      approvedOrders: 3,
      unitsSold: 4,
      averageOrderInCents: 20_040_000,
      totalAttempts: 5,
      approvalRate: 0.75,
    },
    salesByDay: [
      { date: '2026-10-04', revenueInCents: 0, orders: 0 },
      { date: '2026-10-05', revenueInCents: 0, orders: 0 },
      { date: '2026-10-06', revenueInCents: 0, orders: 0 },
      { date: '2026-10-07', revenueInCents: 0, orders: 0 },
      { date: '2026-10-08', revenueInCents: 0, orders: 0 },
      { date: '2026-10-09', revenueInCents: 20_040_000, orders: 1 },
      { date: '2026-10-10', revenueInCents: 40_080_000, orders: 2 },
    ],
    topProducts: [
      { productId: PRODUCT_ID, name: 'Aurora Desk Lamp', unitsSold: 3, revenueInCents: 46_080_000 },
      {
        productId: '3f2a9c1e-5b7d-4e8a-9c21-0a1b2c3d4e03',
        name: 'Terra Backpack',
        unitsSold: 1,
        revenueInCents: 14_040_000,
      },
    ],
    payments: {
      byStatus: [
        { status: 'APPROVED', count: 3 },
        { status: 'DECLINED', count: 1 },
        { status: 'ERROR', count: 0 },
        { status: 'VOIDED', count: 0 },
        { status: 'PENDING', count: 1 },
      ],
      byCardBrand: [
        { brand: 'VISA', attempts: 4, approved: 3 },
        { brand: 'MASTERCARD', attempts: 1, approved: 0 },
      ],
    },
    generatedAt: '2026-10-10T12:00:00.000Z',
    ...overrides,
  };
}

export function buildGatewayTokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: 'CREATED',
    data: {
      id: 'tok_test_123',
      brand: 'VISA',
      last_four: '4242',
      expires_at: '2099-01-01T00:00:00.000Z',
      ...overrides,
    },
  };
}

export function errorEnvelope(code: string, message = 'Server message') {
  return { error: { code, message, details: [], requestId: 'req-123' } };
}
